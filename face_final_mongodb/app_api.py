import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, Field
import os
from typing import List, Optional

# --- Machine Learning Imports ---
from deepface import DeepFace
import tensorflow as tf
# --- Add the standard PyMongo client for background tasks ---
import pymongo


# --- Configuration ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = "face_detection"
MONGO_COLLECTION_NAME = "students"
DATASET_PATH = os.getenv("DATASET_PATH", "dataset")


# --- FastAPI App Initialization ---
app = FastAPI(
    title="Face Recognition Embedding Sync API",
    description="API to trigger face embedding generation for existing students.",
    version="1.3.0"
)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Connection ---
# This async client is for the main API endpoints
client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB_NAME]
collection = db[MONGO_COLLECTION_NAME]

# --- Background Task Logic ---
def generate_and_store_embedding(student_id: str):
    """
    Finds images for a student, generates face embedding, and updates MongoDB.
    This function is designed to be run in the background.
    """
    print(f"BACKGROUND_TASK: Starting embedding generation for student_id: {student_id}")
    
    person_path = os.path.join(DATASET_PATH, student_id)
    
    if not os.path.isdir(person_path):
        print(f"BACKGROUND_TASK_ERROR: Directory not found for student_id: {student_id} at {person_path}")
        return

    image_path_to_process = None
    for img_file in os.listdir(person_path):
        if img_file.lower().endswith(('.png', '.jpg', '.jpeg')):
            image_path_to_process = os.path.join(person_path, img_file)
            break

    if not image_path_to_process:
        print(f"BACKGROUND_TASK_WARNING: No images found for student_id: {student_id}")
        return

    try:
        print(f"Processing image: {image_path_to_process}")
        embedding_obj = DeepFace.represent(
            img_path=image_path_to_process, 
            model_name="ArcFace", 
            enforce_detection=False
        )
        
        embedding = embedding_obj[0]["embedding"]
        
        # --- FIX: Use the synchronous pymongo client for background tasks ---
        # This is because background tasks run in a separate thread without an asyncio event loop.
        sync_client = pymongo.MongoClient(MONGO_URI)
        sync_db = sync_client[MONGO_DB_NAME]
        sync_collection = sync_db[MONGO_COLLECTION_NAME]
        
        # Update the student's document in MongoDB with the new embedding
        sync_collection.update_one(
            {"studentId": student_id},
            {"$set": {"embedding": embedding}}
        )
        
        print(f"BACKGROUND_TASK_SUCCESS: Successfully updated embedding for {student_id}")
        sync_client.close()

    except Exception as e:
        print(f"BACKGROUND_TASK_ERROR: Failed to process or update embedding for {student_id}. Error: {e}")


# --- FastAPI Lifespan Events ---
@app.on_event("startup")
async def startup_event():
    print("Application startup...")


# --- API Endpoints ---
@app.post("/sync-embeddings", summary="Generate embeddings for all students who are missing them")
async def sync_embeddings(background_tasks: BackgroundTasks):
    """
    Finds all students in the database where the 'embedding' field does not exist
    and starts a background task to generate it for each one.
    """
    students_to_process = 0
    cursor = collection.find({"embedding": {"$exists": False}})
    
    async for student_doc in cursor:
        student_id = student_doc.get("studentId")
        if student_id:
            background_tasks.add_task(generate_and_store_embedding, student_id)
            students_to_process += 1
            
    message = f"Started embedding generation for {students_to_process} student(s)."
    print(message)
    return JSONResponse(status_code=202, content={"message": message})


