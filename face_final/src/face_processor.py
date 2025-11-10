# src/face_processor.py
import cv2
import time
import os
import datetime
import logging
import numpy as np
from deepface import DeepFace
from sklearn.metrics.pairwise import cosine_similarity
from src.attendance_manager import mark_attendance
from concurrent.futures import as_completed

def align_face_from_landmarks(crop, lm_dict, output_size=(112, 112)):
    """
    Aligns a face crop using 3 landmarks (eyes, nose).
    lm_dict: A dict from the mediapipe worker, e.g., {'left_eye': [x, y], ...}
    """
    try:
        # --- FIX: Use the new landmark keys ---
        if not lm_dict or not {'left_eye_inner', 'right_eye_inner', 'nose'}.issubset(lm_dict.keys()):
            # Fallback: just resize if landmarks are missing
            return cv2.resize(crop, output_size)
            
        # Source points from landmarks
        src = np.array([
            lm_dict['left_eye_inner'],  # <-- CHANGED
            lm_dict['right_eye_inner'], # <-- CHANGED
            lm_dict['nose']
        ], dtype=np.float32)

        # Destination points (a standard 112x112 template)
# Destination points (a standard 112x112 template)
        dst = np.array([
            [output_size[0] * 0.34, output_size[1] * 0.46], # Left eye
            [output_size[0] * 0.65, output_size[1] * 0.46], # Right eye
            [output_size[0] * 0.50, output_size[1] * 0.64], # Nose
        ], dtype=np.float32)

        # Get affine transform
        M = cv2.getAffineTransform(src, dst)
        
        # Warp the image
        aligned = cv2.warpAffine(
            crop, M, output_size, 
            flags=cv2.INTER_LINEAR, 
            borderMode=cv2.BORDER_CONSTANT
        )
        return aligned
    except Exception as e:
        logging.warning(f"Failed to align face: {e}. Using simple resize.")
        return cv2.resize(crop, output_size)


class FaceProcessor:
    """Manages the face detection, quality filtering, and recognition pipeline."""
    
    # --- *** MODIFIED __init__ *** ---
    def __init__(self, yolo_model, embeddings_db, names, config, mediapipe_pool):
        self.yolo_model = yolo_model
        self.embeddings_db = embeddings_db
        self.names = names
        self.config = config
        self.mediapipe_pool = mediapipe_pool # <-- ADDED
        self.last_unknown_capture_time = 0
        
        # Load settings from config
        self.yolo_conf = config.getfloat('Model_Settings', 'yolo_conf_threshold')
        self.dist_thresh = config.getfloat('Model_Settings', 'deepface_distance_threshold')
        self.padding = config.getint('Model_Settings', 'padding')
        
        # --- ADDED: Quality Filter Thresholds (from config) ---
        self.blur_thresh = config.getfloat('Quality_Filters', 'blur_threshold', fallback=100.0)
        self.yaw_thresh = config.getfloat('Quality_Filters', 'yaw_threshold', fallback=25.0)
        self.pitch_thresh = config.getfloat('Quality_Filters', 'pitch_threshold', fallback=25.0)

        # Load unknown face settings
        self.cooldown = config.getfloat('Performance', 'unknown_capture_cooldown')
        self.unknown_path = config.get('Paths', 'unknown_faces_path')
        os.makedirs(self.unknown_path, exist_ok=True) # Ensure it exists

        # For async processing
        self.pending_futures = {} # {future: (coords)}

    # --- *** MODIFIED process_frame *** ---
    def process_frame(self, frame, frame_counter):
        """
        Processes a single frame:
        1. (Async) Cleans up old results.
        2. (If processing frame) Detects faces with YOLO, submits to MediaPipe.
        3. Draws results from completed futures.
        """
        process_every = self.config.getint('Performance', 'process_every_n_frames')
        
        # --- 1. (Async) Check for completed futures from previous frames ---
        # This makes the pipeline non-blocking
        done_futures = {f for f in self.pending_futures if f.done()}
        for fut in done_futures:
            coords = self.pending_futures.pop(fut) # Get box coords
            try:
                mp_result = fut.result()
                self._handle_recognition(frame, coords, mp_result)
            except Exception as e:
                logging.error(f"Error processing a face future: {e}", exc_info=True)

        # --- 2. (Sync) Detect new faces on this frame ---
        if frame_counter % process_every != 0:
            # On skipped frames, just return the frame (boxes are drawn from futures)
            return frame

        h_orig, w_orig = frame.shape[:2]
        inference_frame = cv2.resize(frame, (640, 360))
        h_inf, w_inf = inference_frame.shape[:2]

        try:
            results = self.yolo_model(inference_frame, conf=self.yolo_conf, verbose=False)
            for r in results:
                for box in r.boxes:
                    x1_s, y1_s, x2_s, y2_s = map(int, box.xyxy[0].cpu().numpy())
                    x1, y1 = int(x1_s * w_orig / w_inf), int(y1_s * h_orig / h_inf)
                    x2, y2 = int(x2_s * w_orig / w_inf), int(y2_s * h_orig / h_inf)
                    
                    # Store yolo_conf for later
                    yolo_confidence = box.conf.item() 

                    pad_y1, pad_x1 = max(0, y1 - self.padding), max(0, x1 - self.padding)
                    pad_y2, pad_x2 = min(h_orig, y2 + self.padding), min(w_orig, x2 + self.padding)
                    face_crop = frame[pad_y1:pad_y2, pad_x1:pad_x2]

                    if face_crop.size == 0:
                        continue
                    
                    # --- 3. (Async) Submit face to MediaPipe worker pool ---
                    future = self.mediapipe_pool.submit(face_crop)
                    # Store the future and metadata (coords, yolo_conf, and the crop itself)
                    self.pending_futures[future] = (face_crop, (x1, y1, x2, y2), yolo_confidence)

        except Exception as e:
            logging.error(f"Error during YOLO processing: {e}", exc_info=True)
            
        # Frame is returned *without* waiting for recognition
        return frame

    def _handle_recognition(self, frame, metadata, mp_result):
        """
        This is called when a mediapipe future is complete.
        It filters, aligns, recognizes, and draws on the frame.
        """
        face_crop, (x1, y1, x2, y2), yolo_confidence = metadata
        
        # --- 1. MediaPipe Quality Filter ---
        if not mp_result.get("ok"):
            # Failed to get mesh (e.g., too blurry, side of head)
            self._draw_box(frame, (x1, y1, x2, y2), "No Face Mesh", "yellow")
            return

        yaw, pitch, blur = mp_result.get("yaw"), mp_result.get("pitch"), mp_result.get("blur")

        if yaw is None or pitch is None:
            self._draw_box(frame, (x1, y1, x2, y2), "Pose Error", "yellow")
            return
            
        if abs(yaw) > self.yaw_thresh or abs(pitch) > self.pitch_thresh:
            text = f"Bad Angle (Y:{yaw:.0f} P:{pitch:.0f})"
            self._draw_box(frame, (x1, y1, x2, y2), text, "yellow")
            return

        if blur < self.blur_thresh:
            text = f"Blurry ({blur:.0f})"
            self._draw_box(frame, (x1, y1, x2, y2), text, "yellow")
            return
            
        # --- 2. Alignment ---
        # All filters passed, now align the face for recognition
        landmarks = mp_result.get("landmarks")


#### Recording of align faces  #####

        # --- *** FIX: Check if landmarks exist before aligning *** ---
        # The new align_landmarks uses 'left_eye_inner' and 'right_eye_inner'
        if not landmarks or landmarks.get("left_eye_inner") is None or landmarks.get("right_eye_inner") is None:
            logging.warning("MediaPipe returned OK but alignment landmarks were missing.")
            self._draw_box(frame, (x1, y1, x2, y2), "Landmark Error", "yellow")
            return






        aligned_face = align_face_from_landmarks(face_crop, landmarks, output_size=(112, 112))



        # --- *** START DEBUGGING CODE *** ---
        # This saves the 112x112 aligned face to disk
        try:
            debug_path = "debug_aligned_faces"
            os.makedirs(debug_path, exist_ok=True)
            ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            filename = os.path.join(debug_path, f"aligned_{ts}.jpg")
            cv2.imwrite(filename, aligned_face)
        except Exception as e:
            logging.warning(f"Could not save debug aligned face: {e}")
        # --- *** END DEBUGGING CODE *** ---




        
        # --- 3. Recognition (DeepFace) ---
        try:
            # Pass the aligned 112x112 numpy array to DeepFace
            rep = DeepFace.represent(
                img_path=aligned_face, 
                model_name="VGG-Face", # Keeping your original model
                enforce_detection=False,
                detector_backend='skip' # We already have a perfect crop
            )
            
            if not rep or "embedding" not in rep[0]:
                logging.warning("DeepFace.represent failed to return an embedding.")
                self._draw_box(frame, (x1, y1, x2, y2), "Recog Error", "yellow")
                return

            face_embedding = rep[0]["embedding"]
            sims = cosine_similarity([face_embedding], self.embeddings_db)[0]
            best_idx = np.argmax(sims)
            distance = 1 - sims[best_idx]

            if distance < self.dist_thresh:
                name = self.names[best_idx]
                mark_attendance(name, yolo_confidence, distance, self.config)
                self._draw_box(frame, (x1, y1, x2, y2), name, "green")
            else:
                self._draw_box(frame, (x1, y1, x2, y2), "Unknown", "red")
                self._save_unknown_face(face_crop) # Save the original crop

        except Exception as e:
            logging.warning(f"Face recognition failed: {e}")
            self._draw_box(frame, (x1, y1, x2, y2), "Error", "red")

    def _draw_box(self, frame, coords, text, color_name):
        """Helper to draw colored boxes and text."""
        x1, y1, x2, y2 = coords
        colors = {
            "green": (0, 255, 0),
            "red": (0, 0, 255),
            "yellow": (0, 255, 255)
        }
        color = colors.get(color_name, (255, 0, 0))
        
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

    def _save_unknown_face(self, face):
        """Saves an image of an unknown face, respecting the cooldown."""
        current_time = time.time()
        if (current_time - self.last_unknown_capture_time) > self.cooldown:
            now = datetime.datetime.now()
            ts_display = now.strftime("%Y-%m-%d %H:%M:%S")
            ts_filename = now.strftime("%Y%m%d_%H%M%S")

            face_with_ts = face.copy()
            cv2.putText(face_with_ts, ts_display, (5, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            filepath = os.path.join(self.unknown_path, f"unknown_{ts_filename}.jpg")
            
            try:
                cv2.imwrite(filepath, face_with_ts)
                logging.info(f"Saved unknown face to {filepath}")
                self.last_unknown_capture_time = current_time
            except Exception as e:
                logging.error(f"Failed to save unknown face: {e}")