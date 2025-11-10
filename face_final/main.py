# src/main.py
import cv2
import time
import logging
import os  # <-- ADDED
import sys # <-- ADDED
from src.config_loader import load_config
from src.logger_setup import setup_logger
from src.model_loader import initialize_models_and_db
from src.video_stream import VideoStream
from src.face_processor import FaceProcessor
from src.mediapipe_pool import MediapipePool # <-- ADDED

def run_pipeline():
    """Initializes and runs the main face recognition pipeline."""
    # 1. Load Configuration and Setup Logger
    config = load_config()
    setup_logger(config.get('Paths', 'log_file'))
    logging.info("Application starting...")

    # --- *** ADDED: START MEDIAPIPE POOL *** ---
    mediapipe_pool = None
    try:
        # !!! YOU MUST SET THIS PATH !!!
        # This MUST be the full path to the python.exe inside your *MediaPipe* Conda environment
        # Example (Windows): "C:\\Users\\YourUser\\anaconda3\\envs\\worker_app\\python.exe"

      
        MEDIAPIPE_PYTHON_EXE = "C:\\Users\\Frames\\anaconda3\\envs\\visionpipe\\python.exe" # <--- !!! EDIT THIS LINE !!!
        MEDIAPIPE_SCRIPT_PATH = "src/run_mediapipe.py" 

        if not os.path.exists(MEDIAPIPE_PYTHON_EXE):
            logging.critical(f"MediaPipe Python not found at: {MEDIAPIPE_PYTHON_EXE}")
            logging.critical("Please set MEDIAPIPE_PYTHON_EXE in main.py")
            return
            
        logging.info(f"Starting MediapipePool using {MEDIAPIPE_PYTHON_EXE}")
        mediapipe_pool = MediapipePool(
            python_exe=MEDIAPIPE_PYTHON_EXE,
            script_path=MEDIAPIPE_SCRIPT_PATH,
            n_workers=1 # One worker is usually enough
        )
    except Exception as e:
        logging.critical(f"Failed to start MediapipePool: {e}", exc_info=True)
        return
    # --- *** END MEDIAPIPE POOL *** ---

    # 2. Initialize Models and Face Database
    try:
        yolo_model, embeddings_db, names = initialize_models_and_db(config)
    except Exception as e:
        logging.critical(f"Failed to initialize models: {e}", exc_info=True)
        if mediapipe_pool:
            mediapipe_pool.close()
        return
        
    if len(names) == 0:
        logging.warning("Database is empty. The system will only detect 'Unknown' faces.")

    # 3. Setup Pipeline Components
    # --- *** MODIFIED: Pass the pool to the processor *** ---
    processor = FaceProcessor(yolo_model, embeddings_db, names, config, mediapipe_pool)
    
    rtsp_url = config.get('Camera', 'rtsp_url')
    stream_src = int(rtsp_url) if rtsp_url.isdigit() else rtsp_url
    
    stream = None
    try:
        stream = VideoStream(stream_src).start()
        logging.info("Video stream started successfully.")
    except IOError as e:
        logging.critical(f"Failed to start video stream: {e}")
        if mediapipe_pool:
            mediapipe_pool.close()
        return
        
    cv2.namedWindow("Attendance System", cv2.WINDOW_NORMAL)
    # Resize to a reasonable default
    cv2.resizeWindow("Attendance System", 960, 540) 
    
    frame_counter = 0
    
    # 4. Main Loop (Wrapped in try...finally for cleanup)
    try:
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
                
    except KeyboardInterrupt:
        logging.info("Keyboard interrupt received. Shutting down.")
        
    finally:
        # 5. Cleanup
        if stream:
            stream.stop()
            logging.info("Video stream stopped.")
        if mediapipe_pool:
            mediapipe_pool.close() # <-- ADDED
            logging.info("MediaPipe pool shut down.")
            
        cv2.destroyAllWindows()
        logging.info("Application shut down successfully.")

if __name__ == "__main__":
    run_pipeline()