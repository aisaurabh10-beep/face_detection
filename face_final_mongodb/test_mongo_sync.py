# import os
# import logging
# import configparser
# import pymongo
# from deepface import DeepFace

# # --- Basic Logging Setup ---
# # This will print informative messages to your console
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# def sync_faces_to_mongodb(dataset_path, collection):
#     """
#     Scans the dataset path, computes embeddings for new images, and saves them to MongoDB.
#     """
#     logging.info("Starting synchronization of local face images with MongoDB...")
#     new_faces_added = 0
#     for person_folder in os.listdir(dataset_path):
#         person_path = os.path.join(dataset_path, person_folder)
#         if not os.path.isdir(person_path):
#             continue
            
#         for img_file in os.listdir(person_path):
#             img_path = os.path.join(person_path, img_file)
            
#             # 1. Check if this image is already in the database
#             if collection.find_one({"image_path": img_path}):
#                 continue

#             # 2. If not, process it
#             try:
#                 logging.info(f"Processing new image: {img_path}")
#                 rep = DeepFace.represent(
#                     img_path=img_path, 
#                     model_name="ArcFace", 
#                     enforce_detection=False
#                 )
                
#                 if rep and "embedding" in rep[0]:
#                     embedding_data = {
#                         "name": person_folder,
#                         "image_path": img_path,
#                         "embedding": rep[0]["embedding"]
#                     }
#                     # 3. Insert the new embedding document into MongoDB
#                     collection.insert_one(embedding_data)
#                     new_faces_added += 1
#                     logging.info(f"Successfully added '{person_folder}' from '{img_file}' to database.")

#             except Exception as e:
#                 logging.warning(f"Could not process image {img_path}: {e}")
    
#     if new_faces_added == 0:
#         logging.info("Database is already up-to-date. No new faces found.")
#     else:
#         logging.info(f"Synchronization complete. Added {new_faces_added} new face(s) to the database.")

# def load_embeddings_from_mongodb(collection):
#     """
#     Loads all face embeddings and corresponding names from the MongoDB collection.
#     """
#     logging.info("Loading known faces from MongoDB...")
#     embeddings_db = []
#     names = []
    
#     for doc in collection.find({}):
#         embeddings_db.append(doc["embedding"])
#         names.append(doc["name"])
        
#     logging.info(f"Loaded {len(embeddings_db)} embeddings for {len(set(names))} unique individuals from MongoDB.")
#     return embeddings_db, names

# # --- Main execution block for testing ---
# if __name__ == '__main__':
#     config = configparser.ConfigParser()
#     config.read('config.ini')

#     # --- 1. Get configuration details ---
#     dataset_path = config.get('Paths', 'dataset_path')
#     mongo_uri = config.get('MongoDB', 'uri')
#     db_name = config.get('MongoDB', 'database_name')
#     collection_name = config.get('MongoDB', 'collection_name')

#     # --- 2. Connect to MongoDB ---
#     try:
#         client = pymongo.MongoClient(mongo_uri)
#         db = client[db_name]
#         collection = db[collection_name]
#         # Create an index on 'image_path' to ensure uniqueness and faster lookups
#         collection.create_index("image_path", unique=True)
#         logging.info(f"Successfully connected to MongoDB -> DB: '{db_name}', Collection: '{collection_name}'")
#     except pymongo.errors.ConnectionFailure as e:
#         logging.error(f"Could not connect to MongoDB: {e}")
#         exit() # Exit the script if we can't connect to the DB

#     # --- 3. Run the synchronization process ---
#     print("\n--- RUNNING SYNC ---")
#     sync_faces_to_mongodb(dataset_path, collection)

#     # --- 4. Run the loading process to verify data retrieval ---
#     print("\n--- RUNNING LOAD ---")
#     db_embeddings, db_names = load_embeddings_from_mongodb(collection)

#     # --- 5. Print a summary of the results ---
#     print("\n--- TEST COMPLETE ---")
#     print(f"Total embeddings loaded from DB: {len(db_embeddings)}")
#     print(f"Total names loaded from DB: {len(db_names)}")
#     print(f"Number of unique people in DB: {len(set(db_names))}")