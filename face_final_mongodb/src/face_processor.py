import cv2
import time
import os
import datetime
import logging
import numpy as np
from deepface import DeepFace
from sklearn.metrics.pairwise import cosine_similarity
from src.attendance_manager import mark_attendance

class FaceProcessor:
    """Manages the face detection and recognition pipeline for each frame."""
    def __init__(self, yolo_model, embeddings_db, names, config):
        self.yolo_model = yolo_model
        self.embeddings_db = embeddings_db
        self.names = names
        self.config = config
        self.last_unknown_capture_time = 0
        
        # Load settings from config
        self.yolo_conf = config.getfloat('Model_Settings', 'yolo_conf_threshold')
        self.dist_thresh = config.getfloat('Model_Settings', 'deepface_distance_threshold')
        self.padding = config.getint('Model_Settings', 'padding')
        self.cooldown = config.getfloat('Performance', 'unknown_capture_cooldown')
        self.unknown_path = config.get('Paths', 'unknown_faces_path')

    def process_frame(self, frame, frame_counter):
        """
        Processes a single frame to detect and recognize faces.
        
        Args:
            frame: The video frame to process.
            frame_counter (int): The current frame number.
            
        Returns:
            The frame with annotations (bounding boxes and names).
        """
        process_every = self.config.getint('Performance', 'process_every_n_frames')
        if frame_counter % process_every != 0:
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
                    yolo_confidence = box.conf.item()

                    pad_y1, pad_x1 = max(0, y1 - self.padding), max(0, x1 - self.padding)
                    pad_y2, pad_x2 = min(h_orig, y2 + self.padding), min(w_orig, x2 + self.padding)
                    face = frame[pad_y1:pad_y2, pad_x1:pad_x2]

                    if face.size == 0:
                        continue
                    
                    self._recognize_and_draw(frame, face, (x1, y1, x2, y2), yolo_confidence)

        except Exception as e:
            logging.error(f"Error during frame processing: {e}", exc_info=True)
        return frame

    def _recognize_and_draw(self, frame, face, coords, yolo_conf):
        """Helper to run recognition and annotate the frame."""
        x1, y1, x2, y2 = coords
        try:
            rep = DeepFace.represent(img_path=face, model_name="ArcFace", enforce_detection=False)
            if not rep or "embedding" not in rep[0]:
                return

            face_embedding = rep[0]["embedding"]
            sims = cosine_similarity([face_embedding], self.embeddings_db)[0]
            best_idx = np.argmax(sims)
            distance = 1 - sims[best_idx]

            if distance < self.dist_thresh:
                name = self.names[best_idx]
                mark_attendance(name, yolo_conf, distance, self.config)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, name, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
            else:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                cv2.putText(frame, "Unknown", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                self._save_unknown_face(face)
        except Exception as e:
            logging.warning(f"Face recognition failed for a detected face: {e}")

    def _save_unknown_face(self, face):
        """Saves an image of an unknown face, respecting the cooldown."""
        current_time = time.time()
        if (current_time - self.last_unknown_capture_time) > self.cooldown:
            now = datetime.datetime.now()
            ts_display = now.strftime("%Y-%m-%d %H:%M:%S")
            ts_filename = now.strftime("%Y%m%d_%H%M%S")

            cv2.putText(face, ts_display, (5, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            filepath = os.path.join(self.unknown_path, f"unknown_{ts_filename}.jpg")
            cv2.imwrite(filepath, face)
            logging.info(f"Saved unknown face to {filepath}")
            self.last_unknown_capture_time = current_time