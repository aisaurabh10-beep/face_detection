# src/model_loader.py
import os
import logging
import pickle
import torch
import tensorflow as tf
from ultralytics import YOLO
from deepface import DeepFace
from ultralytics.nn.tasks import DetectionModel
import cv2  # <-- ADDED
import numpy as np # <-- ADDED

def create_augmentations(image):
    """
    Takes one BGR image and returns a list of augmented images.
    """
    images = []
    
    # 1. The original image
    images.append(image)
    
    # 2. Flipped image
    images.append(cv2.flip(image, 1))
    
    # 3. Brighter image
    bright = np.clip(image.astype(np.float32) * 1.2, 0, 255).astype(np.uint8)
    images.append(bright)
    
    # 4. Darker image
    dark = np.clip(image.astype(np.float32) * 0.8, 0, 255).astype(np.uint8)
    images.append(dark)
    
    # 5. Slight rotation (5 degrees)
    try:
        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        M_pos = cv2.getRotationMatrix2D(center, 5, 1.0)
        M_neg = cv2.getRotationMatrix2D(center, -5, 1.0)
        
        images.append(cv2.warpAffine(image, M_pos, (w, h), borderValue=(0,0,0)))
        images.append(cv2.warpAffine(image, M_neg, (w, h), borderValue=(0,0,0)))
    except Exception:
        pass # Ignore rotation if it fails

    return images

def initialize_models_and_db(config):
    """
    Initializes AI models and loads the face embedding database, using a local cache
    to speed up subsequent startups.
    """
    yolo_path = config.get('Paths', 'yolo_model_path')
    dataset_path = config.get('Paths', 'dataset_path')
    
    # --- 1. Define the path for our custom cache file ---
    cache_path = os.path.join(dataset_path, "database_cache.pkl")

    # Configure models (YOLO and TensorFlow)
    # ... (this part is unchanged)
    torch.serialization.add_safe_globals([DetectionModel])
    model = YOLO(yolo_path)
    if torch.cuda.is_available():
        model.to('cuda')
        logging.info("YOLO model successfully moved to GPU.")
    else:
        logging.warning("PyTorch is running on CPU.")

    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            logging.info(f"TensorFlow found GPUs: {gpus}")
        except RuntimeError as e:
            logging.error(f"TensorFlow GPU configuration error: {e}")

    # --- 2. Check if a pre-computed cache file exists ---
    if os.path.exists(cache_path):
        logging.info(f"Found existing cache at {cache_path}. Loading embeddings...")
        with open(cache_path, "rb") as f:
            data = pickle.load(f)
            embeddings_db = data["embeddings"]
            names = data["names"]
        logging.info(f"Successfully loaded {len(embeddings_db)} embeddings from cache.")
        return model, embeddings_db, names

    # --- 3. If cache does not exist, compute and save it ---
    logging.warning("No cache found. Computing embeddings from scratch. This may take a while...")
    embeddings_db, names = [], []
    
    # --- *** START MODIFIED AUGMENTATION LOOP *** ---
    for person_folder in os.listdir(dataset_path):
        person_path = os.path.join(dataset_path, person_folder)
        if not os.path.isdir(person_path):
            continue
            
        logging.info(f"Processing person: {person_folder}")
        for img_file in os.listdir(person_path):
            img_path = os.path.join(person_path, img_file)
            try:
                # Read the single registration image
                original_image = cv2.imread(img_path)
                if original_image is None:
                    logging.warning(f"Could not read image: {img_path}, skipping.")
                    continue
                
                # Create a synthetic dataset from it
                augmented_images = create_augmentations(original_image)
                
                # Create an embedding for EACH augmented image
                for aug_img in augmented_images:
                    # Pass the numpy array directly to DeepFace
                    rep = DeepFace.represent(
                        img_path=aug_img, 
                        model_name="VGG-Face", # Keeping your original model
                        enforce_detection=False,
                        detector_backend='skip' # We know it's a face
                    )
                    
                    if rep and "embedding" in rep[0]:
                        embeddings_db.append(rep[0]["embedding"])
                        names.append(person_folder)
                    else:
                        logging.warning(f"Could not get embedding for an augmented image of {img_file}")

            except Exception as e:
                logging.warning(f"Could not process image {img_path}: {e}", exc_info=True)
    # --- *** END MODIFIED LOOP *** ---

    # --- 4. Save the computed data to the cache file for next time ---
    if not embeddings_db:
         logging.critical("No embeddings were generated! Check dataset path and image quality.")
         # We still return empty lists so the app can run, though it won't recognize anyone.
         return model, [], []
         
    try:
        with open(cache_path, "wb") as f:
            pickle.dump({"embeddings": np.array(embeddings_db), "names": names}, f)
        logging.info(f"Embeddings computed and saved to cache at {cache_path}")
    except Exception as e:
        logging.error(f"Could not save cache file: {e}")

    logging.info(f"Loaded {len(embeddings_db)} embeddings for {len(set(names))} unique individuals.")
    return model, np.array(embeddings_db), names # Return embeddings as numpy array