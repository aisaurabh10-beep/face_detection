# tools/verify_mediapipe_and_arcface.py
# Usage: python tools/verify_mediapipe_and_arcface.py
# It will:
#  - iterate dataset/*/*.jpg
#  - call run_mediapipe.py --img <img>
#  - parse JSON output (bbox, landmarks, yaw, blur, area)
#  - apply thresholds and save accepted / rejected crops to out/
#  - optionally compute arcface embedding (ONNX) and compare to cache

import os
import json
import subprocess
import sys
import shutil
from pathlib import Path
import cv2
import numpy as np
import traceback

# CONFIG — change as needed
PROJECT = Path(__file__).resolve().parents[1]
RUN_MP = PROJECT / "run_mediapipe.py"      # path to your server script (one-off usage)
PY_MP = sys.executable                      # use current python to run the script (or point to mediapipe venv python)
DATASET = PROJECT / "dataset"               # dataset root (per-person folders)
OUT_DIR = PROJECT / "verify_out"
ACCEPTED_DIR = OUT_DIR / "accepted"
REJECTED_DIR = OUT_DIR / "rejected"
LOG_FILE = OUT_DIR / "verify_log.txt"

# thresholds (same as config.ini)
YAW_THR = 20.0           # degrees
BLUR_THR = 80.0          # Laplacian var (higher = sharper)
MIN_AREA = 1600          # pixels (w*h)
SAVE_MAX = 200           # max images to save per category (avoid disk explosion)

# ArcFace ONNX (optional) — if you want to run similarity checks
USE_ONNX = True
ONNX_PATH = PROJECT / "models" / "arcface_model.onnx"
CACHE_EMB = PROJECT / "dataset" / ".cache" / "embeddings.npy"
CACHE_NAMES = PROJECT / "dataset" / ".cache" / "names.pkl"

# helper: run run_mediapipe.py --img and parse JSON
def call_mediapipe(img_path):
    cmd = [str(PY_MP), str(RUN_MP), "--img", str(img_path)]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=6)
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    stdout = p.stdout.strip()
    stderr = p.stderr.strip()
    if not stdout:
        return {"ok": False, "error": "no_stdout", "stderr": stderr}
    try:
        out = json.loads(stdout.splitlines()[-1])
        return out
    except Exception as e:
        return {"ok": False, "error": "invalid_json", "stdout": stdout, "stderr": stderr}

# simple align function to get 112x112 based on left/right eye/nose from MP landmarks
def align_crop(img, lm, size=(112,112)):
    try:
        src = np.float32([lm['left_eye'], lm['right_eye'], lm['nose']])
        dst = np.float32([[size[0]*0.3, size[1]*0.35],[size[0]*0.7, size[1]*0.35],[size[0]*0.5, size[1]*0.55]])
        M, _ = cv2.estimateAffinePartial2D(src, dst)
        if M is None:
            return cv2.resize(img, size)
        return cv2.warpAffine(img, M, size, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    except Exception:
        return cv2.resize(img, size)

# ONNX wrapper (minimal) — expects BGR uint8 input for our model wrapper in project
def load_onnx(onnx_path):
    try:
        import onnxruntime as ort
    except Exception:
        print("onnxruntime not installed — skipping onnx comparisons")
        return None
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    inp_name = sess.get_inputs()[0].name
    return (sess, inp_name)

def onnx_embed(sess_obj, img):
    sess, inp_name = sess_obj
    im = cv2.resize(img, (112,112))[:, :, ::-1].astype("float32") / 255.0
    inp = np.transpose(im, (2,0,1)).astype("float32")[None, ...]
    out = sess.run(None, {inp_name: inp})
    emb = np.array(out[0]).reshape(-1)
    emb = emb / (np.linalg.norm(emb) + 1e-12)
    return emb

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ACCEPTED_DIR.mkdir(exist_ok=True)
    REJECTED_DIR.mkdir(exist_ok=True)
    log = open(LOG_FILE, "w", encoding="utf8")

    onnx_obj = None
    if USE_ONNX and ONNX_PATH.exists():
        onnx_obj = load_onnx(ONNX_PATH)
        print("ONNX loaded" if onnx_obj else "ONNX not loaded")

    # optionally load cache embeddings for similarity checks
    emb_db = None
    names = None
    if onnx_obj and CACHE_EMB.exists() and CACHE_NAMES.exists():
        import pickle
        emb_db = np.load(CACHE_EMB)
        with open(CACHE_NAMES, "rb") as f:
            names = pickle.load(f)
        # normalize
        emb_db = emb_db.astype(np.float32)
        norms = np.linalg.norm(emb_db, axis=1, keepdims=True) + 1e-12
        emb_db = emb_db / norms

    saved_accept = saved_reject = 0
    # iterate images
    for person_dir in sorted(DATASET.iterdir()):
        if not person_dir.is_dir(): 
            continue
        for img_path in sorted(person_dir.glob("*.*")):
            if img_path.suffix.lower() not in (".jpg",".jpeg",".png"):
                continue
            try:
                res = call_mediapipe(img_path)
                if not res.get("ok"):
                    log.write(f"{img_path}: mediapipe fail: {res.get('error')} stdout={res.get('stdout','')} stderr={res.get('stderr','')}\n")
                    # treat as reject
                    if saved_reject < SAVE_MAX:
                        shutil.copy(str(img_path), REJECTED_DIR / f"mpfail_{saved_reject}_{img_path.name}")
                        saved_reject += 1
                    continue

                bbox = res.get("bbox")
                lm = res.get("landmarks", {})
                yaw = res.get("yaw")
                blur = res.get("blur")
                area = res.get("area")

                # crop using bbox (bbox from mediapipe is on full image)
                x1,y1,x2,y2 = bbox
                x1, y1 = max(0,int(x1)), max(0,int(y1))
                x2, y2 = min(int(x2), 99999), min(int(y2), 99999)
                img = cv2.imread(str(img_path))
                crop = img[y1:y2, x1:x2].copy() if y2>y1 and x2>x1 else cv2.resize(img, (112,112))

                accept = True
                reason = []
                if yaw is None or abs(yaw) > YAW_THR:
                    accept = False; reason.append(f"yaw={yaw}")
                if blur is None or blur < BLUR_THR:
                    accept = False; reason.append(f"blur={blur:.1f}")
                if area is None or area < MIN_AREA:
                    accept = False; reason.append(f"area={area}")
                # also ensure landmarks exist
                if not lm or not {'left_eye','right_eye','nose'}.issubset(set(lm.keys())):
                    accept = False; reason.append("landmarks_missing")

                if accept:
                    aligned = align_crop(crop, lm)
                    if saved_accept < SAVE_MAX:
                        outp = ACCEPTED_DIR / f"acc_{saved_accept}_{img_path.name}"
                        cv2.imwrite(str(outp), aligned)
                        saved_accept += 1
                    # optional: compute onnx embedding and nearest neighbor for sanity
                    if onnx_obj and emb_db is not None:
                        emb = onnx_embed(onnx_obj, aligned)
                        sims = emb_db.dot(emb)
                        idx = int(np.argmax(sims))
                        sim_val = float(np.max(sims))
                        name_match = names[idx] if names is not None else "?"
                        log.write(f"ACCEPT {img_path} -> match={name_match} sim={sim_val:.4f} reason=OK\n")
                    else:
                        log.write(f"ACCEPT {img_path} reason=OK yaw={yaw:.2f} blur={blur:.1f} area={area}\n")
                else:
                    if saved_reject < SAVE_MAX:
                        outp = REJECTED_DIR / f"rej_{saved_reject}_{img_path.name}"
                        # draw reason overlay
                        vis = cv2.resize(crop, (224,224))
                        cv2.putText(vis, ";".join(reason), (6,20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,255), 1)
                        cv2.imwrite(str(outp), vis)
                        saved_reject += 1
                    log.write(f"REJECT {img_path} reason={'|'.join(reason)} yaw={yaw} blur={blur} area={area}\n")

            except Exception as e:
                log.write(f"{img_path}: exception {e}\n")
                traceback.print_exc()
    log.close()
    print("Done. Accepted:", saved_accept, "Rejected:", saved_reject)
    print("Check folder:", OUT_DIR)
    print("Log:", LOG_FILE)

if __name__ == "__main__":
    main()
