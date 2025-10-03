# camera_service.py
import cv2
import zmq
import numpy as np
import time

# Your working RTSP URL
# RTSP_URL = "rtsp://admin:cctv@121@192.168.1.65:554/Streaming/Channels/101"
RTSP_URL = 1



def camera_service():
    print("--- Starting Camera Service ---")
    
    # Setup ZeroMQ socket to send frames
    context = zmq.Context()
    socket = context.socket(zmq.PUB)
    socket.bind("tcp://*:5555")
    print("[INFO] Camera service is ready to stream frames on tcp://*:5555")

    print(f"[INFO] Attempting to connect to camera: {RTSP_URL}")
    cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)

    if not cap.isOpened():
        print("[ERROR] CRITICAL FAILURE: Cannot open camera stream. Please check the URL and network.")
        socket.close()
        context.term()
        return

    print("✅ [SUCCESS] Camera connection established.")
    print("[INFO] Entering frame sending loop...")


    # Inside camera_service.py
    try:
        # --- NEW: Set a target FPS ---
        TARGET_FPS = 15 

        while True:
            ret, frame = cap.read()
            if not ret:
                print("[WARNING] Failed to grab frame from camera. Re-trying...")
                time.sleep(1)
                continue

            # --- NEW: Resize the frame to reduce processing load and network traffic ---
            # A width of 1280 is often a good balance of quality and performance.
            frame = cv2.resize(frame, (1280, 720))

            ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ret:
                print("[WARNING] Failed to encode frame. Skipping.")
                continue

            socket.send(buffer)

            # --- NEW: Sleep to maintain the target FPS ---
            time.sleep(1 / TARGET_FPS)

    except KeyboardInterrupt:
    
        print("\n[INFO] Shutdown signal received.")
    finally:
        print("[INFO] Cleaning up and closing camera service.")
        cap.release()
        socket.close()
        context.term()

if __name__ == '__main__':
    camera_service()