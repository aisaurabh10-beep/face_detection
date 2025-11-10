# src/mediapipe_pool.py
import os
import json
import tempfile
import threading
import logging
import subprocess
import time
import queue
import cv2
import base64
import numpy as np
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class MediapipeWorkerProcess:
    """Manages a single persistent mediapipe --server process."""
    def __init__(self, python_exe, script_path):
        cmd = [python_exe, script_path, "--server"]
        
        creationflags = 0
        if os.name == "nt":
            creationflags = 0x08000000  # CREATE_NO_WINDOW
            
        self.proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            creationflags=creationflags
        )
        self.lock = threading.Lock()
        self._resp_q = queue.Queue()
        
        # Start reader threads for stdout and stderr
        self._stdout_thread = threading.Thread(target=self._stdout_reader, daemon=True)
        self._stderr_thread = threading.Thread(target=self._stderr_reader, daemon=True)
        self._stdout_thread.start()
        self._stderr_thread.start()
        
        # Wait for the worker to be ready
        try:
            init_resp = self._resp_q.get(timeout=10.0)
            if not init_resp.get("ok", True): # Check for init failure
                raise RuntimeError(f"MediaPipe worker failed to start: {init_resp.get('error')}")
        except queue.Empty:
            raise RuntimeError("MediaPipe worker process timed out on startup.")

    def _stdout_reader(self):
        """Reads JSON responses from stdout."""
        for line in self.proc.stdout:
            try:
                obj = json.loads(line.strip())
                self._resp_q.put(obj)
            except Exception:
                self._resp_q.put({"ok": False, "error": "invalid_json", "raw": line})

    def _stderr_reader(self):
        """Logs errors from stderr."""
        for line in self.proc.stderr:
            logger.error(f"[MediaPipeWorker] {line.strip()}")

    def process_image_b64(self, b64_string, timeout=2.0):
        """Sends a base64 image string to the worker and gets a response."""
        req = {"cmd": "process", "img_b64": b64_string}
        with self.lock:
            try:
                self.proc.stdin.write(json.dumps(req) + "\n")
                self.proc.stdin.flush()
            except Exception as e:
                logger.error(f"Failed to send request to mediapipe worker: {e}")
                return {"ok": False, "error": "pipe_write_failed"}
        
        try:
            return self._resp_q.get(timeout=timeout)
        except queue.Empty:
            logger.warning("Mediapipe worker timeout waiting for response")
            return {"ok": False, "error": "timeout"}

    def is_alive(self):
        return self.proc.poll() is None

    def terminate(self):
        try:
            self.proc.terminate()
        except Exception:
            pass

class MediapipePool:
    """Manages a pool of mediapipe workers."""
    def __init__(self, python_exe, script_path, n_workers=1, thread_workers=4):
        self.python_exe = python_exe
        self.script_path = script_path
        self.n_workers = max(1, n_workers)
        self._workers = []
        
        for i in range(self.n_workers):
            try:
                w = MediapipeWorkerProcess(python_exe, script_path)
                self._workers.append(w)
            except Exception as e:
                logger.critical(f"Failed to start mediapipe worker {i+1}/{self.n_workers}: {e}", exc_info=True)
                
        if not self._workers:
            raise RuntimeError("Could not start any Mediapipe workers.")
            
        self._executor = ThreadPoolExecutor(max_workers=thread_workers)
        self._rr = 0 # For round-robin worker selection
        self._lock = threading.Lock()

    def _choose_worker(self):
        with self._lock:
            w = self._workers[self._rr % len(self._workers)]
            self._rr += 1
            if not w.is_alive():
                logger.warning("MediaPipe worker found dead. Restarting...")
                try: w.terminate()
                except Exception: pass
                
                try:
                    nw = MediapipeWorkerProcess(self.python_exe, self.script_path)
                    self._workers[(self._rr - 1) % len(self._workers)] = nw
                    return nw
                except Exception as e:
                    logger.error(f"Failed to restart mediapipe worker: {e}")
                    # Return next worker in pool if available
                    if len(self._workers) > 1:
                        return self._choose_worker() 
                    raise RuntimeError("All mediapipe workers are dead.")
            return w

    def submit(self, crop_np):
        """
        Submits a numpy image crop to the worker pool.
        Returns a Future object.
        """
        def _task():
            try:
                # Encode numpy array to JPEG and then to base64
                _, img_encoded = cv2.imencode(".jpg", crop_np)
                b64_string = base64.b64encode(img_encoded).decode('utf-8')
                
                worker = self._choose_worker()
                res = worker.process_image_b64(b64_string, timeout=1.5)
                return res
            except Exception as e:
                logger.error(f"Mediapipe task failed: {e}", exc_info=True)
                return {"ok": False, "error": "task_exception"}

        return self._executor.submit(_task)

    def close(self):
        try:
            self._executor.shutdown(wait=False, cancel_futures=True)
        except Exception: pass
        for w in self._workers:
            try: w.terminate()
            except Exception: pass
        logger.info("MediapipePool closed.")