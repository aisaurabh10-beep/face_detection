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
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class MediapipeWorkerProcess:
    def __init__(self, python_exe, script_path, start_timeout=3.0):
        # python_exe: e.g. r"C:\mediapipe_env\Scripts\python.exe"
        # script_path: e.g. r"C:\mediapipe\run_mediapipe.py"
        cmd = [python_exe, script_path, "--server"]
        # creationflags: CREATE_NO_WINDOW prevents console window pop-up (optional)
        creationflags = 0
        if os.name == "nt":
            # 0x08000000 = CREATE_NO_WINDOW
            creationflags = 0x08000000
        self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, text=True, bufsize=1,
                                     creationflags=creationflags)
        self.lock = threading.Lock()
        self._resp_q = queue.Queue()
        self._reader_thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._reader_thread.start()
        # tiny wait for worker boot
        time.sleep(0.15)

    def _reader_loop(self):
        while True:
            line = self.proc.stdout.readline()
            if not line:
                # if process died, we break
                break
            try:
                obj = json.loads(line.strip())
            except Exception:
                obj = {"ok": False, "error": "invalid_json", "raw": line.strip()}
            self._resp_q.put(obj)

    def process_image_path(self, path, timeout=2.0):
        req = {"cmd": "process", "img_path": path}
        with self.lock:
            try:
                self.proc.stdin.write(json.dumps(req) + "\n")
                self.proc.stdin.flush()
            except Exception as e:
                logger.exception("Failed to send request to mediapipe worker: %s", e)
                return None
        try:
            return self._resp_q.get(timeout=timeout)
        except queue.Empty:
            logger.warning("Mediapipe worker timeout waiting for response")
            return None

    def is_alive(self):
        return (self.proc and (self.proc.poll() is None))

    def terminate(self):
        try:
            self.proc.terminate()
        except Exception:
            pass

class MediapipePool:
    def __init__(self, python_exe, script_path, n_workers=1, thread_workers=4, resize_max_side=320):
        self.python_exe = python_exe
        self.script_path = script_path
        self.n_workers = max(1, n_workers)
        self.resize_max_side = resize_max_side
        self._workers = []
        for _ in range(self.n_workers):
            try:
                w = MediapipeWorkerProcess(python_exe, script_path)
                self._workers.append(w)
            except Exception:
                logger.exception("Failed to start mediapipe worker")
        self._executor = ThreadPoolExecutor(max_workers=thread_workers)
        self._rr = 0
        self._lock = threading.Lock()

    def _choose_worker(self):
        with self._lock:
            if not self._workers:
                raise RuntimeError("No mediapipe workers available")
            w = self._workers[self._rr % len(self._workers)]
            self._rr += 1
            if not w.is_alive():
                logger.warning("Worker appears dead, restarting it")
                try:
                    w.terminate()
                except Exception:
                    pass
                nw = MediapipeWorkerProcess(self.python_exe, self.script_path)
                idx = (self._rr - 1) % len(self._workers)
                self._workers[idx] = nw
                return nw
            return w

    def submit(self, crop_np, resize_for_mp=True):
        """Returns a Future. crop_np: BGR numpy array."""
        if resize_for_mp and max(crop_np.shape[0], crop_np.shape[1]) > self.resize_max_side:
            scale = self.resize_max_side / max(crop_np.shape[0], crop_np.shape[1])
            crop_send = cv2.resize(crop_np, (int(crop_np.shape[1]*scale), int(crop_np.shape[0]*scale)))
        else:
            crop_send = crop_np

        def _task():
            tmp = None
            try:
                tf = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
                tmp = tf.name
                tf.close()
                cv2.imwrite(tmp, crop_send)
                worker = self._choose_worker()
                res = worker.process_image_path(tmp, timeout=1.2)
                return res
            finally:
                if tmp and os.path.exists(tmp):
                    try:
                        os.remove(tmp)
                    except Exception:
                        pass

        return self._executor.submit(_task)

    def close(self):
        try:
            self._executor.shutdown(wait=False)
        except Exception:
            pass
        for w in self._workers:
            try:
                w.terminate()
            except Exception:
                pass
