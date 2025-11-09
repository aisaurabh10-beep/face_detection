# tools/mp_accept_and_align.py
import cv2, json, sys, os, numpy as np

# CONFIG (tune these)
YAW_THR = 12.0       # degrees
BLUR_THR = 50.0      # laplacian var
MIN_AREA = 800       # pixels

def align_from_landmarks(crop, lm, out_sz=(112,112)):
    if not lm or not {'left_eye','right_eye','nose'}.issubset(lm.keys()):
        return cv2.resize(crop, out_sz)
    src = np.array([lm['left_eye'], lm['right_eye'], lm['nose']], dtype=np.float32)
    # src MUST be relative to the crop. If lm are absolute coords, caller must translate.
    dst = np.array([[out_sz[0]*0.3, out_sz[1]*0.35],
                    [out_sz[0]*0.7, out_sz[1]*0.35],
                    [out_sz[0]*0.5, out_sz[1]*0.55]], dtype=np.float32)
    M, _ = cv2.estimateAffinePartial2D(src, dst)
    if M is None:
        return cv2.resize(crop, out_sz)
    aligned = cv2.warpAffine(crop, M, out_sz, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return aligned

def laplacian_var(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(g, cv2.CV_64F).var())

def process(image_path, mp_json):
    img = cv2.imread(image_path)
    if img is None:
        raise SystemExit("Cannot load image")
    data = mp_json
    bbox = data['bbox']           # [x1,y1,x2,y2] absolute coords
    lm = data.get('landmarks', {})
    # convert landmark lists to tuples
    lm = {k: tuple(v) for k,v in lm.items()}

    x1,y1,x2,y2 = map(int, bbox)
    x1, y1 = max(0,x1), max(0,y1)
    x2, y2 = min(img.shape[1], x2), min(img.shape[0], y2)
    crop = img[y1:y2, x1:x2].copy()

    # convert landmark coords to crop-relative
    lm_crop = {}
    for k, (lx, ly) in lm.items():
        lm_crop[k] = [float(lx - x1), float(ly - y1)]

    yaw = data.get('yaw', None)
    blur = laplacian_var(crop)
    area = crop.shape[0] * crop.shape[1]

    accept = True
    reasons = []
    if yaw is None or abs(yaw) > YAW_THR:
        accept = False; reasons.append(f"yaw={yaw}")
    if blur < BLUR_THR:
        accept = False; reasons.append(f"blur={blur:.1f}")
    if area < MIN_AREA:
        accept = False; reasons.append(f"area={area}")

    if accept:
        aligned = align_from_landmarks(crop, lm_crop)
        # save aligned for ArcFace
        cv2.imwrite("accepted_aligned.jpg", aligned)
        print("ACCEPT", reasons if reasons else "OK", f"yaw={yaw:.2f}", f"blur={blur:.1f}", f"area={area}")
    else:
        # save annotated reject for debugging
        vis = cv2.resize(crop, (320,320))
        cv2.putText(vis, ",".join(reasons), (6,20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,255), 1)
        cv2.imwrite("rejected_debug.jpg", vis)
        print("REJECT", reasons, f"yaw={yaw}", f"blur={blur:.1f}", f"area={area}")

if __name__ == "__main__":
    # Usage: python tools/mp_accept_and_align.py <image_path> <mp_json_file>
    if len(sys.argv) != 3:
        print("Usage: python mp_accept_and_align.py <image> <mp_json.json>")
        sys.exit(1)
    img_path = sys.argv[1]
    with open(sys.argv[2], 'r') as f:
        data = json.load(f)
    process(img_path, data)
