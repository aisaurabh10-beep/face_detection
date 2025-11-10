### Gemini

# # src/run_mediapipe.py
# import argparse
# import base64
# import json
# import sys
# import os
# import cv2
# import numpy as np
# import traceback

# try:
#     import mediapipe as mp
#     mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
#         static_image_mode=True,
#         max_num_faces=1,
#         refine_landmarks=True,
#         min_detection_confidence=0.5)
# except Exception as e:
#     mp_face_mesh = None
#     # Write error as JSON and exit
#     print(json.dumps({"ok": False, "error": f"mediapipe import failed: {e}"}))
#     sys.exit(1)

# # --- Landmark and 3D Model Constants for solvePnP ---
# # These are the specific landmark indices we need from MediaPipe's 478 landmarks
# MP_LANDMARKS = {
#     "nose": 1,
#     "chin": 152,
#     "left_eye": 226,    # Left eye left corner
#     "right_eye": 446,   # Right eye right corner
#     "left_mouth": 288,  # Left mouth corner
#     "right_mouth": 57   # Right mouth corner
# }

# # A generic 3D model of a face
# # This is the standard 3D model for these landmarks
# MODEL_3D = np.array([
#     (0.0, 0.0, 0.0),             # Nose tip
#     (0.0, -330.0, -65.0),        # Chin
#     (-225.0, 170.0, -135.0),     # Left eye left corner
#     (225.0, 170.0, -135.0),      # Right eye right corner
#     (-150.0, -150.0, -125.0),    # Left mouth corner
#     (150.0, -150.0, -125.0)       # Right mouth corner
# ], dtype=np.float64)

# # --- Helper Functions ---
# def _load_img(path=None, b64=None):
#     if path:
#         img = cv2.imread(path)
#         if img is None:
#             raise RuntimeError(f"Cannot read image: {path}")
#         return img
#     if b64:
#         data = base64.b64decode(b64)
#         arr = np.frombuffer(data, np.uint8)
#         img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
#         if img is None:
#             raise RuntimeError("Cannot decode base64 image")
#         return img
#     raise RuntimeError("No image input")

# def _blur_metric(img):
#     """Calculates Laplacian variance as a blur metric."""
#     gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
#     return float(cv2.Laplacian(gray, cv2.CV_64F).var())

# def _get_pose(img_shape, landmarks_2d):
#     """
#     Estimates yaw and pitch from 2D landmarks using solvePnP.
#     """
#     try:
#         h, w = img_shape
        
#         # Camera matrix (generic)
#         focal_length = w
#         center = (w / 2, h / 2)
#         cam_matrix = np.array([
#             [focal_length, 0, center[0]],
#             [0, focal_length, center[1]],
#             [0, 0, 1]
#         ], dtype=np.float64)
        
#         # Assuming no lens distortion
#         dist_coeffs = np.zeros((4, 1)) 
        
#         (success, rvec, tvec) = cv2.solvePnP(
#             MODEL_3D, landmarks_2d, cam_matrix, dist_coeffs
#         )
        
#         if not success:
#             return None, None

#         # Get Euler angles from rotation matrix
#         R, _ = cv2.Rodrigues(rvec)

#         # Calculate angles using a stable method
#         sy = np.sqrt(R[0, 0]**2 + R[1, 0]**2)

#         if sy < 1e-6:
#             # Singular case (looking straight down)
#             pitch = np.degrees(np.arctan2(-R[2, 0], sy))
#             yaw = 0.0
#         else:
#             # Default case
#             pitch = np.degrees(np.arctan2(-R[2, 1], R[2, 2]))
#             yaw = np.degrees(np.arctan2(-R[2, 0], sy))

#         # --- THIS IS THE KEY ---
#         # The yaw calculation is often inverted.
#         # We must flip the sign to get an intuitive result.
#         yaw = -float(yaw) 

#         return float(yaw), float(pitch)
#     except Exception:
#         return None, None

# def _process_image(img):
#     """
#     Runs MediaPipe on an image and returns blur, pose, and landmarks.
#     """
#     h, w = img.shape[:2]
#     rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
#     results = mp_face_mesh.process(rgb)
    
#     if not results.multi_face_landmarks:
#         return {"ok": False, "error": "no_face_mesh_detected"}

#     fl = results.multi_face_landmarks[0].landmark
    
#     # Extract 2D landmarks for pose estimation
#     landmarks_2d = np.array([
#         (fl[MP_LANDMARKS["nose"]].x * w, fl[MP_LANDMARKS["nose"]].y * h),
#         (fl[MP_LANDMARKS["chin"]].x * w, fl[MP_LANDMARKS["chin"]].y * h),
#         (fl[MP_LANDMARKS["left_eye"]].x * w, fl[MP_LANDMARKS["left_eye"]].y * h),
#         (fl[MP_LANDMARKS["right_eye"]].x * w, fl[MP_LANDMARKS["right_eye"]].y * h),
#         (fl[MP_LANDMARKS["left_mouth"]].x * w, fl[MP_LANDMARKS["left_mouth"]].y * h),
#         (fl[MP_LANDMARKS["right_mouth"]].x * w, fl[MP_LANDMARKS["right_mouth"]].y * h)
#     ], dtype=np.float64)

#     # Extract landmarks for alignment (eye centers, nose tip)
#     # These are different from the pose landmarks
#     align_landmarks = {
#         "left_eye": (fl[33].x * w, fl[33].y * h),  # Left eye inner
#         "right_eye": (fl[263].x * w, fl[263].y * h), # Right eye inner
#         "nose": (fl[1].x * w, fl[1].y * h)      # Nose tip
#     }

#     yaw, pitch = _get_pose((h, w), landmarks_2d)
#     blur = _blur_metric(img)

#     return {
#         "ok": True,
#         "landmarks": align_landmarks,
#         "yaw": yaw,
#         "pitch": pitch,
#         "blur": blur,
#     }

# # ---- Server Loop ----
# def _server_loop():
#     """Reads JSON requests from stdin, writes JSON responses to stdout."""
#     for line in sys.stdin:
#         line = line.strip()
#         if not line:
#             continue
#         try:
#             req = json.loads(line)
#         except Exception:
#             print(json.dumps({"ok": False, "error": "invalid_json"}), flush=True)
#             continue
        
#         try:
#             if "img_path" in req:
#                 img = _load_img(path=req["img_path"])
#             elif "img_b64" in req:
#                 img = _load_img(b64=req["img_b64"])
#             else:
#                 raise RuntimeError("no_image")
            
#             out = _process_image(img)
#         except Exception as e:
#             out = {"ok": False, "error": str(e), "trace": traceback.format_exc()}
        
#         print(json.dumps(out), flush=True)

# # ---- Main ----
# def main():
#     ap = argparse.ArgumentParser()
#     ap.add_argument("--server", action="store_true", help="Run in stdin/stdout server mode")
#     args = ap.parse_args()

#     if args.server:
#         # --- THIS IS THE FIX ---
#         # Send a "ready" signal to the main process so it stops waiting
#         print(json.dumps({"ok": True, "status": "ready"}), flush=True)
#         # --- END FIX ---
        
#         _server_loop()
#     else:
#         print(json.dumps({"ok": False, "error": "must be run with --server"}))
#         sys.exit(1)

# if __name__ == "__main__":
#     main()



###GPT slightly wrong 
# src/run_mediapipe.py
import argparse
import base64
import json
import sys
import os
import cv2
import numpy as np
import traceback

# --- MediaPipe init ---
try:
    import mediapipe as mp
    mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5)
    mp_drawing = mp.solutions.drawing_utils
except Exception as e:
    mp_face_mesh = None
    print(json.dumps({"ok": False, "error": f"mediapipe import failed: {e}"}))
    sys.exit(1)

# --- Landmark and 3D Model Constants for solvePnP ---
# Use stable landmark indices (inner/outer eye corners, mouth corners, chin, nose tip)


MP_LANDMARKS = {
    "nose": 1,
    "chin": 152,
    "left_eye": 263,
    "right_eye": 33,
    "left_mouth": 291,
    "right_mouth": 61
}

MODEL_3D = np.array([
    (0.0, 0.0, 0.0),             # Nose tip
    (0.0, 63.6, -12.5),          # Chin (CORRECT: Y is positive/down)
    (-43.3, -32.7, -26.0),       # Left eye corner (CORRECT: Y is negative/up)
    (43.3, -32.7, -26.0),        # Right eye corner (CORRECT: Y is negative/up)
    (-28.9, 28.9, -24.1),        # Left mouth corner (CORRECT: Y is positive/down)
    (28.9, 28.9, -24.1)         # Right mouth corner (CORRECT: Y is positive/down)
], dtype=np.float64)

# --- Helpers ---
def _load_img(path=None, b64=None):
    if path:
        img = cv2.imread(path)
        if img is None:
            raise RuntimeError(f"Cannot read image: {path}")
        return img
    if b64:
        data = base64.b64decode(b64)
        arr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise RuntimeError("Cannot decode base64 image")
        return img
    raise RuntimeError("No image input")

def _blur_metric(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())



def _get_pose(img_shape, landmarks_2d):
    """
    landmarks_2d must be an (6,2) numpy array matching the order of MODEL_3D.
    Returns (yaw, pitch, roll) in degrees. Yaw > 0 => face turned right (camera view).
    """
    try:
        h, w = img_shape

        # Camera intrinsics (simple estimate)
        focal_length = (w + h) / 2.0
        center = (w / 2.0, h / 2.0)
        cam_matrix = np.array([
            [focal_length, 0.0, center[0]],
            [0.0, focal_length, center[1]],
            [0.0, 0.0, 1.0]
        ], dtype=np.float64)

        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        # Prepare points for solvePnP
        object_points = MODEL_3D.reshape(-1, 3).astype(np.float64)
        image_points = landmarks_2d.reshape(-1, 2).astype(np.float64)

        success, rvec, tvec = cv2.solvePnP(
            object_points,
            image_points,
            cam_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE
        )

        if not success:
            return None, None, None

        # Rotation matrix
        R, _ = cv2.Rodrigues(rvec)

        # Convert rotation matrix to Euler angles.
        # We'll use a camera-friendly convention:
        #   x -> pitch, y -> yaw, z -> roll
        sy = np.sqrt(R[0, 0] * R[0, 0] + R[1, 0] * R[1, 0])
        singular = sy < 1e-6

        if not singular:
            pitch = np.arctan2(R[2, 1], R[2, 2])      # rotation about X
            yaw = np.arctan2(-R[2, 0], sy)           # rotation about Y
            roll = np.arctan2(R[1, 0], R[0, 0])      # rotation about Z
        else:
            # Gimbal lock fallback
            pitch = np.arctan2(-R[1, 2], R[1, 1])
            yaw = np.arctan2(-R[2, 0], sy)
            roll = 0.0

        pitch_deg = float(np.degrees(pitch))
        yaw_deg = float(np.degrees(yaw))
        roll_deg = float(np.degrees(roll))



        # Correct 180° inversion for pitch if it wraps
        if pitch_deg > 90:
            pitch_deg -= 180
        elif pitch_deg < -90:
            pitch_deg += 180


        return yaw_deg, pitch_deg, roll_deg

    except Exception:
        return None, None, None


def _draw_debug(img, landmarks_2d, yaw, pitch, roll):
    """Draw landmarks, a small bounding box and angle overlay onto the image (inplace)."""
    vis = img.copy()
    h, w = img.shape[:2]

    # Draw the 2D points used by solvePnP
    for (x, y) in landmarks_2d.astype(int):
        cv2.circle(vis, (int(x), int(y)), 3, (0, 255, 0), -1)

    # Compute a bbox around the used points
    xs = landmarks_2d[:, 0]
    ys = landmarks_2d[:, 1]
    x1, y1 = int(xs.min()) - 10, int(ys.min()) - 10
    x2, y2 = int(xs.max()) + 10, int(ys.max()) + 10
    cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 255, 255), 2)

    # Overlay the angles
    text = f"Yaw: {yaw:.2f}  Pitch: {pitch:.2f}  Roll: {roll:.2f}"
    cv2.putText(vis, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

    # Optional: small axis drawing near nose
    center = (int(landmarks_2d[0, 0]), int(landmarks_2d[0, 1]))  # nose tip
    length = 40
    # X-axis (red), Y-axis (green), Z-axis (blue) - basic visual cue only
    cv2.line(vis, center, (center[0] + length, center[1]), (0, 0, 255), 2)
    cv2.line(vis, center, (center[0], center[1] - length), (0, 255, 0), 2)
    cv2.line(vis, center, (center[0] - int(length/2), center[1] + int(length/2)), (255, 0, 0), 1)

    return vis

def _process_image(img, debug_save_path=None):
    """
    Runs MediaPipe on an image and returns blur, pose, and landmarks.
    If debug_save_path is provided, save an annotated debug image there.
    """
    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = mp_face_mesh.process(rgb)

    if not results.multi_face_landmarks:
        return {"ok": False, "error": "no_face_mesh_detected"}

    fl = results.multi_face_landmarks[0].landmark

    # Build 2D points in the SAME order as MODEL_3D
    try:
        landmarks_2d = np.array([
            (fl[MP_LANDMARKS["nose"]].x * w, fl[MP_LANDMARKS["nose"]].y * h),
            (fl[MP_LANDMARKS["chin"]].x * w, fl[MP_LANDMARKS["chin"]].y * h),
            (fl[MP_LANDMARKS["left_eye"]].x * w, fl[MP_LANDMARKS["left_eye"]].y * h),
            (fl[MP_LANDMARKS["right_eye"]].x * w, fl[MP_LANDMARKS["right_eye"]].y * h),
            (fl[MP_LANDMARKS["left_mouth"]].x * w, fl[MP_LANDMARKS["left_mouth"]].y * h),
            (fl[MP_LANDMARKS["right_mouth"]].x * w, fl[MP_LANDMARKS["right_mouth"]].y * h)
        ], dtype=np.float64)
    except Exception as e:
        return {"ok": False, "error": "landmark_index_error", "detail": str(e)}

    # Also provide simple align landmarks (separate set) if needed by caller
    align_landmarks = {
        "left_eye_inner": (fl[133].x * w, fl[133].y * h) if len(fl) > 133 else None,
        "right_eye_inner": (fl[362].x * w, fl[362].y * h) if len(fl) > 362 else None,
        "nose": (fl[1].x * w, fl[1].y * h)
    }

    yaw, pitch, roll = _get_pose((h, w), landmarks_2d)
    blur = _blur_metric(img)

    out = {
        "ok": True,
        "landmarks": align_landmarks,
        "yaw": yaw,
        "pitch": pitch,
        "roll": roll,
        "blur": blur
    }

    # Save debug visualization if requested
    if debug_save_path:
        try:
            vis = _draw_debug(img, landmarks_2d, yaw if yaw is not None else 0.0,
                              pitch if pitch is not None else 0.0,
                              roll if roll is not None else 0.0)
            # Ensure directory exists
            os.makedirs(os.path.dirname(debug_save_path) or ".", exist_ok=True)
            cv2.imwrite(debug_save_path, vis)
            out["debug_save"] = debug_save_path
        except Exception as e:
            out["debug_save_error"] = str(e)

    return out

# ---- Server Loop ----
def _server_loop():
    """Reads JSON requests from stdin, writes JSON responses to stdout."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            print(json.dumps({"ok": False, "error": "invalid_json"}), flush=True)
            continue

        try:
            # Input image
            if "img_path" in req:
                img = _load_img(path=req["img_path"])
            elif "img_b64" in req:
                img = _load_img(b64=req["img_b64"])
            else:
                raise RuntimeError("no_image")

            debug_save = req.get("debug_save")  # optional: path to save annotated image
            out = _process_image(img, debug_save_path=debug_save)
        except Exception as e:
            out = {"ok": False, "error": str(e), "trace": traceback.format_exc()}

        print(json.dumps(out), flush=True)

# ---- Main ----
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", action="store_true", help="Run in stdin/stdout server mode")
    args = ap.parse_args()

    if args.server:
        # ready signal for caller
        print(json.dumps({"ok": True, "status": "ready"}), flush=True)
        _server_loop()
    else:
        print(json.dumps({"ok": False, "error": "must be run with --server"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
