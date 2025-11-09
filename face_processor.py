# src/face_processor.py
"""
FaceProcessor integrated with a separate MediaPipe worker pool (mediapipe_pool).
- Non-blocking submission of face crops to MediaPipe (pose/landmarks/blur/area).
- Rejects non-frontal / blurry / tiny faces early.
- Aligns accepted faces to 112x112 using 3 landmarks (left_eye, right_eye, nose).
- Batch-embeds using a provided arcface_model (Torch/ONNX wrapper) or DeepFace fallback.
- Matches against a person bank (centroid per person), with margin check to avoid ambiguous matches.
- Uses a SimpleTracker to reduce repeated recognition and reduce compute.
- Saves unknown faces asynchronously and calls attendance backend (AttendanceDB or legacy CSV mark).
"""

from typing import List, Tuple, Optional, Dict
import os
import time
import datetime
import threading
import logging
import numpy as np
import cv2

logger = logging.getLogger(__name__)

# Try legacy attendance
try:
    from src.attendance_manager import mark_attendance as legacy_mark_attendance
except Exception:
    legacy_mark_attendance = None

# Simple centroid tracker (fast, lightweight)
class SimpleTracker:
    def __init__(self, max_lost: int = 30):
        self.next_id = 0
        self.tracks = {}  # id -> {'bbox':(x1,y1,x2,y2), 'lost':int}
        self.max_lost = max_lost

    @staticmethod
    def _centroid(bbox: Tuple[int, int, int, int]) -> Tuple[float, float]:
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    def update(self, detections: List[Tuple[int, int, int, int]]) -> List[Tuple[int, Tuple[int, int, int, int]]]:
        if len(self.tracks) == 0:
            outs = []
            for b in detections:
                tid = self.next_id
                self.next_id += 1
                self.tracks[tid] = {'bbox': b, 'lost': 0}
                outs.append((tid, b))
            return outs

        track_ids = list(self.tracks.keys())
        track_centroids = [self._centroid(self.tracks[t]['bbox']) for t in track_ids]
        det_centroids = [self._centroid(b) for b in detections]

        T = len(track_centroids)
        D = len(det_centroids)
        if T == 0:
            outs = []
            for b in detections:
                tid = self.next_id
                self.next_id += 1
                self.tracks[tid] = {'bbox': b, 'lost': 0}
                outs.append((tid, b))
            return outs

        dist = np.zeros((T, D), dtype=float)
        for i, tc in enumerate(track_centroids):
            for j, dc in enumerate(det_centroids):
                dist[i, j] = (tc[0] - dc[0]) ** 2 + (tc[1] - dc[1]) ** 2

        assigned_det_to_track = {}
        assigned_tracks = set()
        while True:
            idx = np.unravel_index(np.argmin(dist), dist.shape)
            i, j = int(idx[0]), int(idx[1])
            if not np.isfinite(dist[i, j]) or np.isinf(dist[i, j]):
                break
            tid = track_ids[i]
            assigned_det_to_track[j] = tid
            assigned_tracks.add(tid)
            dist[i, :] = np.inf
            dist[:, j] = np.inf
            if np.all(np.isinf(dist)):
                break

        outs = []
        used_tracks = set()
        for j, bbox in enumerate(detections):
            if j in assigned_det_to_track:
                tid = assigned_det_to_track[j]
                self.tracks[tid]['bbox'] = bbox
                self.tracks[tid]['lost'] = 0
                outs.append((tid, bbox))
                used_tracks.add(tid)
            else:
                tid = self.next_id
                self.next_id += 1
                self.tracks[tid] = {'bbox': bbox, 'lost': 0}
                outs.append((tid, bbox))
                used_tracks.add(tid)

        for tid in list(self.tracks.keys()):
            if tid not in used_tracks:
                self.tracks[tid]['lost'] += 1
                if self.tracks[tid]['lost'] > self.max_lost:
                    del self.tracks[tid]

        return outs


# Utility functions
def is_blurry(img: np.ndarray, thresh: float = 80.0) -> bool:
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return cv2.Laplacian(gray, cv2.CV_64F).var() < thresh
    except Exception:
        return False


def align_face_from_landmarks(crop: np.ndarray, lm: Dict[str, List[float]], output_size: Tuple[int, int] = (112, 112)) -> np.ndarray:
    """
    Align using 3 points: left_eye, right_eye, nose.
    lm coordinates are expected in pixel coords relative to the crop.
    """
    try:
        if not lm or not {'left_eye', 'right_eye', 'nose'}.issubset(lm.keys()):
            return cv2.resize(crop, output_size)
        src = np.array([lm['left_eye'], lm['right_eye'], lm['nose']], dtype=np.float32)
        dst = np.array([
            [output_size[0] * 0.3, output_size[1] * 0.35],
            [output_size[0] * 0.7, output_size[1] * 0.35],
            [output_size[0] * 0.5, output_size[1] * 0.55],
        ], dtype=np.float32)
        M, _ = cv2.estimateAffinePartial2D(src, dst)
        if M is None:
            return cv2.resize(crop, output_size)
        aligned = cv2.warpAffine(crop, M, output_size, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        return aligned
    except Exception:
        return cv2.resize(crop, output_size)


class FaceProcessor:
    """
    yolo_model: ultralytics YOLO model callable
    embeddings_db: numpy array (N, D) normalized rows OR list (will normalize)
    names: list of names corresponding to embeddings_db rows
    config: configparser.ConfigParser
    attendance_db: optional AttendanceDB instance with .mark(name, yolo_conf, deepface_dist, cooldown_seconds)
    arcface_model: optional batchable model (torch module or custom wrapper)
    mediapipe_pool: instance of MediapipePool (must implement .submit(crop) -> concurrent.futures.Future)
    """
    def __init__(
        self,
        yolo_model,
        embeddings_db,
        names: List[str],
        config,
        attendance_db: Optional[object] = None,
        arcface_model: Optional[object] = None,
        mediapipe_pool: Optional[object] = None,
    ):
        self.yolo_model = yolo_model
        self.arcface_model = arcface_model
        self.config = config
        self.attendance_db = attendance_db
        self.mediapipe_pool = mediapipe_pool

        # params
        self.yolo_conf = config.getfloat('Model_Settings', 'yolo_conf_threshold', fallback=0.35)
        self.dist_thresh = config.getfloat('Model_Settings', 'deepface_distance_threshold', fallback=0.30)
        self.padding = config.getint('Model_Settings', 'padding', fallback=40)
        self.process_every = config.getint('Performance', 'process_every_n_frames', fallback=2)
        self.recognize_every = config.getint('Performance', 'recognize_every_n_frames', fallback=5)

        self.yaw_threshold = config.getfloat('Model_Settings', 'yaw_threshold_degrees', fallback=20.0)
        self.blur_thresh = config.getfloat('Model_Settings', 'blur_threshold', fallback=80.0)
        self.min_face_area = config.getint('Model_Settings', 'min_face_area', fallback=1600)
        self.min_match_similarity = config.getfloat('Model_Settings', 'min_match_similarity', fallback=0.72)
        self.min_match_margin = config.getfloat('Model_Settings', 'min_match_margin', fallback=0.05)

        # tracker
        self.tracker = SimpleTracker(max_lost=config.getint('Performance', 'max_lost', fallback=30))
        self.track_last_recognized = {}  # track_id -> last frame index when recognized

        # prepare embeddings
        self.embeddings_db = np.asarray(embeddings_db, dtype=np.float32)
        if self.embeddings_db.ndim == 1:
            self.embeddings_db = self.embeddings_db.reshape(1, -1)
        norms = np.linalg.norm(self.embeddings_db, axis=1, keepdims=True) + 1e-12
        self.embeddings_db = (self.embeddings_db / norms).astype(np.float32)

        self.names = list(names)
        self.person_bank = self._build_person_bank(self.embeddings_db, self.names)

        # unknown saving
        self.unknown_path = config.get('Paths', 'unknown_faces_path', fallback='unknown_faces')
        os.makedirs(self.unknown_path, exist_ok=True)
        self.unknown_cooldown = config.getfloat('Performance', 'unknown_capture_cooldown', fallback=10.0)
        self._last_unknown_saved = 0.0
        self._save_lock = threading.Lock()

    def _build_person_bank(self, embeddings: np.ndarray, names: List[str]) -> Dict[str, dict]:
        bank = {}
        for emb, nm in zip(embeddings, names):
            bank.setdefault(nm, []).append(emb)
        out = {}
        for nm, arr in bank.items():
            A = np.vstack(arr)
            A_norm = A / (np.linalg.norm(A, axis=1, keepdims=True) + 1e-12)
            centroid = A_norm.mean(axis=0)
            centroid = centroid / (np.linalg.norm(centroid) + 1e-12)
            out[nm] = {'centroid': centroid, 'embs': A_norm, 'std': float(A_norm.std())}
        return out

    def process_frame(self, frame: np.ndarray, frame_counter: int) -> np.ndarray:
        """
        Main per-frame processing. Non-blocking overall: mediapipe submitted as futures and awaited with short timeouts.
        """
        if frame is None:
            return frame
        if (frame_counter % self.process_every) != 0:
            return frame

        h_orig, w_orig = frame.shape[:2]
        inference_frame = cv2.resize(frame, (640, 360))
        h_inf, w_inf = inference_frame.shape[:2]

        try:
            results = self.yolo_model(inference_frame, conf=self.yolo_conf, verbose=False)
        except Exception as e:
            logger.exception("YOLO failed: %s", e)
            return frame

        detections = []
        meta_list = []
        for r in results:
            for box in r.boxes:
                try:
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1_s, y1_s, x2_s, y2_s = xyxy
                    x1 = int(x1_s * w_orig / w_inf)
                    y1 = int(y1_s * h_orig / h_inf)
                    x2 = int(x2_s * w_orig / w_inf)
                    y2 = int(y2_s * h_orig / h_inf)
                    if x2 <= x1 or y2 <= y1:
                        continue
                    detections.append((x1, y1, x2, y2))
                    meta_list.append({'conf': float(box.conf.item())})
                except Exception:
                    continue

        if not detections:
            return frame

        assigned = self.tracker.update(detections)

        # Build recognition candidates (apply area/blur quick checks)
        to_recognize = []
        for idx, (track_id, bbox) in enumerate(assigned):
            x1, y1, x2, y2 = bbox
            pad_y1 = max(0, y1 - self.padding)
            pad_x1 = max(0, x1 - self.padding)
            pad_y2 = min(h_orig, y2 + self.padding)
            pad_x2 = min(w_orig, x2 + self.padding)
            crop = frame[pad_y1:pad_y2, pad_x1:pad_x2]
            if crop.size == 0:
                continue
            area = crop.shape[0] * crop.shape[1]
            if area < self.min_face_area:
                # annotate small face as ID/unknown box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 1)
                cv2.putText(frame, "TooSmall", (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
                continue
            # quick blur check (fast)
            if is_blurry(crop, thresh=self.blur_thresh):
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 1)
                cv2.putText(frame, "Blurry", (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
                continue

            last_rec = self.track_last_recognized.get(track_id, -9999)
            if (frame_counter - last_rec) >= self.recognize_every:
                meta = meta_list[idx] if idx < len(meta_list) else {'conf': 0.0}
                to_recognize.append((track_id, crop, bbox, meta))

        if not to_recognize:
            # Draw IDs for tracks
            for tid, bbox in assigned:
                x1, y1, x2, y2 = bbox
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 0), 1)
                cv2.putText(frame, f"ID:{tid}", (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)
            return frame

        # Submit crops to mediapipe pool if available, else try local per-crop processing (not recommended)
        pending = []  # list of tuples (future, track_id, bbox, orig_crop, meta)
        if self.mediapipe_pool is not None:
            for (track_id, crop, bbox, meta) in to_recognize:
                try:
                    fut = self.mediapipe_pool.submit(crop, resize_for_mp=True)
                    pending.append((fut, track_id, bbox, crop, meta))
                except Exception:
                    # fallback: mark unknown, but don't block
                    logger.exception("Failed to submit to mediapipe pool")
                    self._mark_unknown(frame, bbox, crop)
                    self.track_last_recognized[track_id] = frame_counter
        else:
            # No mediapipe_pool: attempt immediate local alignment by center-crop (less accurate)
            for (track_id, crop, bbox, meta) in to_recognize:
                aligned = align_face_from_landmarks(crop, {})  # fallback naive resize
                pending.append((None, track_id, bbox, crop, meta))
                # we will embed these without MP checks below

        # collect results with short timeouts to avoid blocking main loop
        ready_for_embedding = []  # items: (track_id, aligned_img, bbox, meta)
        for (fut, track_id, bbox, orig_crop, meta) in pending:
            mp_res = None
            if fut is None:
                # fallback aligned crop already assumed in orig_crop -> align naive
                aligned = cv2.resize(orig_crop, (112, 112))
                ready_for_embedding.append((track_id, aligned, bbox, meta))
                continue

            try:
                # quick non-blocking check or short wait
                if fut.done():
                    mp_res = fut.result(timeout=0)
                else:
                    mp_res = fut.result(timeout=0.03)  # 30 ms max wait
            except Exception:
                mp_res = None

            if not mp_res or not mp_res.get("ok"):
                # skip this crop for now; main loop continues (no block)
                continue

            yaw = mp_res.get("yaw")
            blur = mp_res.get("blur")
            area = mp_res.get("area")

            # validation checks (skip if fails)
            if yaw is None or abs(yaw) > self.yaw_threshold:
                # reject side face
                self._mark_unknown(frame, bbox, orig_crop)
                self.track_last_recognized[track_id] = frame_counter
                continue
            if blur is not None and blur < self.blur_thresh:
                self._mark_unknown(frame, bbox, orig_crop)
                self.track_last_recognized[track_id] = frame_counter
                continue
            if area is not None and area < self.min_face_area:
                self._mark_unknown(frame, bbox, orig_crop)
                self.track_last_recognized[track_id] = frame_counter
                continue

            landmarks = mp_res.get("landmarks", {})
            aligned = align_face_from_landmarks(orig_crop, landmarks)
            ready_for_embedding.append((track_id, aligned, bbox, meta))

        # If nothing ready, just annotate and return
        if not ready_for_embedding:
            return frame

        # Batch embed
        crops = [item[1] for item in ready_for_embedding]
        embeddings = self._batch_embed(crops)

        # Match and annotate
        for (track_id, aligned_img, bbox, meta), emb in zip(ready_for_embedding, embeddings):
            x1, y1, x2, y2 = bbox
            if emb is None:
                self._mark_unknown(frame, bbox, aligned_img)
                self.track_last_recognized[track_id] = frame_counter
                continue

            emb = np.asarray(emb, dtype=np.float32)
            emb = emb / (np.linalg.norm(emb) + 1e-12)

            # compute centroid similarities quickly
            sims = {name: float(np.dot(info['centroid'], emb)) for name, info in self.person_bank.items()}
            sorted_items = sorted(sims.items(), key=lambda x: x[1], reverse=True)
            best_name, best_sim = sorted_items[0]
            second_sim = sorted_items[1][1] if len(sorted_items) > 1 else -1.0
            margin = best_sim - second_sim

            if best_sim >= self.min_match_similarity and margin >= self.min_match_margin:
                name = best_name
                # mark attendance
                try:
                    if self.attendance_db is not None:
                        cooldown_mins = self.config.getint('Performance', 'attendance_mark_minutes', fallback=1)
                        self.attendance_db.mark(name, float(meta.get('conf', 0.0)), float(1.0 - best_sim), cooldown_mins * 60)
                    elif legacy_mark_attendance is not None:
                        legacy_mark_attendance(name, float(meta.get('conf', 0.0)), float(1.0 - best_sim), self.config)
                except Exception:
                    logger.exception("Attendance write failed for %s", name)

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, name, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
            else:
                self._mark_unknown(frame, bbox, aligned_img)

            self.track_last_recognized[track_id] = frame_counter

        return frame

    def _mark_unknown(self, frame: np.ndarray, bbox: Tuple[int, int, int, int], crop: np.ndarray):
        x1, y1, x2, y2 = bbox
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
        cv2.putText(frame, "Unknown", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        self._save_unknown_nonblocking(crop)

    def _save_unknown_nonblocking(self, face_crop: np.ndarray):
        now = time.time()
        if (now - self._last_unknown_saved) < self.unknown_cooldown:
            return
        self._last_unknown_saved = now
        try:
            t = threading.Thread(target=self._save_unknown_face, args=(face_crop.copy(),), daemon=True)
            t.start()
        except Exception:
            self._save_unknown_face(face_crop)

    def _save_unknown_face(self, face_crop: np.ndarray):
        try:
            ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            fname = f"unknown_{ts}.jpg"
            path = os.path.join(self.unknown_path, fname)
            try:
                ts_display = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                cv2.putText(face_crop, ts_display, (5, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
            except Exception:
                pass
            cv2.imwrite(path, face_crop)
            logger.info("Saved unknown face: %s", path)
        except Exception:
            logger.exception("Failed to save unknown face.")

    def _batch_embed(self, crops: List[np.ndarray]) -> List[Optional[np.ndarray]]:
        """
        Batch embed aligned crops (112x112). Returns list of embeddings (or None on failure) in same order.
        Prefer self.arcface_model if it's a torch module or callable wrapper; fallback to DeepFace.represent.
        """
        if not crops:
            return []

        # Torch/ONNX path
        if self.arcface_model is not None:
            try:
                # Torch module path
                import torch
                if hasattr(self.arcface_model, "parameters"):
                    device = next(self.arcface_model.parameters()).device
                    tensors = []
                    for im in crops:
                        try:
                            im_r = cv2.resize(im, (112, 112))
                            im_rgb = im_r[:, :, ::-1]  # BGR -> RGB
                            t = torch.from_numpy(im_rgb).permute(2, 0, 1).float().unsqueeze(0) / 255.0
                            tensors.append(t)
                        except Exception:
                            tensors.append(torch.zeros((1, 3, 112, 112), dtype=torch.float32))
                    batch = torch.cat(tensors, dim=0).to(device)
                    with torch.no_grad():
                        emb_batch = self.arcface_model(batch)
                    emb_batch = emb_batch.cpu().numpy()
                    return [e.astype(np.float32) for e in emb_batch]
                else:
                    # custom wrapper callable per-image
                    outs = []
                    for im in crops:
                        try:
                            e = self.arcface_model(im)  # user should provide numpy -> embedding
                            outs.append(np.asarray(e, dtype=np.float32) if e is not None else None)
                        except Exception:
                            outs.append(None)
                    return outs
            except Exception:
                logger.exception("ArcFace embedding failed; falling back to DeepFace")

        # DeepFace fallback (slower)
        try:
            from deepface import DeepFace
            outs = []
            for im in crops:
                try:
                    rep = DeepFace.represent(img_path=im, model_name="ArcFace", enforce_detection=False)
                    if rep and "embedding" in rep[0]:
                        outs.append(np.array(rep[0]["embedding"], dtype=np.float32))
                    else:
                        outs.append(None)
                except Exception:
                    logger.exception("DeepFace.represent failed on one crop")
                    outs.append(None)
            return outs
        except Exception:
            logger.exception("DeepFace not available for fallback embedding")
            return [None] * len(crops)

    def close(self):
        # Graceful cleanup if needed
        return
