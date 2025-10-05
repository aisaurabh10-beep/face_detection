import os
import logging
import pandas as pd
import datetime

def mark_attendance(name, yolo_conf, deepface_dist, config):
    """
    Records a person's attendance in a CSV file, checking for recent entries.
    
    Args:
        name (str): The name of the person.
        yolo_conf (float): The YOLO detection confidence score.
        deepface_dist (float): The DeepFace distance score.
        config: The application configuration object.
    """
    now = datetime.datetime.now()
    csv_file = config.get('Paths', 'attendance_file')
    mark_minutes = config.getint('Performance', 'attendance_mark_minutes')

    csv_columns = ["Name", "Date", "Time", "YOLO_Confidence", "DeepFace_Distance"]

    if not os.path.exists(csv_file):
        df = pd.DataFrame(columns=csv_columns)
        df.to_csv(csv_file, index=False)

    df = pd.read_csv(csv_file)
    marked_recently = False
    if not df.empty and 'Date' in df.columns:
        df['Timestamp'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], errors='coerce')
        time_limit = now - datetime.timedelta(minutes=mark_minutes)
        recent_entries = df[(df['Name'] == name) & (df['Timestamp'] > time_limit)]
        marked_recently = not recent_entries.empty

    if not marked_recently:
        new_entry = pd.DataFrame([[
            name, now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"),
            f"{yolo_conf:.2f}", f"{deepface_dist:.2f}"
        ]], columns=csv_columns)
        
        df_updated = pd.concat([df.drop(columns=['Timestamp'], errors='ignore'), new_entry], ignore_index=True)
        df_updated.to_csv(csv_file, index=False)
        logging.info(f"Attendance Marked: {name}")