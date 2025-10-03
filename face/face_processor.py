import cv2
import os
import time
import datetime
import logging
from ultralytics import YOLO
from deepface import DeepFace

class FaceProcessor:
    """
    Handles face detection, recognition, and saving of unknown faces.
    """
    def __init__(self, config):
        self.log = logging.getLogger()
        
        # Load config values
        self.yolo_model_path = config.get('paths', 'yolo_model')
        self.dataset_path = config.get('paths', 'dataset')
        self.unknown_faces_path = config.get('paths', 'unknown_faces')
        self.yolo_conf_thresh = config.getfloat('thresholds', 'yolo_confidence')
        self.deepface_dist_thresh = config.getfloat('thresholds', 'deepface_distance')
        self.padding = config.getint('thresholds', 'padding')
        self.unknown_cooldown = config.getfloat('settings', 'unknown_capture_cooldown_seconds')

        # Initialize models and state
        self.model = YOLO(self.yolo_model_path)
        self.last_unknown_capture_time = 0
        if not os.path.exists(self.unknown_faces_path):
            os.makedirs(self.unknown_faces_path)
            self.log.info(f"Created directory for unknown faces at: {self.unknown_faces_path}")

    def process_frame(self, frame, attendance_manager):
        """
        Detects and recognizes faces in a frame, updates attendance, and handles unknowns.
        Returns the annotated frame.
        """
        h_orig, w_orig = frame.shape[:2]
        
        # Resize for performance, then run YOLO
        process_frame = cv2.resize(frame, (640, 360))
        results = self.model(process_frame, conf=self.yolo_conf_thresh, verbose=False)

        for r in results:
            for box in r.boxes:
                # --- Get Bounding Box and Confidence ---
                yolo_confidence = box.conf.item()
                x1_s, y1_s, x2_s, y2_s = map(int, box.xyxy[0].cpu().numpy())
                
                # --- Scale coordinates back to original frame size ---
                x1 = int(x1_s * w_orig / 640)
                y1 = int(y1_s * h_orig / 360)
                x2 = int(x2_s * w_orig / 640)
                y2 = int(y2_s * h_orig / 360)

                # --- Crop Face with Padding ---
                pad_y1 = max(0, y1 - self.padding)
                pad_x1 = max(0, x1 - self.padding)
                pad_y2 = min(h_orig, y2 + self.padding)
                pad_x2 = min(w_orig, x2 + self.padding)
                face = frame[pad_y1:pad_y2, pad_x1:pad_x2]

                if face.size == 0:
                    continue

                # --- Face Recognition ---
                try:
                    result_df_list = DeepFace.find(
                        img_path=face,
                        db_path=self.dataset_path,
                        model_name="ArcFace",
                        enforce_detection=False,
                        silent=True
                    )
                    
                    if result_df_list and not result_df_list[0].empty:
                        best_match = result_df_list[0].iloc[0]
                        distance = best_match['distance']

                        if distance < self.deepface_dist_thresh:
                            # --- Recognized Person ---
                            identity_path = best_match['identity']
                            name = os.path.basename(os.path.dirname(identity_path))
                            attendance_manager.mark_attendance(name, yolo_confidence, distance)
                            self.draw_on_frame(frame, (x1, y1, x2, y2), name, (0, 255, 0))
                        else:
                            # --- Unknown: Low Confidence Match ---
                            self.handle_unknown_face(face)
                            self.draw_on_frame(frame, (x1, y1, x2, y2), "Unknown", (255, 0, 0))
                    else:
                        # --- Unknown: No Match Found ---
                        self.handle_unknown_face(face)
                        self.draw_on_frame(frame, (x1, y1, x2, y2), "Unknown", (255, 0, 0))

                except Exception as e:
                    self.log.error(f"DeepFace recognition error: {e}")
        
        return frame

    def handle_unknown_face(self, face_img):
        """Saves an image of an unknown face if cooldown has passed."""
        current_time = time.time()
        if (current_time - self.last_unknown_capture_time) > self.unknown_cooldown:
            dt_now = datetime.datetime.now()
            ts_filename = dt_now.strftime("%Y%m%d_%H%M%S")
            ts_display = dt_now.strftime("%Y-%m-%d %H:%M:%S")

            face_with_ts = face_img.copy()
            cv2.putText(face_with_ts, ts_display, (5, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
            
            filepath = os.path.join(self.unknown_faces_path, f"unknown_{ts_filename}.jpg")
            cv2.imwrite(filepath, face_with_ts)
            self.log.info(f"📸 Saved unknown face with timestamp to {filepath}")
            self.last_unknown_capture_time = current_time

    def draw_on_frame(self, frame, box, text, color):
        """Draws a bounding box and text on the frame."""
        x1, y1, x2, y2 = box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)