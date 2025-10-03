import cv2
import time
import configparser
import sys
from logger_setup import setup_logger
from face_processor import FaceProcessor
from attendance_manager import AttendanceManager

def main():
    """A single-threaded test to isolate the final point of failure."""
    log = setup_logger()

    config = configparser.ConfigParser(interpolation=None)
    config.read('config.ini')

    # --- Step 1: Load AI Models First ---
    log.info("Loading AI models (FaceProcessor)...")
    try:
        face_proc = FaceProcessor(config)
        att_manager = AttendanceManager(config)
    except Exception as e:
        log.error(f"Failed to initialize AI models or attendance manager: {e}", exc_info=True)
        sys.exit(1)
    log.info("✅ AI models loaded successfully.")

    # --- Step 2: Now, Try to Connect to the Camera ---
    stream_url = config.get('camera', 'url')
    log.info(f"Attempting to connect to camera at {stream_url}...")
    cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)

    if not cap.isOpened():
        log.error("❌ CRITICAL FAILURE: Could not open camera stream in the single-process test.")
        log.error("This points to a deep conflict or a security block. Check your antivirus/firewall.")
        sys.exit(1)

    log.info("✅ SUCCESS: Camera connection established in single-process test.")

    WINDOW_NAME = "Final Test"
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)

    # --- Main Loop ---
    while True:
        ret, frame = cap.read()
        if not ret:
            log.warning("Failed to grab frame. Exiting.")
            break

        # We don't need to run the heavy AI process for this test,
        # just need to confirm we can continuously get frames.
        # You can uncomment the line below to test with full processing.
        # frame = face_proc.process_frame(frame, att_manager)

        cv2.putText(frame, "SUCCESS: Receiving Frames", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.imshow(WINDOW_NAME, frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    log.info("Cleaning up...")
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()