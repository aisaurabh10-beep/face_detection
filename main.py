# main.py
import sys
import time
import logging
import signal
from datetime import datetime
from inspect import signature

import cv2

from config_loader import load_config
from logger_setup import setup_logger
from model_loader import initialize_models_and_db
from video_stream import VideoStream
from face_processor import FaceProcessor

from mediapipe_pool import MediapipePool

# Try to import AttendanceDB (recommended) or fallback to legacy mark_attendance (CSV)
try:
    from attendance_manager import AttendanceDB
    _HAS_ATTENDANCE_DB = True
except Exception:
    _HAS_ATTENDANCE_DB = False
    try:
        from attendance_manager import mark_attendance  # legacy
    except Exception:
        mark_attendance = None

STOP = False


def _signal_handler(signum, frame):
    global STOP
    logging.info("Signal received: %s", signum)
    STOP = True


def start_signals():
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)


def safe_int(s, default=None):
    try:
        return int(str(s).strip())
    except Exception:
        return default


def try_setup_logger(log_file, level):
    try:
        setup_logger(log_file, level=level)
    except TypeError:
        setup_logger(log_file)


def run_pipeline():
    start_signals()

    config = load_config()
    log_file = config.get('Paths', 'log_file', fallback='logs/attendance_app.log')
    log_level = config.get('Logging', 'level', fallback='INFO')
    try_setup_logger(log_file, log_level)
    logger = logging.getLogger(__name__)
    logger.info("Starting Attendance Pipeline")

    try:
        # note: model_loader now returns (yolo_model, embeddings, names, arcface_model, arcface_type)
        yolo_model, embeddings_db, names, arcface_model, arcface_type = initialize_models_and_db(config)
    except Exception as e:
        logging.critical(f"Failed to initialize models: {e}", exc_info=True)
        return
    
    
    # ensure embeddings_db is numpy array and normalized
    try:
        import numpy as np
        if not hasattr(embeddings_db, "shape"):
            embeddings_db = np.asarray(embeddings_db, dtype=float)
        norms = np.linalg.norm(embeddings_db, axis=1, keepdims=True) + 1e-12
        embeddings_db = embeddings_db / norms
    except Exception as e:
        logger.exception("Error normalizing embeddings_db: %s", e)

    attendance_db = None
    if _HAS_ATTENDANCE_DB:
        try:
            sig = signature(AttendanceDB.__init__)
            db_path = config.get('Paths', 'attendance_db', fallback='attendance/attendance.db')
            attendance_db = AttendanceDB(db_path)
            logger.info("AttendanceDB initialized at %s", db_path)
        except Exception as e:
            logger.exception("Failed to init AttendanceDB: %s", e)
            attendance_db = None
    else:
        logger.warning("AttendanceDB not available; using legacy CSV writer if present.")

    try:
        processor = FaceProcessor(yolo_model, embeddings_db, names, config, attendance_db=attendance_db, arcface_model=arcface_model)
    except Exception as e:
        logger.exception("Failed to create FaceProcessor: %s", e)
        return

    rtsp_url = config.get('Camera', 'rtsp_url', fallback='0').strip()
    stream_src = safe_int(rtsp_url, default=rtsp_url)

    headless = config.getboolean('Performance', 'headless', fallback=False)
    max_retries = config.getint('Performance', 'max_retries', fallback=5)
    base_delay = config.getfloat('Performance', 'reconnect_delay_seconds', fallback=2.0)

    stream = None
    started = False
    retries = 0

    while not STOP and retries <= max_retries:
        try:
            logging.info("Starting VideoStream %s attempt=%d", stream_src, retries + 1)
            stream = VideoStream(stream_src).start()
            started = True
            logging.info("Video stream started.")
            break
        except Exception as e:
            retries += 1
            delay = base_delay * (2 ** (retries - 1))
            logging.warning("VideoStream start failed: %s. Backoff %.1fs", e, delay)
            time.sleep(delay)

    if not started:
        logging.critical("Unable to start video stream after %d attempts. Exiting.", retries)
        return

    if not headless:
        try:
            cv2.namedWindow("Attendance System", cv2.WINDOW_NORMAL)
            cv2.resizeWindow("Attendance System", 960, 540)
        except Exception as e:
            logging.warning("OpenCV GUI not available: %s. Running headless.", e)
            headless = True

    frame_counter = 0
    last_fps_time = time.time()
    frames_since_fps = 0
    reconnect_count = 0

    try:
        while not STOP:
            frame = stream.read()
            if frame is None:
                reconnect_count += 1
                if reconnect_count > 30:
                    logging.warning("Repeated None frames; attempting reconnect.")
                    try:
                        stream.stop()
                    except Exception:
                        pass
                    time.sleep(min(8.0, base_delay * 2 ** (reconnect_count - 30)))
                    try:
                        stream = VideoStream(stream_src).start()
                        reconnect_count = 0
                        logging.info("Reconnected stream.")
                    except Exception as e:
                        logging.warning("Reconnect failed: %s", e)
                    continue
                time.sleep(0.01)
                continue

            reconnect_count = 0
            frame_counter += 1
            frames_since_fps += 1

            try:
                processed = processor.process_frame(frame, frame_counter)
            except Exception as e:
                logging.exception("Error processing frame %d: %s", frame_counter, e)
                processed = frame

            if not headless:
                try:
                    cv2.imshow("Attendance System", processed)
                except Exception as e:
                    logging.warning("cv2.imshow failed: %s. Entering headless mode.", e)
                    headless = True

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                logging.info("Exit requested via 'q'.")
                break

            now = time.time()
            if now - last_fps_time >= config.getfloat('Performance', 'fps_log_interval', fallback=5.0):
                fps = frames_since_fps / (now - last_fps_time + 1e-9)
                logging.info("Frames=%d fps=%.2f", frame_counter, fps)
                last_fps_time = now
                frames_since_fps = 0

    except KeyboardInterrupt:
        logging.info("KeyboardInterrupt received; shutting down.")
    finally:
        logging.info("Shutting down...")
        try:
            if stream:
                stream.stop()
        except Exception:
            logging.exception("Error stopping stream.")
        try:
            cv2.destroyAllWindows()
        except Exception:
            logging.exception("Error destroying windows.")
        try:
            if hasattr(processor, "close"):
                processor.close()
        except Exception:
            logging.exception("Error closing processor.")
        try:
            if attendance_db and hasattr(attendance_db, "stop"):
                attendance_db.stop()
        except Exception:
            logging.exception("Error stopping attendance DB.")
        logging.info("App stopped.")


if __name__ == "__main__":
    run_pipeline()
