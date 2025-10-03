import cv2
import os

# IMPORTANT: Paste your original, non-encoded RTSP URL here.
# Double-check for any typos.
RTSP_URL = "rtsp://admin:cctv@121@192.168.1.65:554/Streaming/Channels/101"

# Forcing the FFmpeg backend is crucial
# You can also add this environment variable for more detailed logs
os.environ["OPENCV_LOG_LEVEL"] = "DEBUG"

print("Attempting to connect to camera...")
cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)

if cap.isOpened():
    print("✅ Success! Camera connection established.")
    ret, frame = cap.read()
    if ret:
        print(f"✅ Success! Frame received. Frame shape: {frame.shape}")
    else:
        print("❌ Failure! Connection opened, but failed to retrieve a frame.")
else:
    print("❌ Failure! Could not open camera stream.")

print("Releasing resources...")
cap.release()
print("Test finished.")