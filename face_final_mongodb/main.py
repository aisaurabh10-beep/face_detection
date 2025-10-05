import cv2
import time
import logging
from src.config_loader import load_config
from src.logger_setup import setup_logger
from src.model_loader import initialize_models_and_db
from src.video_stream import VideoStream
from src.face_processor import FaceProcessor

def run_pipeline():
    """Initializes and runs the main face recognition pipeline."""
    # 1. Load Configuration and Setup Logger
    config = load_config()
    setup_logger(config.get('Paths', 'log_file'))
    logging.info("Application starting...")

    # 2. Initialize Models and Face Database
    try:
        yolo_model, embeddings_db, names = initialize_models_and_db(config)
    except Exception as e:
        logging.critical(f"Failed to initialize models: {e}", exc_info=True)
        return

    # 3. Setup Pipeline Components
    processor = FaceProcessor(yolo_model, embeddings_db, names, config)
    rtsp_url = config.get('Camera', 'rtsp_url')
    # Check if URL is a number (for webcam)
    stream_src = int(rtsp_url) if rtsp_url.isdigit() else rtsp_url
    
    stream = None
    try:
        stream = VideoStream(stream_src).start()
        logging.info("Video stream started successfully.")
    except IOError as e:
        logging.critical(f"Failed to start video stream: {e}")
        return
        
    cv2.namedWindow("Attendance System", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Attendance System", 640, 360)
    
    frame_counter = 0
    # 4. Main Loop
    while True:
        frame = stream.read()
        if frame is None:
            logging.warning("Empty frame received. Waiting for stream...")
            time.sleep(config.getfloat('Performance', 'reconnect_delay_seconds'))
            continue

        frame_counter += 1
        processed_frame = processor.process_frame(frame, frame_counter)
        cv2.imshow("Attendance System", processed_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            logging.info("Exit signal received. Shutting down.")
            break
            
    # 5. Cleanup
    if stream:
        stream.stop()
    cv2.destroyAllWindows()
    logging.info("Application shut down successfully.")

if __name__ == "__main__":
    run_pipeline()