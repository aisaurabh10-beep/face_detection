import cv2
import time
import logging
from threading import Thread

class CameraStream:
    """
    Manages a threaded camera stream with automatic reconnection.
    """
    def __init__(self, config):
        self.log = logging.getLogger()
        self.stream_url = config.get('camera', 'url')
        try:
            # Check if the URL is a number (for webcams)
            self.stream_url = int(self.stream_url)
        except ValueError:
            pass # It's a URL string
            
        self.reconnect_delay = config.getint('settings', 'reconnect_delay_seconds')

        # Inside the __init__ method of the CameraStream class
        self.log.info("Attempting to open stream with FFmpeg backend...")
        self.cap = cv2.VideoCapture(self.stream_url, cv2.CAP_FFMPEG) # <-- ADDED BACKEND
        
        # self.cap = cv2.VideoCapture(self.stream_url)
        if not self.cap.isOpened():
            self.log.error(f"Failed to open initial camera stream at {self.stream_url}")
            
        self.grabbed, self.frame = self.cap.read()
        self.stopped = False
        
    def start(self):
        """Starts the threaded video stream."""
        self.log.info("Starting camera stream thread.")
        thread = Thread(target=self.update, args=())
        thread.daemon = True
        thread.start()
        return self

    def update(self):
        """The main loop for the camera thread."""
        while not self.stopped:
            if not self.cap.isOpened():
                self.log.warning("Stream disconnected. Attempting to reconnect...")
                self.cap.release()
                time.sleep(self.reconnect_delay)
                self.cap = cv2.VideoCapture(self.stream_url)
            else:
                self.grabbed, self.frame = self.cap.read()
                if not self.grabbed:
                    self.log.warning("Failed to grab frame. Stream may be closing.")
                    self.cap.release() # Release to trigger reconnect logic
                    
    def read(self):
        """Returns the most recent frame."""
        if not self.grabbed:
            return None
        return self.frame.copy()

    def stop(self):
        """Stops the camera thread."""
        self.log.info("Stopping camera stream.")
        self.stopped = True
        time.sleep(1) # Allow thread to finish
        self.cap.release()