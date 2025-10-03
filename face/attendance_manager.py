import pandas as pd
import os
import datetime
import logging

class AttendanceManager:
    """
    Manages the attendance log in a pandas DataFrame and saves to CSV.
    """
    def __init__(self, config):
        self.log = logging.getLogger()
        self.csv_path = config.get('paths', 'attendance_log')
        self.cooldown_minutes = config.getint('settings', 'attendance_cooldown_minutes')
        self.csv_columns = ["Name", "Date", "Time", "YOLO_Confidence", "DeepFace_Distance"]
        self.df = self.load_or_create_dataframe()

    def load_or_create_dataframe(self):
        """Loads the attendance CSV or creates a new DataFrame if it doesn't exist."""
        if os.path.exists(self.csv_path):
            self.log.info(f"Loading existing attendance log from {self.csv_path}")
            return pd.read_csv(self.csv_path)
        else:
            self.log.info("No attendance log found. Creating a new one.")
            return pd.DataFrame(columns=self.csv_columns)

    def mark_attendance(self, name, yolo_conf, deepface_dist):
        """Marks attendance if the person hasn't been marked recently."""
        now = datetime.datetime.now()
        
        # --- Time-based Check Logic ---
        if not self.df.empty:
            df_copy = self.df.copy() # Work on a copy to avoid SettingWithCopyWarning
            df_copy['Timestamp'] = pd.to_datetime(df_copy['Date'] + ' ' + df_copy['Time'], errors='coerce')
            cooldown_period = now - datetime.timedelta(minutes=self.cooldown_minutes)
            
            recent_entries = df_copy[
                (df_copy['Name'] == name) & 
                (df_copy['Timestamp'] > cooldown_period)
            ]
            
            if not recent_entries.empty:
                # self.log.debug(f"Attendance for {name} already marked within the last {self.cooldown_minutes} minutes.")
                return

        # --- Add New Entry ---
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        yolo_conf_str = f"{yolo_conf:.2f}"
        deepface_dist_str = f"{deepface_dist:.2f}"
        
        new_entry = pd.DataFrame(
            [[name, date_str, time_str, yolo_conf_str, deepface_dist_str]],
            columns=self.csv_columns
        )
        
        self.df = pd.concat([self.df, new_entry], ignore_index=True)
        self.log.info(f"✅ Attendance Marked: {name} at {time_str} (YOLO: {yolo_conf_str}, DeepFace: {deepface_dist_str})")

    def save_log(self):
        """Saves the current DataFrame to the CSV file."""
        self.log.info(f"Saving attendance log to {self.csv_path}")
        self.df.to_csv(self.csv_path, index=False)