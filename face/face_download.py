import os
import shutil
import random
from sklearn.datasets import fetch_lfw_people

# Step 1: Download LFW dataset
print("📥 Downloading LFW dataset...")
lfw = fetch_lfw_people(color=True, funneled=True, resize=1.0, download_if_missing=True)

# Step 2: Find the base directory of LFW data
# This works across scikit-learn versions
lfw_dir = os.path.join(os.path.expanduser("~"), "scikit_learn_data", "lfw_home", "lfw_funneled")

if not os.path.exists(lfw_dir):
    raise FileNotFoundError(f"LFW images not found in {lfw_dir}")

# Step 3: Target directory
target_dir = "lfw_100_dataset"
os.makedirs(target_dir, exist_ok=True)

# Step 4: Get list of persons with >=5 images
all_persons = [p for p in os.listdir(lfw_dir) if os.path.isdir(os.path.join(lfw_dir, p))]
valid_persons = [p for p in all_persons if len(os.listdir(os.path.join(lfw_dir, p))) >= 4]

print(f"Found {len(valid_persons)} people with ≥5 images")

# Step 5: Randomly select 100 people
selected_persons = random.sample(valid_persons, 100)

# Step 6: Copy 5–6 random images per person
for person in selected_persons:
    src_folder = os.path.join(lfw_dir, person)
    dst_folder = os.path.join(target_dir, person)
    os.makedirs(dst_folder, exist_ok=True)

    images = os.listdir(src_folder)
    chosen_images = random.sample(images, min(6, len(images)))

    for img in chosen_images:
        shutil.copy(os.path.join(src_folder, img), os.path.join(dst_folder, img))

print("✅ Dataset created successfully!")
print(f"📂 Saved to: {os.path.abspath(target_dir)}")
