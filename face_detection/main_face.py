import cv2
import os
import pandas as pd
import datetime
import time
from ultralytics import YOLO
from deepface import DeepFace
import torch
import tensorflow as tf
from threading import Thread
import warnings
from ultralytics.nn.tasks import DetectionModel

# Suppress PyTorch serialization warnings for cleaner output.
warnings.filterwarnings("ignore", category=UserWarning, message="weights_only` argument is deprecated")

# --- Configuration Section ---
IP_CAMERA_URL = "rtsp://admin:cctv@121@192.168.1.65:554/Streaming/Channels/101"
YOLO_MODEL_PATH = "yolov8n-face-lindevs.pt"
DATASET_PATH = "dataset/"
UNKNOWN_FACES_PATH = "unknown_faces/"
UNKNOWN_CAPTURE_COOLDOWN = 10.0
YOLO_CONF_THRESHOLD = 0.7
DEEPFACE_DISTANCE_THRESHOLD = 0.6
WINDOW_NAME = "IP Camera Attendance System"
PROCESS_EVERY_N_FRAMES = 5
RECONNECT_DELAY_SECONDS = 5
PADDING = 40

# --- Helper Functions ---

def setup_environment():
    """Initializes environment and loads models onto GPU."""
    if not os.path.exists(UNKNOWN_FACES_PATH):
        os.makedirs(UNKNOWN_FACES_PATH)
        print(f"Created directory for unknown faces at: {UNKNOWN_FACES_PATH}")

    # Check and configure GPU for PyTorch.
    torch.serialization.add_safe_globals([DetectionModel])
    model = YOLO(YOLO_MODEL_PATH)
    if torch.cuda.is_available():
        model.to('cuda')
        print("✅ YOLO model successfully moved to GPU.")
    else:
        print("⚠️ PyTorch is running on CPU. Performance may be degraded.")

    # Configure GPU for TensorFlow (used by DeepFace).
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            print(f"✅ TensorFlow found GPUs: {gpus}")
        except RuntimeError as e:
            print(f"❌ TensorFlow GPU configuration error: {e}")
    return model

def mark_attendance(name, yolo_confidence, deepface_distance):
    """Records a person's attendance in a CSV file."""
    now = datetime.datetime.now()
    date = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")
    csv_file = "attendance.csv"
    csv_columns = ["Name", "Date", "Time", "YOLO_Confidence", "DeepFace_Distance"]

    if not os.path.exists(csv_file):
        df = pd.DataFrame(columns=csv_columns)
        df.to_csv(csv_file, index=False)

    df = pd.read_csv(csv_file)
    marked_recently = False
    if not df.empty and 'Date' in df.columns:
        df['Timestamp'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], errors='coerce')
        five_minutes_ago = now - datetime.timedelta(minutes=5)
        marked_recently = not df[(df['Name'] == name) & (df['Timestamp'] > five_minutes_ago)].empty

    if not marked_recently:
        yolo_conf_str = f"{yolo_confidence:.2f}"
        deepface_dist_str = f"{deepface_distance:.2f}"
        new_entry = pd.DataFrame([[name, date, time_str, yolo_conf_str, deepface_dist_str]], columns=csv_columns)
        df_updated = pd.concat([df.drop(columns=['Timestamp'], errors='ignore'), new_entry], ignore_index=True)
        df_updated.to_csv(csv_file, index=False)
        print(f"✅ Attendance Marked: {name} at {time_str} (YOLO: {yolo_conf_str}, DeepFace: {deepface_dist_str})")

# --- Pipeline Stages ---

class VideoInput:
    """Handles video capture in a separate thread to prevent lag."""
    def __init__(self, src):
        self.stream = cv2.VideoCapture(src, cv2.CAP_FFMPEG)
        
        if not self.stream.isOpened():
            raise IOError("Could not open video stream.")
        (self.grabbed, self.frame) = self.stream.read()
        self.stopped = False
        t = Thread(target=self.update, args=())
        t.daemon = True
        t.start()
        time.sleep(1.0) # Wait for the stream to warm up

    def update(self):
        while True:
            if self.stopped:
                break
            (self.grabbed, self.frame) = self.stream.read()
        self.stream.release()

    def read(self):
        return self.frame

    def stop(self):
        self.stopped = True

class ProcessingPipeline:
    """Manages the YOLO and DeepFace inference."""
    def __init__(self, yolo_model):
        self.yolo_model = yolo_model
        self.last_unknown_capture_time = 0

    def process_frame(self, frame, frame_counter):
        if frame_counter % PROCESS_EVERY_N_FRAMES != 0:
            return frame

        try:
            results = self.yolo_model(frame, conf=YOLO_CONF_THRESHOLD, verbose=False)

            for r in results:
                for box in r.boxes:
                    yolo_confidence = box.conf.item()
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())

                    h_orig, w_orig = frame.shape[:2]
                    pad_y1 = max(0, y1 - PADDING)
                    pad_x1 = max(0, x1 - PADDING)
                    pad_y2 = min(h_orig, y2 + PADDING)
                    pad_x2 = min(w_orig, x2 + PADDING)
                    face = frame[pad_y1:pad_y2, pad_x1:pad_x2]

                    if face.size == 0:
                        continue

                    result_df_list = DeepFace.find(img_path=face,
                                                     db_path=DATASET_PATH,
                                                     model_name="ArcFace",
                                                     enforce_detection=False,
                                                     silent=True)

                    if result_df_list and not result_df_list[0].empty:
                        best_match = result_df_list[0].iloc[0]
                        distance = best_match['distance']

                        if distance < DEEPFACE_DISTANCE_THRESHOLD:
                            identity_path = best_match['identity']
                            name = os.path.basename(os.path.dirname(identity_path))
                            mark_attendance(name, yolo_confidence, distance)
                            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                            cv2.putText(frame, name, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
                        else:
                            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                            cv2.putText(frame, "Unknown", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                            
                            current_time = time.time()
                            if (current_time - self.last_unknown_capture_time) > UNKNOWN_CAPTURE_COOLDOWN:
                                current_datetime = datetime.datetime.now()
                                timestamp_str = current_datetime.strftime("%Y%m%d_%H%M%S")
                                filename = f"unknown_{timestamp_str}.jpg"
                                filepath = os.path.join(UNKNOWN_FACES_PATH, filename)
                                cv2.imwrite(filepath, face)
                                print(f"📸 Saved unknown face to {filepath}")
                                self.last_unknown_capture_time = current_time
                    else:
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                        cv2.putText(frame, "No Match", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 0, 0), 2)

        except Exception as e:
            print(f"An error occurred during processing: {e}")
        return frame

def main():
    """Main function to run the computer vision pipeline."""
    model = setup_environment()
    processor = ProcessingPipeline(model)
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, 640, 320)

    try:
        stream = VideoInput(IP_CAMERA_URL)
        frame_counter = 0

        while True:
            frame = stream.read()
            if frame is None:
                print("❌ No frame received. Reconnecting...")
                stream.stop()
                time.sleep(RECONNECT_DELAY_SECONDS)
                stream = VideoInput(IP_CAMERA_URL)
                continue

            frame_counter += 1
            processed_frame = processor.process_frame(frame, frame_counter)
            cv2.imshow(WINDOW_NAME, processed_frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    except IOError as e:
        print(f"❌ Critical error: {e}")
    finally:
        if 'stream' in locals() and stream.stopped == False:
            stream.stop()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()