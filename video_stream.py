# src/video_stream.py
import cv2
import threading
import queue
import time
import logging

logger = logging.getLogger(__name__)

class VideoStream:
    def __init__(self, src=0, queue_size=4):
        self.src = src
        self.capture = None
        self.stopped = True
        self.thread = None
        self.q = queue.Queue(maxsize=queue_size)

    def start(self):
        self.capture = cv2.VideoCapture(self.src)
        if not self.capture.isOpened():
            raise IOError(f"Cannot open video source {self.src}")
        self.stopped = False
        self.thread = threading.Thread(target=self._reader, daemon=True)
        self.thread.start()
        return self

    def _reader(self):
        while not self.stopped:
            ret, frame = self.capture.read()
            if not ret or frame is None:
                time.sleep(0.02)
                continue
            try:
                if self.q.full():
                    try:
                        self.q.get_nowait()
                    except Exception:
                        pass
                self.q.put_nowait(frame)
            except Exception:
                logger.exception("Failed to enqueue frame")
        try:
            self.capture.release()
        except Exception:
            pass

    def read(self, timeout=0.02):
        try:
            return self.q.get(timeout=timeout)
        except Exception:
            return None

    def stop(self):
        self.stopped = True
        if self.thread:
            self.thread.join(timeout=1.0)
