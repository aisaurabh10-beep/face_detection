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


## With bounding box


# import cv2
# import time
# import os
# import datetime
# import logging
# import numpy as np
# from deepface import DeepFace
# from sklearn.metrics.pairwise import cosine_similarity
# from src.attendance_manager import mark_attendance

# class FaceProcessor:
#     """Robust face detection + recognition pipeline for a video frame."""
#     def __init__(self, yolo_model, embeddings_db, names, config):
#         self.yolo_model = yolo_model
#         self.embeddings_db = embeddings_db  # numpy array shape (N, D)
#         self.names = names
#         self.config = config
#         self.last_unknown_capture_time = 0

#         # Load settings from config
#         self.yolo_conf = config.getfloat('Model_Settings', 'yolo_conf_threshold')
#         self.dist_thresh = config.getfloat('Model_Settings', 'deepface_distance_threshold')
#         self.padding = config.getint('Model_Settings', 'padding')
#         self.cooldown = config.getfloat('Performance', 'unknown_capture_cooldown')
#         self.unknown_path = config.get('Paths', 'unknown_faces_path')
#         self.high_conf_thresh = config.getfloat('Model_Settings', 'deepface_high_conf_threshold')

#         logging.getLogger().setLevel(logging.DEBUG)

#         # ADD THIS LINE
#         self.last_known_boxes = []

#     # def process_frame(self, frame, frame_counter):
#     #     """
#     #     Processes a single frame to detect and recognize faces.
#     #     Returns annotated frame.
#     #     """
#     #     process_every = self.config.getint('Performance', 'process_every_n_frames')
#     #     if frame_counter % process_every != 0:
#     #         return frame

#     #     h_orig, w_orig = frame.shape[:2]
#     #     # Keep a copy for inference resizing
#     #     inference_frame = cv2.resize(frame, (640, 360))
#     #     h_inf, w_inf = inference_frame.shape[:2]

#     #     try:
#     #         results = self.yolo_model(inference_frame, conf=self.yolo_conf, verbose=False)
#     #         # results may be a Results object or iterable; handle both
#     #         for r in results:
#     #             boxes = getattr(r, "boxes", []) or []
#     #             for box in boxes:
#     #                 # Safely extract xyxy as numpy array
#     #                 xy = box.xyxy.cpu().numpy().flatten()  # [x1,y1,x2,y2]
#     #                 if xy.size < 4:
#     #                     logging.debug("Skipping box with invalid xy shape: %s", xy.shape)
#     #                     continue
#     #                 x1_s, y1_s, x2_s, y2_s = xy.astype(float)
#     #                 # scale coordinates to original frame size
#     #                 x1 = int(max(0, np.floor(x1_s * w_orig / w_inf)))
#     #                 y1 = int(max(0, np.floor(y1_s * h_orig / h_inf)))
#     #                 x2 = int(min(w_orig - 1, np.ceil(x2_s * w_orig / w_inf)))
#     #                 y2 = int(min(h_orig - 1, np.ceil(y2_s * h_orig / h_inf)))
#     #                 yolo_confidence = float(box.conf.cpu().numpy()) if hasattr(box, "conf") else 0.0

#     #                 # apply padding but keep within image bounds
#     #                 pad_y1 = max(0, y1 - self.padding)
#     #                 pad_x1 = max(0, x1 - self.padding)
#     #                 pad_y2 = min(h_orig, y2 + self.padding)
#     #                 pad_x2 = min(w_orig, x2 + self.padding)
#     #                 face = frame[pad_y1:pad_y2, pad_x1:pad_x2].copy()

#     #                 if face.size == 0:
#     #                     logging.debug("Empty face crop, skipping.")
#     #                     continue

#     #                 self._recognize_and_draw(frame, face, (x1, y1, x2, y2), yolo_confidence)

#     #     except Exception as e:
#     #         logging.error(f"Error during frame processing: {e}", exc_info=True)
#     #     return frame


#     # src/face_processor.py

#     def process_frame(self, frame, frame_counter):
#         """
#         Processes a single frame to detect and recognize faces.
        
#         On processed frames, it runs the full pipeline.
#         On skipped frames, it redraws the last known boxes.
        
#         Args:
#             frame: The video frame to process.
#             frame_counter (int): The current frame number.
            
#         Returns:
#             The frame with annotations (bounding boxes and names).
#         """
#         process_every = self.config.getint('Performance', 'process_every_n_frames')

#         if frame_counter % process_every == 0:
#             # --- PROCESSING FRAME ---
#             # It's time to run the full pipeline.
#             # Clear the cache of old boxes.
#             self.last_known_boxes = []

#             h_orig, w_orig = frame.shape[:2]
#             inference_frame = cv2.resize(frame, (640, 360))
#             h_inf, w_inf = inference_frame.shape[:2]

#             try:
#                 results = self.yolo_model(inference_frame, conf=self.yolo_conf, verbose=False)
#                 for r in results:
#                     for box in r.boxes:
#                         x1_s, y1_s, x2_s, y2_s = map(int, box.xyxy[0].cpu().numpy())
#                         x1, y1 = int(x1_s * w_orig / w_inf), int(y1_s * h_orig / h_inf)
#                         x2, y2 = int(x2_s * w_orig / w_inf), int(y2_s * h_orig / h_inf)
#                         yolo_confidence = box.conf.item()

#                         pad_y1, pad_x1 = max(0, y1 - self.padding), max(0, x1 - self.padding)
#                         pad_y2, pad_x2 = min(h_orig, y2 + self.padding), min(w_orig, x2 + self.padding)
#                         face = frame[pad_y1:pad_y2, pad_x1:pad_x2]

#                         if face.size == 0:
#                             continue
                        
#                         # This will now draw on the frame AND update self.last_known_boxes
#                         self._recognize_and_draw(frame, face, (x1, y1, x2, y2), yolo_confidence)

#             except Exception as e:
#                 logging.error(f"Error during frame processing: {e}", exc_info=True)
        
#         else:
#             # --- SKIPPED FRAME (UPDATED LOGIC) ---
#             # Redraw the last known boxes.
#             for box_type, coords, name in self.last_known_boxes:
#                 x1, y1, x2, y2 = coords
#                 text_y = y1 - 10 if (y1 - 10) > 10 else y1 + 20
                
#                 if box_type == "known":
#                     color = (0, 255, 0) # Green
#                     font_size = 0.9
                
#                 # --- ADD THIS 'ELIF' ---
#                 elif box_type == "unsure":
#                     color = (0, 255, 255) # Yellow
#                     font_size = 0.5
                
#                 else: # "unknown"
#                     color = (0, 0, 255) # Red
#                     font_size = 0.5
                
#                 # Redraw the box and name
#                 cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
#                 cv2.putText(frame, name, (x1, text_y), cv2.FONT_HERSHEY_SIMPLEX, font_size, color, 2, cv2.LINE_AA)

#         return frame

#     def _recognize_and_draw(self, frame, face, coords, yolo_conf):
#         """Helper: run recognition and annotate the frame (safe, robust)."""
#         x1, y1, x2, y2 = coords
#         try:
#             # Convert from BGR (cv2) to RGB (DeepFace)
#             try:
#                 face_rgb = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
#             except cv2.error:
#                 face_rgb = face # if conversion fails, pass original

#             # Ask DeepFace for a representation
#             rep = DeepFace.represent(img_path=face_rgb, 
#                                      model_name="ArcFace", 
#                                      enforce_detection=True, 
#                                      detector_backend='retinaface')
            
#             if not rep or "embedding" not in rep[0]:
#                 logging.debug("DeepFace returned no embedding (likely bad angle/quality).")
#                 return

#             face_embedding = np.array(rep[0]["embedding"], dtype=np.float32)
#             if self.embeddings_db is None or len(self.embeddings_db) == 0:
#                 logging.warning("Embeddings DB is empty.")
#                 return

#             # compute cosine similarities
#             sims = cosine_similarity(face_embedding.reshape(1, -1), self.embeddings_db).flatten()
#             best_idx = int(np.argmax(sims))
#             best_sim = float(sims[best_idx])
#             distance = 1.0 - best_sim

#             # --- START: NEW 3-LEVEL LOGIC ---
            
#             text_y = y1 - 10 if (y1 - 10) > 10 else y1 + 20

#             # 1. Is it a HIGH confidence match?
#             if distance < self.high_conf_thresh and best_idx < len(self.names):
#                 name = self.names[best_idx]
#                 try:
#                     mark_attendance(name, yolo_conf, distance, self.config)
#                 except Exception as e:
#                     logging.exception("mark_attendance failed: %s", e)

#                 # Draw green box
#                 cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
#                 cv2.putText(frame, f"{name}", (x1, text_y),
#                             cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2, cv2.LINE_AA)
                
#                 self.last_known_boxes.append(("known", (x1, y1, x2, y2), name))

#             # 2. Is it a LOW confidence match (i.e., side angle)?
#             elif distance < self.dist_thresh:
#                 # It's someone we know, but the angle is bad.
#                 # DON'T mark attendance. DON'T show their name.
#                 name = "Please face camera"
                
#                 # Draw yellow box
#                 cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2) 
#                 cv2.putText(frame, name, (x1, text_y), 
#                             cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2, cv2.LINE_AA)
#                 self.last_known_boxes.append(("unsure", (x1, y1, x2, y2), name))

#             # 3. Is it an Unknown?
#             else:
#                 name = "Unknown"
#                 # Draw red box
#                 cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
#                 cv2.putText(frame, name, (x1, text_y),
#                             cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2, cv2.LINE_AA)
#                 self._save_unknown_face(face)
#                 self.last_known_boxes.append(("unknown", (x1, y1, x2, y2), name))
                
#             # --- END: NEW 3-LEVEL LOGIC ---

#         except Exception as e:
#             logging.warning(f"Face recognition failed for a detected face: {e}", exc_info=True)

#     def _save_unknown_face(self, face):
#         """Saves unknown face respecting cooldown (graceful)."""
#         current_time = time.time()
#         if (current_time - self.last_unknown_capture_time) > self.cooldown:
#             now = datetime.datetime.now()
#             ts_display = now.strftime("%Y-%m-%d %H:%M:%S")
#             ts_filename = now.strftime("%Y%m%d_%H%M%S")

#             try:
#                 cv2.putText(face, ts_display, (5, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
#                             (255, 255, 255), 1, cv2.LINE_AA)
#             except Exception:
#                 pass

#             filepath = os.path.join(self.unknown_path, f"unknown_{ts_filename}.jpg")
#             try:
#                 os.makedirs(self.unknown_path, exist_ok=True)
#                 cv2.imwrite(filepath, face)
#                 logging.info(f"Saved unknown face to {filepath}")
#             except Exception as e:
#                 logging.error(f"Failed saving unknown face: {e}", exc_info=True)

#             self.last_unknown_capture_time = current_time




# ## Adding solvePnP
# import cv2
# import time
# import os
# import datetime
# import logging
# import numpy as np
# import mediapipe as mp
# from deepface import DeepFace
# from sklearn.metrics.pairwise import cosine_similarity
# from src.attendance_manager import mark_attendance

# class FaceProcessor:
#     """
#     Manages the face detection, quality filtering, and recognition pipeline.
#     Now includes size and blur filters for robustness.
#     """
#     def __init__(self, yolo_model, embeddings_db, names, config):
#         self.yolo_model = yolo_model
#         # --- *** MOVE YOLO MODEL TO GPU *** ---
#         try:
#             # Try to move model to 'cuda' (GPU) if available
#             self.yolo_model.to('cuda')
#             logging.info("YOLO model moved to GPU.")
#         except Exception as e:
#             # Fallback to CPU if GPU is not available
#             self.yolo_model.to('cpu')
#             logging.info(f"GPU not available for YOLO, using CPU. Error: {e}")
        
#         self.embeddings_db = embeddings_db
#         self.names = names
#         self.config = config
#         self.last_unknown_capture_time = 0
        
#         # --- Load Model Settings ---
#         self.yolo_conf = config.getfloat('Model_Settings', 'yolo_conf_threshold')
#         self.dist_thresh = config.getfloat('Model_Settings', 'deepface_distance_threshold')
#         self.padding = config.getint('Model_Settings', 'padding')
        
#         # --- *** NEW: QUALITY FILTER THRESHOLDS *** ---
#         # 1. SIZE FILTER: Faces smaller than this (in pixels) will be ignored.
#         self.min_face_size = config.getint('Quality_Filters', 'min_face_size', fallback=80)
#         # 2. BLUR FILTER: Lower numbers = more blurry.
#         self.blur_thresh = config.getfloat('Quality_Filters', 'blur_threshold', fallback=100.0)
#         # 3. POSE FILTER: Max degrees of head turn.
#         self.yaw_thresh = config.getfloat('Quality_Filters', 'yaw_threshold', fallback=25.0)
#         self.pitch_thresh = config.getfloat('Quality_Filters', 'pitch_threshold', fallback=25.0)

#         # Load unknown face settings
#         self.cooldown = config.getfloat('Performance', 'unknown_capture_cooldown')
#         self.unknown_path = config.get('Paths', 'unknown_faces_path')

#         # Initialize MediaPipe Face Mesh
#         self.face_mesh = mp.solutions.face_mesh.FaceMesh(
#             static_image_mode=True, 
#             max_num_faces=1, 
#             refine_landmarks=True, 
#             min_detection_confidence=0.5
#         )
#         logging.info("FaceProcessor initialized with MediaPipe Face Mesh.")

#     def process_frame(self, frame, frame_counter):
#         """
#         Processes a single frame to detect, filter, and recognize faces.
#         """
#         process_every = self.config.getint('Performance', 'process_every_n_frames')
#         if frame_counter % process_every != 0:
#             return frame

#         h_orig, w_orig = frame.shape[:2]
#         inference_frame = cv2.resize(frame, (640, 360))
#         h_inf, w_inf = inference_frame.shape[:2]

#         try:
#             results = self.yolo_model(inference_frame, conf=self.yolo_conf, verbose=False)
#             for r in results:
#                 for box in r.boxes:
#                     x1_s, y1_s, x2_s, y2_s = map(int, box.xyxy[0].cpu().numpy())
#                     x1, y1 = int(x1_s * w_orig / w_inf), int(y1_s * h_orig / h_inf)
#                     x2, y2 = int(x2_s * w_orig / w_inf), int(y2_s * h_orig / h_inf)
#                     yolo_confidence = box.conf.item()

#                     pad_y1, pad_x1 = max(0, y1 - self.padding), max(0, x1 - self.padding)
#                     pad_y2, pad_x2 = min(h_orig, y2 + self.padding), min(w_orig, x2 + self.padding)
#                     face = frame[pad_y1:pad_y2, pad_x1:pad_x2]

#                     if face.size == 0:
#                         continue
                    
#                     # --- *** NEW: QUALITY CONTROL GAUNTLET *** ---
                    
#                     # 1. SIZE FILTER
#                     face_h, face_w = face.shape[:2]
#                     if face_w < self.min_face_size or face_h < self.min_face_size:
#                         cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 165, 0), 2) # Orange
#                         cv2.putText(frame, "Too Small", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 165, 0), 2)
#                         continue # Skip this face

#                     # 2. BLUR FILTER
#                     blur_score = self._get_blur_score(face)
#                     if blur_score < self.blur_thresh:
#                         cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 165, 255), 2) # Orange
#                         cv2.putText(frame, f"Blurry: {blur_score:.0f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
#                         continue # Skip this face

#                     # 3. POSE FILTER (solvePnP)
#                     yaw, pitch, pose_success = self._get_head_pose(face, (h_orig, w_orig))
                    
#                     if not pose_success:
#                         # This is the "No Mesh" error. We now know it's not due to size or blur.
#                         cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2) # Cyan
#                         cv2.putText(frame, "No Mesh", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
#                         continue # Skip this face
                    
#                     if abs(yaw) > self.yaw_thresh or abs(pitch) > self.pitch_thresh:
#                         cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 255), 2) # Orange
#                         cv2.putText(frame, "Bad Angle", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 200, 255), 2)
#                         continue # Skip this face
                    
#                     # --- All filters passed. Proceed with recognition. ---
#                     self._recognize_and_draw(frame, face, (x1, y1, x2, y2), yolo_confidence)

#         except Exception as e:
#             logging.error(f"Error during frame processing: {e}", exc_info=True)
#         return frame

#     def _get_blur_score(self, face_image):
#         """Calculates a blurriness score (Laplacian variance)."""
#         if face_image.size == 0:
#             return 0
#         try:
#             gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
#             variance = cv2.Laplacian(gray, cv2.CV_64F).var()
#             return variance
#         except cv2.error:
#             return 0

#     def _get_head_pose(self, face_image, frame_shape):
#         """Estimates head pose using solvePnP. Returns yaw, pitch, and success."""
#         face_rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
#         results = self.face_mesh.process(face_rgb)

#         if not results.multi_face_landmarks:
#             return None, None, False # This is the "No Mesh" condition

#         face_landmarks = results.multi_face_landmarks[0].landmark
#         h, w = face_image.shape[:2]
        
#         # 2D landmarks (image coordinates)
#         image_points = np.array([
#             (face_landmarks[1].x * w, face_landmarks[1].y * h),     # Nose tip
#             (face_landmarks[152].x * w, face_landmarks[152].y * h), # Chin
#             (face_landmarks[226].x * w, face_landmarks[226].y * h), # Left eye left corner
#             (face_landmarks[446].x * w, face_landmarks[446].y * h), # Right eye right corner
#             (face_landmarks[288].x * w, face_landmarks[288].y * h), # Left mouth corner
#             (face_landmarks[57].x * w, face_landmarks[57].y * h)    # Right mouth corner
#         ], dtype="double")

#         # 3D model points (generic model)
#         model_points = np.array([
#             (0.0, 0.0, 0.0),             # Nose tip
#             (0.0, -330.0, -65.0),        # Chin
#             (-225.0, 170.0, -135.0),     # Left eye left corner
#             (225.0, 170.0, -135.0),      # Right eye right corner
#             (-150.0, -150.0, -125.0),    # Left mouth corner
#             (150.0, -150.0, -125.0)      # Right mouth corner
#         ])

#         # Camera internals (generic)
#         focal_length = frame_shape[1]
#         center = (frame_shape[1] / 2, frame_shape[0] / 2)
#         camera_matrix = np.array([
#             [focal_length, 0, center[0]],
#             [0, focal_length, center[1]],
#             [0, 0, 1]
#         ], dtype="double")

#         dist_coeffs = np.zeros((4, 1)) # Assuming no lens distortion
#         (success, rotation_vector, translation_vector) = cv2.solvePnP(
#             model_points, image_points, camera_matrix, dist_coeffs
#         )

#         (projection_matrix, _) = cv2.Rodrigues(rotation_vector)
        
#         # Decompose rotation matrix to get Euler angles
#         # This gives us yaw (left/right) and pitch (up/down)
#         euler_angles = cv2.RQDecomp3x3(projection_matrix)[0]
        
#         pitch = euler_angles[0]
#         yaw = euler_angles[1]
#         # We don't care about roll for this filter
        
#         return yaw, pitch, True

#     def _recognize_and_draw(self, frame, face, coords, yolo_conf):
#         """Helper to run recognition and annotate the frame."""
#         x1, y1, x2, y2 = coords
#         try:
#             # Added detector_backend='skip' for a small performance boost
#             rep = DeepFace.represent(
#                 img_path=face, 
#                 model_name="ArcFace", 
#                 enforce_detection=False,
#                 detector_backend='skip' 
#             )
#             if not rep or "embedding" not in rep[0]:
#                 logging.warning("DeepFace.represent failed to return an embedding.")
#                 return

#             face_embedding = rep[0]["embedding"]
#             sims = cosine_similarity([face_embedding], self.embeddings_db)[0]
#             best_idx = np.argmax(sims)
#             distance = 1 - sims[best_idx]

#             if distance < self.dist_thresh:
#                 name = self.names[best_idx]
#                 mark_attendance(name, yolo_conf, distance, self.config)
#                 cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
#                 cv2.putText(frame, name, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
#             else:
#                 cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
#                 cv2.putText(frame, "Unknown", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
#                 self._save_unknown_face(face)
#         except Exception as e:
#             # Catching the specific 'Not a face' error from DeepFace
#             if "Face could not be detected" in str(e):
#                 logging.warning("DeepFace failed to align face, skipping.")
#             else:
#                 logging.warning(f"Face recognition failed: {e}")

#     def _save_unknown_face(self, face):
#         """Saves an image of an unknown face, respecting the cooldown."""
#         current_time = time.time()
#         if (current_time - self.last_unknown_capture_time) > self.cooldown:
#             try:
#                 now = datetime.datetime.now()
#                 ts_display = now.strftime("%Y-%m-%d %H:%M:%S")
#                 ts_filename = now.strftime("%Y%m%d_%H%M%S")

#                 # Add timestamp to the image itself
#                 face_with_ts = face.copy()
#                 cv2.putText(face_with_ts, ts_display, (5, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
                
#                 filepath = os.path.join(self.unknown_path, f"unknown_{ts_filename}.jpg")
#                 cv2.imwrite(filepath, face_with_ts)
#                 logging.info(f"Saved unknown face to {filepath}")
#                 self.last_unknown_capture_time = current_time
#             except Exception as e:
#                 logging.error(f"Failed to save unknown face: {e}", exc_info=True)

#     def close(self):
#         """Releases all model resources."""
#         self.face_mesh.close()
#         logging.info("FaceProcessor resources released.")


# import cv2
# import time
# import os
# import datetime
# import logging
# import numpy as np
# import mediapipe as mp
# from deepface import DeepFace
# from sklearn.metrics.pairwise import cosine_similarity
# from src.attendance_manager import mark_attendance

# class FaceProcessor:
#     """
#     Manages the face detection, quality filtering, and recognition pipeline.
#     This version uses MediaPipe + solvePnP for robust pose estimation.
#     """
#     def __init__(self, yolo_model, embeddings_db, names, config):
#         self.yolo_model = yolo_model
#         # --- *** MOVE YOLO MODEL TO GPU *** ---
#         try:
#             self.yolo_model.to('cuda')
#             logging.info("YOLO model moved to GPU.")
#         except Exception as e:
#             self.yolo_model.to('cpu')
#             logging.info(f"GPU not available for YOLO, using CPU. Error: {e}")
        
#         self.embeddings_db = embeddings_db
#         self.names = names
#         self.config = config
#         self.last_unknown_capture_time = 0
        
#         # --- Load Model Settings ---
#         self.yolo_conf = config.getfloat('Model_Settings', 'yolo_conf_threshold')
#         self.dist_thresh = config.getfloat('Model_Settings', 'deepface_distance_threshold')
#         self.padding = config.getint('Model_Settings', 'padding')
        
#         # --- QUALITY FILTER THRESHOLDS (from config) ---
#         self.min_face_size = config.getint('Quality_Filters', 'min_face_size', fallback=80)
#         self.blur_thresh = config.getfloat('Quality_Filters', 'blur_threshold', fallback=100.0)
#         self.yaw_thresh = config.getfloat('Quality_Filters', 'yaw_threshold', fallback=25.0)
#         self.pitch_thresh = config.getfloat('Quality_Filters', 'pitch_threshold', fallback=25.0)

#         # Load unknown face settings
#         self.cooldown = config.getfloat('Performance', 'unknown_capture_cooldown')
#         self.unknown_path = config.get('Paths', 'unknown_faces_path')

#         # Initialize MediaPipe Face Mesh
#         # This is our dedicated landmark detector
#         self.face_mesh = mp.solutions.face_mesh.FaceMesh(
#             static_image_mode=True, 
#             max_num_faces=1, 
#             refine_landmarks=True, 
#             min_detection_confidence=0.5
#         )
#         logging.info("FaceProcessor initialized with MediaPipe Face Mesh for pose filtering.")

#     def process_frame(self, frame, frame_counter):
#         """
#         Processes a single frame to detect, filter, and recognize faces.
#         """
#         process_every = self.config.getint('Performance', 'process_every_n_frames')
#         if frame_counter % process_every != 0:
#             return frame

#         h_orig, w_orig = frame.shape[:2]
#         inference_frame = cv2.resize(frame, (640, 360))
#         h_inf, w_inf = inference_frame.shape[:2]

#         try:
#             results = self.yolo_model(inference_frame, conf=self.yolo_conf, verbose=False)
#             for r in results:
#                 for box in r.boxes:
#                     x1_s, y1_s, x2_s, y2_s = map(int, box.xyxy[0].cpu().numpy())
#                     x1, y1 = int(x1_s * w_orig / w_inf), int(y1_s * h_orig / h_inf)
#                     x2, y2 = int(x2_s * w_orig / w_inf), int(y2_s * h_orig / h_inf)
#                     yolo_confidence = box.conf.item()

#                     pad_y1, pad_x1 = max(0, y1 - self.padding), max(0, x1 - self.padding)
#                     pad_y2, pad_x2 = min(h_orig, y2 + self.padding), min(w_orig, x2 + self.padding)
#                     face = frame[pad_y1:pad_y2, pad_x1:pad_x2]

#                     if face.size == 0:
#                         continue
                    
#                     # --- QUALITY CONTROL GAUNTLET ---
                    
#                     # 1. SIZE FILTER
#                     face_h, face_w = face.shape[:2]
#                     if face_w < self.min_face_size or face_h < self.min_face_size:
#                         cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 165, 0), 2) # Orange
#                         cv2.putText(frame, "Too Small", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 165, 0), 2)
#                         continue 

#                     # 2. BLUR FILTER
#                     blur_score = self._get_blur_score(face)
#                     if blur_score < self.blur_thresh:
#                         cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 165, 255), 2) # Orange
#                         cv2.putText(frame, f"Blurry: {blur_score:.0f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
#                         continue 

#                     # 3. POSE FILTER (solvePnP)
#                     yaw, pitch, pose_success = self._get_head_pose(face, (h_orig, w_orig))
                    
#                     if not pose_success:
#                         cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2) # Cyan
#                         cv2.putText(frame, "No Mesh", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
#                         continue 
                    
#                     if abs(yaw) > self.yaw_thresh or abs(pitch) > self.pitch_thresh:
#                         cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 255), 2) # Orange
#                         cv2.putText(frame, f"Bad Angle (Y:{yaw:.0f} P:{pitch:.0f})", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 200, 255), 2)
#                         continue 
                    
#                     # --- All filters passed. Proceed with recognition. ---
#                     self._recognize_and_draw(frame, face, (x1, y1, x2, y2), yolo_confidence)

#         except Exception as e:
#             logging.error(f"Error during frame processing: {e}", exc_info=True)
#         return frame

#     def _get_blur_score(self, face_image):
#         """Calculates a blurriness score (Laplacian variance)."""
#         if face_image.size == 0:
#             return 0
#         try:
#             gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
#             variance = cv2.Laplacian(gray, cv2.CV_64F).var()
#             return variance
#         except cv2.error:
#             return 0

#     def _get_head_pose(self, face_image, frame_shape):
#         """Estimates head pose using MediaPipe + solvePnP. Returns yaw, pitch, and success."""
#         # Convert BGR (from OpenCV) to RGB (for MediaPipe)
#         face_rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
#         results = self.face_mesh.process(face_rgb)

#         if not results.multi_face_landmarks:
#             return None, None, False # This is the "No Mesh" condition

#         face_landmarks = results.multi_face_landmarks[0].landmark
#         h, w = face_image.shape[:2]
        
#         # 2D landmarks (image coordinates)
#         image_points = np.array([
#             (face_landmarks[1].x * w, face_landmarks[1].y * h),     # Nose tip
#             (face_landmarks[152].x * w, face_landmarks[152].y * h), # Chin
#             (face_landmarks[226].x * w, face_landmarks[226].y * h), # Left eye left corner
#             (face_landmarks[446].x * w, face_landmarks[446].y * h), # Right eye right corner
#             (face_landmarks[288].x * w, face_landmarks[288].y * h), # Left mouth corner
#             (face_landmarks[57].x * w, face_landmarks[57].y * h)    # Right mouth corner
#         ], dtype="double")

#         # 3D model points (generic model)
#         model_points = np.array([
#             (0.0, 0.0, 0.0),             # Nose tip
#             (0.0, -330.0, -65.0),        # Chin
#             (-225.0, 170.0, -135.0),     # Left eye left corner
#             (225.0, 170.0, -135.0),      # Right eye right corner
#             (-150.0, -150.0, -125.0),    # Left mouth corner
#             (150.0, -150.0, -125.0)      # Right mouth corner
#         ])

#         # Camera internals (generic, based on the *original* frame shape)
#         focal_length = frame_shape[1]
#         center = (frame_shape[1] / 2, frame_shape[0] / 2)
#         camera_matrix = np.array([
#             [focal_length, 0, center[0]],
#             [0, focal_length, center[1]],
#             [0, 0, 1]
#         ], dtype="double")

#         dist_coeffs = np.zeros((4, 1)) # Assuming no lens distortion
#         (success, rotation_vector, translation_vector) = cv2.solvePnP(
#             model_points, image_points, camera_matrix, dist_coeffs
#         )

#         (projection_matrix, _) = cv2.Rodrigues(rotation_vector)
        
#         # Decompose rotation matrix to get Euler angles
#         euler_angles = cv2.RQDecomp3x3(projection_matrix)[0]
        
#         pitch = euler_angles[0]
#         yaw = euler_angles[1]
        
#         return yaw, pitch, True

#     def _recognize_and_draw(self, frame, face, coords, yolo_conf):
#         """Helper to run recognition and annotate the frame."""
#         x1, y1, x2, y2 = coords
#         try:
#             rep = DeepFace.represent(
#                 img_path=face, 
#                 model_name="ArcFace", 
#                 enforce_detection=False,
#                 detector_backend='skip' 
#             )
#             if not rep or "embedding" not in rep[0]:
#                 logging.warning("DeepFace.represent failed to return an embedding.")
#                 return

#             face_embedding = rep[0]["embedding"]
#             sims = cosine_similarity([face_embedding], self.embeddings_db)[0]
#             best_idx = np.argmax(sims)
#             distance = 1 - sims[best_idx]

#             if distance < self.dist_thresh:
#                 name = self.names[best_idx]
#                 mark_attendance(name, yolo_conf, distance, self.config)
#                 cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
#                 cv2.putText(frame, name, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
#             else:
#                 cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
#                 cv2.putText(frame, "Unknown", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
#                 self._save_unknown_face(face)
#         except Exception as e:
#             if "Face could not be detected" in str(e):
#                 logging.warning("DeepFace failed to align face, skipping.")
#             else:
#                 logging.warning(f"Face recognition failed: {e}")

#     def _save_unknown_face(self, face):
#         """Saves an image of an unknown face, respecting the cooldown."""
#         current_time = time.time()
#         if (current_time - self.last_unknown_capture_time) > self.cooldown:
#             try:
#                 now = datetime.datetime.now()
#                 ts_display = now.strftime("%Y-%m-%d %H:%M:%S")
#                 ts_filename = now.strftime("%Y%m%d_%H%M%S")
#                 face_with_ts = face.copy()
#                 cv2.putText(face_with_ts, ts_display, (5, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
#                 filepath = os.path.join(self.unknown_path, f"unknown_{ts_filename}.jpg")
#                 cv2.imwrite(filepath, face_with_ts)
#                 logging.info(f"Saved unknown face to {filepath}")
#                 self.last_unknown_capture_time = current_time
#             except Exception as e:
#                 logging.error(f"Failed to save unknown face: {e}", exc_info=True)

#     def close(self):
#         """Releases all model resources."""
#         self.face_mesh.close()
#         logging.info("FaceProcessor resources released.")