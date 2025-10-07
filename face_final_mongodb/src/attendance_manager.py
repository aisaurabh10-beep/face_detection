import logging
import datetime
from pymongo.collection import Collection

def mark_attendance(name: str, yolo_conf: float, deepface_dist: float, collection: Collection, config):
    """
    Records a person's attendance in a MongoDB collection, checking for recent entries.

    Args:
        name (str): The name of the person.
        yolo_conf (float): The YOLO detection confidence score.
        deepface_dist (float): The DeepFace distance score.
        collection (Collection): The MongoDB collection object for attendance.
        config: The application configuration object.
    """
    now = datetime.datetime.now()
    mark_minutes = config.getint('Performance', 'attendance_mark_minutes')
    time_limit = now - datetime.timedelta(minutes=mark_minutes)

    # 1. Query MongoDB for a recent entry for this person
    recent_entry = collection.find_one({
        "name": name,
        "timestamp": {"$gt": time_limit}
    })

    # 2. If no recent entry is found, insert a new one
    if recent_entry is None:
        attendance_record = {
            "name": name,
            "timestamp": now,
            "yolo_confidence": float(f"{yolo_conf:.2f}"),
            "deepface_distance": float(f"{deepface_dist:.2f}")
        }
        collection.insert_one(attendance_record)
        logging.info(f"Attendance Marked in MongoDB for: {name}")