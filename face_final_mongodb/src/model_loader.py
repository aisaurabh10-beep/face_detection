import os
import logging
import torch
import tensorflow as tf
import pymongo
from ultralytics import YOLO
from deepface import DeepFace
from ultralytics.nn.tasks import DetectionModel

def load_embeddings_from_mongodb(collection):
    """
    Loads all face embeddings and corresponding names from the MongoDB collection.
    """
    embeddings_db = []
    names = []
    try:
        for doc in collection.find({}):
            embeddings_db.append(doc["embedding"])
            names.append(doc["studentId"])
            # names.append(doc["_id"])

        logging.info(f"Loaded {len(embeddings_db)} embeddings for {len(set(names))} unique individuals from MongoDB.")
    except pymongo.errors.PyMongoError as e:
        logging.error(f"Error loading data from MongoDB: {e}")
    return embeddings_db, names

def initialize_models_and_db(config):
    """
    Initializes AI models and loads the face embedding database from MongoDB.
    """
    yolo_path = config.get('Paths', 'yolo_model_path')

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

    # --- Load face embeddings from MongoDB ---
    mongo_uri = config.get('MongoDB', 'uri')
    db_name = config.get('MongoDB', 'database_name')
    collection_name = config.get('MongoDB', 'collection_name')
    
    try:
        client = pymongo.MongoClient(mongo_uri)
        db = client[db_name]
        collection = db[collection_name]
        logging.info(f"Successfully connected to MongoDB for data retrieval.")
    except pymongo.errors.ConnectionFailure as e:
        logging.critical(f"Could not connect to MongoDB to load face data: {e}")
        # Return empty data to allow the program to potentially exit gracefully
        return model, [], []

    embeddings_db, names = load_embeddings_from_mongodb(collection)
    
    if not embeddings_db:
        logging.warning("No face embeddings found in the database. Recognition will not work.")
        logging.warning("Please run the sync_db.py script to populate the database.")
        
    return model, embeddings_db, names