import os
import logging
import torch
import tensorflow as tf
from ultralytics import YOLO
from deepface import DeepFace
from ultralytics.nn.tasks import DetectionModel

def initialize_models_and_db(config):
    """
    Initializes the environment, loads AI models, and pre-computes face embeddings.
    
    Args:
        config: The application configuration object.
        
    Returns:
        A tuple containing the loaded YOLO model, a list of face embeddings, and a list of names.
    """
    yolo_path = config.get('Paths', 'yolo_model_path')
    dataset_path = config.get('Paths', 'dataset_path')

    # Configure YOLO (PyTorch)
    torch.serialization.add_safe_globals([DetectionModel])
    model = YOLO(yolo_path)
    if torch.cuda.is_available():
        model.to('cuda')
        logging.info("YOLO model successfully moved to GPU.")
    else:
        logging.warning("PyTorch is running on CPU. Performance may be degraded.")

    # Configure TensorFlow GPU (used by DeepFace)
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            logging.info(f"TensorFlow found GPUs: {gpus}")
        except RuntimeError as e:
            logging.error(f"TensorFlow GPU configuration error: {e}")

    # Pre-compute embeddings for known faces
    logging.info("Loading known faces and computing embeddings...")
    embeddings_db, names = [], []
    for person_folder in os.listdir(dataset_path):
        person_path = os.path.join(dataset_path, person_folder)
        if not os.path.isdir(person_path):
            continue
        for img_file in os.listdir(person_path):
            img_path = os.path.join(person_path, img_file)
            try:
                rep = DeepFace.represent(img_path=img_path, model_name="ArcFace", enforce_detection=False)
                if rep and "embedding" in rep[0]:
                    embeddings_db.append(rep[0]["embedding"])
                    names.append(person_folder)
            except Exception as e:
                logging.warning(f"Could not process image {img_path}: {e}")
    
    logging.info(f"Loaded {len(embeddings_db)} embeddings for {len(set(names))} unique individuals.")
    return model, embeddings_db, names