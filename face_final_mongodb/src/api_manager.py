import logging
import requests

def post_attendance(student_id: str, yolo_conf: float, deepface_dist: float, config):
    """
    Posts attendance data to a specified API endpoint.

    Args:
        student_id (str): The identifier of the person detected.
        yolo_conf (float): The YOLO detection confidence score.
        deepface_dist (float): The DeepFace distance score.
        config: The application configuration object.
        
    Returns:
        bool: True if the request was successful, False otherwise.
    """
    endpoint = config.get('API', 'attendance_endpoint')
    timeout = config.getint('API', 'request_timeout')
    
    payload = {
        "studentId": student_id,
        "confidence": float(f"{yolo_conf:.2f}"),
        "deepface_distance": float(f"{deepface_dist:.2f}")
    }
    
    try:
        response = requests.post(endpoint, json=payload, timeout=timeout)
        
        if response.status_code in [200, 201]:
            logging.info(f"Successfully posted attendance for {student_id} to API.")
            return True
        else:
            logging.error(f"API Error for {student_id}: Status {response.status_code}, Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to connect to API endpoint {endpoint}: {e}")
        return False