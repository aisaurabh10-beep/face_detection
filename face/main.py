import cv2
import time
import signal
import sys
import configparser
from multiprocessing import Process, Queue
from logger_setup import setup_logger
from camera_process import camera_worker # <-- NEW IMPORT
from face_processor import FaceProcessor
from attendance_manager import AttendanceManager

# --- Global variable to signal exit ---
keep_running = True
camera_process = None

def signal_handler(sig, frame):
    """Handles Ctrl+C to gracefully shut down the application."""
    global keep_running
    log = setup_logger()
    log.info("Shutdown signal received. Exiting gracefully...")
    keep_running = False

def main():
    global camera_process
    """Main function to run the attendance system."""
    # --- Setup ---
    signal.signal(signal.SIGINT, signal_handler)
    log = setup_logger()

    config = configparser.ConfigParser(interpolation=None)
    config.read('config.ini')
    config_path = 'config.ini' # Pass path to the child process

    # --- Initialization ---
    log.info("Initializing components...")

    log.info("Loading AI models (FaceProcessor)...")
    face_proc = FaceProcessor(config)
    att_manager = AttendanceManager(config)

    # --- NEW: Start the camera process ---
    log.info("Starting camera process...")
    # A small queue size (e.g., 1 or 2) ensures we get the most recent frames
    frame_queue = Queue(maxsize=2)
    camera_process = Process(target=camera_worker, args=(frame_queue, config_path), daemon=True)
    camera_process.start()

    # --- Wait for the first frame to ensure the connection is live ---
    log.info("Waiting for camera process to deliver the first frame...")
    # Add a timeout to prevent waiting forever if the camera never connects
    try:
        frame = frame_queue.get(timeout=20.0) # Wait up to 20 seconds
    except Exception:
        log.error("Camera process failed to deliver a frame within the timeout.")
        log.error("Check the camera URL and network connection.")
        camera_process.terminate()
        sys.exit(1)
    log.info("✅ Camera process is ready and streaming.")

    WINDOW_NAME = "IP Camera Attendance System"
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, 960, 540) # Adjusted for better viewing

    frame_counter = 0
    process_every_n_frames = config.getint('settings', 'process_every_n_frames')

    # --- Main Loop ---
    log.info("Starting main application loop...")
    while keep_running:
        try:
            # Get the latest frame from the queue. It will wait if the queue is empty.
            frame = frame_queue.get(timeout=5.0)
        except Exception:
            log.warning("Did not receive a frame from the camera process in time.")
            continue

        frame_counter += 1
        display_frame = frame.copy()

        if frame_counter % process_every_n_frames == 0:
            try:
                display_frame = face_proc.process_frame(frame, att_manager)
            except Exception as e:
                log.error(f"An error occurred in the processing loop: {e}", exc_info=True)

        cv2.imshow(WINDOW_NAME, display_frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            log.info("'q' key pressed. Exiting.")
            break

    # --- Cleanup ---
    log.info("Cleaning up resources...")
    if camera_process:
        camera_process.terminate() # Forcefully stop the camera process
    att_manager.save_log()
    cv2.destroyAllWindows()
    log.info("Application shut down successfully.")

if __name__ == '__main__':
    # This is required for multiprocessing on Windows
    main()