import cv2
from config import *
from camera_handler import CameraHandler
from face_recognizer import FaceRecognizer

def main():
    cam = CameraHandler()
    recognizer = FaceRecognizer()
    frame_counter = 0

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, FRAME_WIDTH, FRAME_HEIGHT)

    while True:
        frame = cam.read()
        if frame is None:
            continue

        frame_counter += 1
        if frame_counter % PROCESS_EVERY_N_FRAMES == 0:
            frame = recognizer.process_frame(frame)

        cv2.imshow(WINDOW_NAME, frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cam.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
