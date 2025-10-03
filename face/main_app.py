# main_app.py
import cv2
import zmq
import numpy as np
import configparser
from logger_setup import setup_logger
from face_processor import FaceProcessor
from attendance_manager import AttendanceManager
# NOTICE: We DO NOT import camera_process or use VideoCapture here

def main_app():
    log = setup_logger()
    config = configparser.ConfigParser(interpolation=None)
    config.read('config.ini')

    # Load AI models - this is safe now
    log.info("Loading AI models...")
    face_proc = FaceProcessor(config)
    att_manager = AttendanceManager(config)
    log.info("AI models loaded.")

    # Connect to the camera service to receive frames
    context = zmq.Context()
    socket = context.socket(zmq.SUB)
    socket.connect("tcp://localhost:5555")

    socket.setsockopt(zmq.CONFLATE, 1) 

    socket.setsockopt_string(zmq.SUBSCRIBE, '') # Subscribe to all messages
    print("Main app connected to camera service.")

    WINDOW_NAME = "Face Recognition App"
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    
    while True:
        # Receive the frame buffer from the camera service
        buffer = socket.recv()
        
        # Decode the buffer into an image
        frame = cv2.imdecode(np.frombuffer(buffer, dtype=np.uint8), cv2.IMREAD_COLOR)

        if frame is None:
            continue

        # Now you can process the frame as before
        display_frame = face_proc.process_frame(frame, att_manager)

        cv2.imshow(WINDOW_NAME, display_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cv2.destroyAllWindows()
    socket.close()
    context.term()

if __name__ == '__main__':
    main_app()