import cv2, time
from config import *

class CameraHandler:
    def __init__(self):
        self.cap = None
        self.connect()

    def connect(self):
        if USE_WEBCAM:
            self.cap = cv2.VideoCapture(1)
        else:
            self.cap = cv2.VideoCapture(IP_CAMERA_URL)

    def read(self):
        ret, frame = self.cap.read()
        if not ret:
            print("❌ Frame lost. Reconnecting...")
            self.cap.release()
            time.sleep(RECONNECT_DELAY_SECONDS)
            self.connect()
            return None
        return frame

    def release(self):
        if self.cap:
            self.cap.release()
