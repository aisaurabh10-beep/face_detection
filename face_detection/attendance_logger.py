import os
import pandas as pd
import datetime
from config import ATTENDANCE_FILE, TIME_THRESHOLD_MINUTES

class AttendanceLogger:
    def __init__(self):
        self.columns = ["Name", "Date", "Time", "YOLO_Confidence", "DeepFace_Distance"]
        if not os.path.exists(ATTENDANCE_FILE):
            pd.DataFrame(columns=self.columns).to_csv(ATTENDANCE_FILE, index=False)

    def mark(self, name, yolo_conf, distance):
        now = datetime.datetime.now()
        date, time_str = now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S")
        df = pd.read_csv(ATTENDANCE_FILE)

        # Recent marking check
        if not df.empty and 'Date' in df.columns and 'Time' in df.columns:
            df['Timestamp'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], errors='coerce')
            if not df[(df['Name'] == name) & (df['Timestamp'] > now - datetime.timedelta(minutes=TIME_THRESHOLD_MINUTES))].empty:
                return  # Already marked recently

        new_entry = pd.DataFrame(
            [[name, date, time_str, f"{yolo_conf:.2f}", f"{distance:.2f}"]],
            columns=self.columns
        )
        df = pd.concat([df.drop(columns=['Timestamp'], errors='ignore'), new_entry], ignore_index=True)
        df.to_csv(ATTENDANCE_FILE, index=False)
        print(f"✅ Attendance Marked: {name} at {time_str}")
