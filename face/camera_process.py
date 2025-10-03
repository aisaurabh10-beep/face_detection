import cv2
import time
import logging
import configparser

def camera_worker(queue, config_path):
    """
    The main function for the camera process.
    Connects to the camera and continuously puts frames into the queue.
    """
    # Each process needs its own logger and config setup
    log = logging.getLogger('camera_process')
    log.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    if not log.handlers:
        log.addHandler(handler)

    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)

    stream_url = config.get('camera', 'url')
    reconnect_delay = config.getint('settings', 'reconnect_delay_seconds')

    try:
        stream_url = int(stream_url)
    except ValueError:
        pass # It's a URL string

    log.info(f"Process started. Attempting to connect to {stream_url}")

    while True:
        cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)

        if not cap.isOpened():
            log.warning(f"Failed to open stream. Retrying in {reconnect_delay} seconds...")
            time.sleep(reconnect_delay)
            continue

        log.info("✅ Camera stream opened successfully.")

        while True:
            ret, frame = cap.read()
            if not ret:
                log.warning("Failed to grab frame. Reconnecting...")
                break # Break inner loop to trigger reconnection

            # If queue is full, remove the oldest frame and add the new one
            if queue.full():
                queue.get_nowait() 

            queue.put(frame)

        cap.release()
        time.sleep(reconnect_delay)