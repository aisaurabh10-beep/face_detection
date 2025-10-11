# import os
# import logging
# import torch
# import tensorflow as tf
# import pymongo
# from ultralytics import YOLO
# from deepface import DeepFace
# from ultralytics.nn.tasks import DetectionModel

# def load_embeddings_from_mongodb(collection):
#     """
#     Loads all face embeddings and corresponding names from the MongoDB collection.
#     """
#     embeddings_db = []
#     names = []
#     try:
#         for doc in collection.find({}):
#             embeddings_db.append(doc["embedding"])
#             names.append(doc["studentId"])
#             # names.append(doc["_id"])

#         logging.info(f"Loaded {len(embeddings_db)} embeddings for {len(set(names))} unique individuals from MongoDB.")
#     except pymongo.errors.PyMongoError as e:
#         logging.error(f"Error loading data from MongoDB: {e}")
#     return embeddings_db, names

# def initialize_models_and_db(config):
#     """
#     Initializes AI models and loads the face embedding database from MongoDB.
#     """
#     yolo_path = config.get('Paths', 'yolo_model_path')

#     # Configure YOLO (PyTorch)
#     torch.serialization.add_safe_globals([DetectionModel])
#     model = YOLO(yolo_path)
#     if torch.cuda.is_available():
#         model.to('cuda')
#         logging.info("YOLO model successfully moved to GPU.")
#     else:
#         logging.warning("PyTorch is running on CPU. Performance may be degraded.")

#     # Configure TensorFlow GPU (used by DeepFace)
#     gpus = tf.config.list_physical_devices('GPU')
#     if gpus:
#         try:
#             for gpu in gpus:
#                 tf.config.experimental.set_memory_growth(gpu, True)
#             logging.info(f"TensorFlow found GPUs: {gpus}")
#         except RuntimeError as e:
#             logging.error(f"TensorFlow GPU configuration error: {e}")

#     # --- Load face embeddings from MongoDB ---
#     mongo_uri = config.get('MongoDB', 'uri')
#     db_name = config.get('MongoDB', 'database_name')
#     collection_name = config.get('MongoDB', 'collection_name')
    
#     try:
#         client = pymongo.MongoClient(mongo_uri)
#         db = client[db_name]
#         collection = db[collection_name]
#         logging.info(f"Successfully connected to MongoDB for data retrieval.")
#     except pymongo.errors.ConnectionFailure as e:
#         logging.critical(f"Could not connect to MongoDB to load face data: {e}")
#         # Return empty data to allow the program to potentially exit gracefully
#         return model, [], []

#     embeddings_db, names = load_embeddings_from_mongodb(collection)
    
#     if not embeddings_db:
#         logging.warning("No face embeddings found in the database. Recognition will not work.")
#         logging.warning("Please run the sync_db.py script to populate the database.")
        
#     return model, embeddings_db, names




import os
import logging
import pickle
import torch
import tensorflow as tf
import pymongo
from ultralytics import YOLO
from deepface import DeepFace
from ultralytics.nn.tasks import DetectionModel

def _load_from_mongodb(collection):
    """Helper function to fetch all embeddings from the database."""
    logging.info("Fetching all embeddings from MongoDB...")
    embeddings_db = []
    names = []
    try:
        for doc in collection.find({}):
            embeddings_db.append(doc["embedding"])
            # Ensure you are fetching the correct field for the name
            # In sync_db.py it was 'name', but you had 'studentId' here.
            # Using 'name' to be consistent with sync_db.py
            names.append(doc["studentId"])
        logging.info(f"Successfully fetched {len(embeddings_db)} embeddings from MongoDB.")
    except pymongo.errors.PyMongoError as e:
        logging.error(f"Error loading data from MongoDB: {e}")
    return embeddings_db, names

def initialize_models_and_db(config):
    """
    Initializes AI models and loads face embeddings, using MongoDB as the source
    and a local .pkl file as a cache for fast startups.
    """
    yolo_path = config.get('Paths', 'yolo_model_path')
    dataset_path = config.get('Paths', 'dataset_path')
    cache_path = os.path.join(dataset_path, "database_cache.pkl")

    # --- Configure Models (YOLO and TensorFlow) ---
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

    # --- HYBRID CACHE LOGIC ---

    # 1. Connect to MongoDB to get the definitive document count
    mongo_uri = config.get('MongoDB', 'uri')
    db_name = config.get('MongoDB', 'database_name')
    collection_name = config.get('MongoDB', 'collection_name')
    try:
        client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        collection = db[collection_name]
        db_count = collection.count_documents({})
        logging.info(f"MongoDB contains {db_count} face embeddings.")
    except pymongo.errors.ConnectionFailure as e:
        logging.critical(f"Could not connect to MongoDB: {e}. Cannot proceed.")
        return model, [], []

    # 2. Check if a valid local cache exists
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "rb") as f:
                cached_data = pickle.load(f)
            cache_count = len(cached_data["embeddings"])

            # 3. If cache count matches DB count, use the cache
            if cache_count == db_count:
                logging.info("Local cache is up-to-date with MongoDB. Loading from cache.")
                return model, cached_data["embeddings"], cached_data["names"]
            else:
                logging.warning(f"Cache is stale (DB: {db_count}, Cache: {cache_count}). Refreshing from MongoDB.")
        except Exception as e:
            logging.warning(f"Could not read cache file ({e}). Rebuilding from MongoDB.")

    # 4. If cache is stale or missing, fetch from DB and rebuild cache
    logging.info("Rebuilding local cache from MongoDB...")
    embeddings_db, names = _load_from_mongodb(collection)
    
    if embeddings_db:
        try:
            with open(cache_path, "wb") as f:
                pickle.dump({"embeddings": embeddings_db, "names": names}, f)
            logging.info(f"Successfully rebuilt cache at {cache_path}")
        except Exception as e:
            logging.error(f"Failed to write to cache file: {e}")
    else:
        logging.warning("No data found in MongoDB to build cache. Recognition will not work.")
        
    return model, embeddings_db, names