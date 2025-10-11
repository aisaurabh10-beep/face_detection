import os
import random
import datetime
from pymongo import MongoClient

# === MongoDB Connection ===
client = MongoClient("mongodb://localhost:27017/")  # change if needed
db = client["attendance_poc"]
students_collection = db["students"]

# === Dataset Path ===
dataset_dir = "lfw_100_dataset"  # folder created earlier

# === Helper function ===
def random_phone():
    return "9" + "".join([str(random.randint(0, 9)) for _ in range(9)])

# === Prepare Data ===
folders = [f for f in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, f))]

for idx, person in enumerate(folders, start=1):
    # Split name into first + last
    parts = person.split("_")
    first_name = parts[0].capitalize()
    last_name = parts[1].capitalize() if len(parts) > 1 else ""

    student_id = str(200 + idx)  # e.g., 201, 202, ...
    email = f"{first_name.lower()}{last_name.lower()}@example.com"
    roll_number = str(idx)
    photos_dir = f"uploads/students/{student_id}"

    # Get photo list (simulate upload path)
    photo_files = os.listdir(os.path.join(dataset_dir, person))
    photos = [{"photoDir": os.path.join(photos_dir, file).replace("\\", "/")} for file in photo_files]

    doc = {
        "studentId": student_id,
        "firstName": first_name,
        "lastName": last_name,
        "email": email,
        "phone": random_phone(),
        "class": f"Class {random.randint(1, 12)}",
        "division": random.choice(["A", "B", "C"]),
        "rollNumber": roll_number,
        "photos": photos,
        "isActive": True,
        "createdAt": datetime.datetime.utcnow(),
        "updatedAt": datetime.datetime.utcnow(),
        "__v": 0
    }

    # Insert into MongoDB
    students_collection.insert_one(doc)
    print(f"✅ Inserted: {first_name} {last_name}")

print("\n🎉 All student records inserted successfully!")
