import cv2
import time
import logging
from threading import Thread

class VideoStream:
    """Handles threaded video capture to prevent I/O blocking."""
    def __init__(self, src):
        self.stream = cv2.VideoCapture(src, cv2.CAP_FFMPEG)
        # self.stream = cv2.VideoCapture(src)

        self.stream.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        if not self.stream.isOpened():
            logging.error(f"Could not open video stream at {src}")
            raise IOError(f"Could not open video stream at {src}")
            
        self.grabbed, self.frame = self.stream.read()
        self.stopped = False
        self.thread = Thread(target=self.update, args=())
        self.thread.daemon = True

    def start(self):
        """Starts the video reading thread."""
        self.thread.start()
        time.sleep(1.0) # Allow stream to warm up
        return self

    def update(self):
        """Continuously reads frames from the stream."""
        while not self.stopped:
            self.grabbed, self.frame = self.stream.read()
        self.stream.release()

    def read(self):
        """Returns the latest frame."""
        return self.frame

    def stop(self):
        """Stops the reading thread."""
        self.stopped = True
        self.thread.join()