#!/usr/bin/env python3
"""
run_mediapipe.py  (Windows / cross-platform)

Standalone MediaPipe FaceMesh runner.

Outputs one JSON line per image:
{
  "ok": true,
  "bbox": [x1,y1,x2,y2],
  "landmarks": {"nose":[x,y],"chin":[x,y],
                "left_eye":[x,y],"right_eye":[x,y],
                "left_mouth":[x,y],"right_mouth":[x,y]},
  "yaw": 12.3,       # degrees  (positive = right)
  "blur": 145.8,     # Laplacian variance (higher ⇒ sharper)
  "area": 32000      # face box area in pixels
}

Modes
------
1) One-off  :  python run_mediapipe.py --img path\to\img.jpg
2) Server   :  python run_mediapipe.py --server
               Then exchange JSON lines via stdin/stdout:
               {"cmd":"process","img_path":"C:\\tmp\\crop.jpg"}
               or {"cmd":"process","img_b64":"..."}
"""

import argparse
import base64
import json
import sys
import os
import cv2
import numpy as np
import traceback

try:
    import mediapipe as mp
    mp_face = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5)
except Exception as e:
    mp_face = None
    print(json.dumps({"ok": False, "error": f"mediapipe import failed: {e}"}))
    sys.exit(1)

# ---- model constants ----
MP_IDX = {
    "nose": 1,
    "chin": 152,
    "left_eye": 33,
    "right_eye": 263,
    "left_mouth": 61,
    "right_mouth": 291,
}

MODEL_3D = np.array([
    (0.0, 0.0, 0.0),        # nose
    (0.0, -63.6, -12.5),    # chin
    (-43.3, 32.7, -26.0),   # left eye
    (43.3, 32.7, -26.0),    # right eye
    (-28.9, -28.9, -24.1),  # left mouth
    (28.9, -28.9, -24.1)    # right mouth
], dtype=np.float64)


# ---- helper fns ----
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


def _yaw_from_landmarks(lm, w, h):
    try:
        pts = np.array([
            lm["nose"], lm["chin"],
            lm["left_eye"], lm["right_eye"],
            lm["left_mouth"], lm["right_mouth"]
        ], dtype=np.float64)
        f = w
        c = (w/2, h/2)
        cam = np.array([[f, 0, c[0]], [0, f, c[1]], [0, 0, 1]], dtype=np.float64)
        ok, rvec, tvec = cv2.solvePnP(MODEL_3D, pts, cam, np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE)
        if not ok:
            return None
        R, _ = cv2.Rodrigues(rvec)
        sy = np.sqrt(R[0, 0]**2 + R[1, 0]**2)
        if sy < 1e-6:
            yaw = np.degrees(np.arctan2(-R[2, 0], sy))
        else:
            yaw = np.degrees(np.arctan2(-R[2, 0], sy))
        return float(yaw)
    except Exception:
        return None


def _process_image(img):
    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    res = mp_face.process(rgb)
    if not res.multi_face_landmarks:
        return {"ok": False, "error": "no_face_detected"}

    fl = res.multi_face_landmarks[0]
    xs = [p.x for p in fl.landmark]
    ys = [p.y for p in fl.landmark]
    x1, x2 = int(min(xs) * w), int(max(xs) * w)
    y1, y2 = int(min(ys) * h), int(max(ys) * h)
    bbox = [x1, y1, x2, y2]
    area = (x2 - x1) * (y2 - y1)

    lm = {k: (fl.landmark[i].x * w, fl.landmark[i].y * h) for k, i in MP_IDX.items()}
    yaw = _yaw_from_landmarks(lm, w, h)
    blur = _blur_metric(img)

    return {
        "ok": True,
        "bbox": bbox,
        "landmarks": {k: [float(v[0]), float(v[1])] for k, v in lm.items()},
        "yaw": yaw,
        "blur": blur,
        "area": int(area)
    }


# ---- server loop ----
def _server_loop():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            print(json.dumps({"ok": False, "error": "invalid_json"}))
            sys.stdout.flush()
            continue
        try:
            if "img_path" in req:
                img = _load_img(path=req["img_path"])
            elif "img_b64" in req:
                img = _load_img(b64=req["img_b64"])
            else:
                print(json.dumps({"ok": False, "error": "no_image"}))
                sys.stdout.flush()
                continue
            out = _process_image(img)
        except Exception as e:
            out = {"ok": False, "error": str(e), "trace": traceback.format_exc()}
        print(json.dumps(out))
        sys.stdout.flush()


# ---- main ----
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--img", type=str, help="path to image")
    ap.add_argument("--b64", type=str, help="image base64 string")
    ap.add_argument("--server", action="store_true", help="run in stdin/stdout server mode")
    args = ap.parse_args()

    if args.server:
        _server_loop()
    else:
        try:
            img = _load_img(args.img, args.b64)
            out = _process_image(img)
            print(json.dumps(out))
        except Exception as e:
            print(json.dumps({"ok": False, "error": str(e)}))
            sys.exit(1)


if __name__ == "__main__":
    main()
