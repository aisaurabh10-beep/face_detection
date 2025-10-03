import cv2, os, time, datetime
from ultralytics import YOLO
from deepface import DeepFace
from config import *
from attendance_logger import AttendanceLogger

class FaceRecognizer:
    def __init__(self):
        self.model = YOLO(YOLO_MODEL_PATH)
        self.logger = AttendanceLogger()
        self.last_unknown_capture_time = 0

    def process_frame(self, frame):
        results = self.model(cv2.resize(frame, (640, 360)), conf=YOLO_CONF_THRESHOLD)
        for r in results:
            for box in r.boxes:
                conf = box.conf.item()
                x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                h, w = frame.shape[:2]

                # Scale coords
                x1, y1, x2, y2 = self._scale_coords((x1,y1,x2,y2), (640,360), (w,h))
                x1,y1,x2,y2 = self._apply_padding(x1,y1,x2,y2,w,h)

                face = frame[y1:y2, x1:x2]
                if face.size == 0:
                    continue

                df_list = DeepFace.find(img_path=face, db_path=DATASET_PATH, 
                                        model_name="ArcFace", enforce_detection=False, silent=True)

                if df_list and not df_list[0].empty:
                    best = df_list[0].iloc[0]
                    distance = best['distance']
                    if distance < DEEPFACE_DISTANCE_THRESHOLD:
                        name = os.path.basename(os.path.dirname(best['identity']))
                        self.logger.mark(name, conf, distance)
                        self._draw(frame, (x1,y1,x2,y2), name, (0,255,0))
                    else:
                        self._handle_unknown(frame, face, (x1,y1,x2,y2))
                else:
                    self._handle_unknown(frame, face, (x1,y1,x2,y2))
        return frame

    def _handle_unknown(self, frame, face, coords):
        (x1,y1,x2,y2) = coords
        self._draw(frame, coords, "Unknown", (0,0,255))
        now = time.time()
        if (now - self.last_unknown_capture_time) > UNKNOWN_CAPTURE_COOLDOWN:
            ts = datetime.datetime.now()
            filename = f"unknown_{ts.strftime('%Y%m%d_%H%M%S')}.jpg"
            filepath = os.path.join(UNKNOWN_FACES_PATH, filename)
            cv2.putText(face, ts.strftime("%Y-%m-%d %H:%M:%S"), (5,20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
            cv2.imwrite(filepath, face)
            print(f"📸 Saved unknown face -> {filepath}")
            self.last_unknown_capture_time = now

    @staticmethod
    def _draw(frame, coords, label, color):
        x1,y1,x2,y2 = coords
        cv2.rectangle(frame, (x1,y1), (x2,y2), color, 2)
        cv2.putText(frame, label, (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

    @staticmethod
    def _scale_coords(coords, from_size, to_size):
        (x1,y1,x2,y2) = coords
        fw, fh = from_size
        tw, th = to_size
        return (int(x1*tw/fw), int(y1*th/fh), int(x2*tw/fw), int(y2*th/fh))

    @staticmethod
    def _apply_padding(x1,y1,x2,y2,w,h):
        return (max(0,x1-PADDING), max(0,y1-PADDING), min(w,x2+PADDING), min(h,y2+PADDING))
