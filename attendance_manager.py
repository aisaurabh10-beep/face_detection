# src/attendance_manager.py
import sqlite3
import threading
import queue
import os
import logging
import time
from datetime import datetime

logger = logging.getLogger(__name__)

class AttendanceDB:
    def __init__(self, db_path="attendance/attendance.db"):
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self.db_path = db_path
        self.q = queue.Queue()
        self._stop = False
        self._thread = threading.Thread(target=self._writer, daemon=True)
        self._ensure_db()
        self._thread.start()

    def _ensure_db(self):
        con = sqlite3.connect(self.db_path)
        cur = con.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                timestamp TEXT,
                yolo_conf REAL,
                deepface_dist REAL
            )
        """)
        con.commit()
        con.close()

    def mark(self, name, yolo_conf, deepface_dist, cooldown_seconds=60):
        """
        Enqueue attendance write: (name, yolo_conf, deepface_dist, cooldown_seconds, now_ts)
        """
        now_ts = time.time()
        self.q.put((name, float(yolo_conf), float(deepface_dist), float(cooldown_seconds), now_ts))

    def _writer(self):
        recent = {}  # name -> last_ts
        while not self._stop:
            try:
                item = self.q.get(timeout=0.5)
            except Exception:
                continue
            if item is None:
                break
            name, yolo_conf, deepface_dist, cooldown, ts = item
            last = recent.get(name, 0)
            if ts - last < cooldown:
                logger.debug("Skipping write for %s due to cooldown", name)
                continue
            try:
                con = sqlite3.connect(self.db_path)
                cur = con.cursor()
                cur.execute("INSERT INTO attendance (name, timestamp, yolo_conf, deepface_dist) VALUES (?, ?, ?, ?)",
                            (name, datetime.utcfromtimestamp(ts).isoformat(), yolo_conf, deepface_dist))
                con.commit()
                con.close()
                recent[name] = ts
                logger.info("Attendance recorded: %s", name)
            except Exception:
                logger.exception("Failed to write attendance for %s", name)

    def stop(self):
        self._stop = True
        if self._thread:
            self._thread.join(timeout=1.0)
