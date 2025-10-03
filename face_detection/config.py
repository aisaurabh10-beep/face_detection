import os

# Camera Config
# IP_CAMERA_URL = "rtsp://admin:cctv@121@192.168.1.65:554/Streaming/Channels/101"
IP_CAMERA_URL = 1

USE_WEBCAM = True   # Switch between webcam and RTSP stream

# Model Paths
YOLO_MODEL_PATH = "yolov8n-face-lindevs.pt"
DATASET_PATH = "dataset/"
UNKNOWN_FACES_PATH = "unknown_faces/"

# Thresholds
YOLO_CONF_THRESHOLD = 0.7
DEEPFACE_DISTANCE_THRESHOLD = 0.6
PROCESS_EVERY_N_FRAMES = 5
UNKNOWN_CAPTURE_COOLDOWN = 10.0
PADDING = 100

# Attendance
ATTENDANCE_FILE = "attendance.csv"
TIME_THRESHOLD_MINUTES = 5

# UI
WINDOW_NAME = "IP Camera Attendance System"
FRAME_WIDTH = 640
FRAME_HEIGHT = 320

# Reconnect Logic
RECONNECT_DELAY_SECONDS = 5

# Ensure directories exist
os.makedirs(UNKNOWN_FACES_PATH, exist_ok=True)
