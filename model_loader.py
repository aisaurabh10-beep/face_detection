# src/model_loader.py
import os
import logging
import numpy as np
import pickle

logger = logging.getLogger(__name__)

def _load_yolo(yolo_path):
    from ultralytics import YOLO
    logger.info("Loading YOLO model from %s", yolo_path)
    model = YOLO(yolo_path)
    return model

def _load_arcface_model(arcface_path):
    """
    Load an arcface model. Supports:
     - .onnx (onnxruntime) -> returns a callable wrapper that accepts (H,W,3) uint8 numpy and returns 1D embedding
     - Torch scripted or state_dict (torch.jit.load fallback) -> returns torch.Module
    """
    if not arcface_path:
        return None, None

    arcface_path = arcface_path.strip()
    if arcface_path == "":
        return None, None

    try:
        if arcface_path.lower().endswith(".onnx"):
            import onnxruntime as ort
            sess = ort.InferenceSession(arcface_path, providers=['CPUExecutionProvider'])
            input_name = sess.get_inputs()[0].name
            def onnx_embed(img_np):
                # img_np: uint8 HxWx3 BGR (we'll convert to RGB float32 [0,1])
                inp = img_np[..., ::-1].astype('float32') / 255.0
                inp = np.transpose(inp, (2,0,1)).astype('float32')[None, ...]
                out = sess.run(None, {input_name: inp})
                emb = np.array(out[0]).reshape(-1)
                return emb
            logger.info("Loaded ArcFace ONNX model: %s", arcface_path)
            return onnx_embed, 'onnx'
        else:
            import torch
            # attempt to load as torchscript or state_dict
            try:
                model = torch.jit.load(arcface_path, map_location='cpu')
            except Exception:
                model = torch.load(arcface_path, map_location='cpu')
            model.eval()
            logger.info("Loaded ArcFace Torch model: %s", arcface_path)
            return model, 'torch'
    except Exception as e:
        logger.exception("Failed to load arcface model from %s: %s", arcface_path, e)
        return None, None

def _embed_with_deepface(img_path):
    from deepface import DeepFace
    rep = DeepFace.represent(img_path=img_path, model_name="ArcFace", enforce_detection=True)
    if rep and "embedding" in rep[0]:
        return np.array(rep[0]["embedding"], dtype=np.float32)
    return None

def initialize_models_and_db(config):
    """
    Returns: yolo_model, embeddings_np, names_list, arcface_model_or_callable, arcface_type
    """
    yolo_path = config.get('Paths', 'yolo_model_path')
    dataset_path = config.get('Paths', 'dataset_path')
    cache_dir = os.path.join(dataset_path, ".cache")
    os.makedirs(cache_dir, exist_ok=True)
    emb_file = os.path.join(cache_dir, "embeddings.npy")
    names_file = os.path.join(cache_dir, "names.pkl")

    # Load YOLO
    yolo_model = _load_yolo(yolo_path)

    # Load arcface model if specified in config
    arcface_path = config.get('Model_Settings', 'arcface_path', fallback='').strip()
    arcface_model, arcface_type = _load_arcface_model(arcface_path)

    # If cached embeddings exist and names exist, load them
    if os.path.exists(emb_file) and os.path.exists(names_file):
        logger.info("Loading cached embeddings from %s", emb_file)
        embeddings = np.load(emb_file)
        with open(names_file, "rb") as f:
            names = pickle.load(f)
        logger.info("Loaded %d embeddings for %d unique names", embeddings.shape[0], len(set(names)))
        return yolo_model, embeddings, names, arcface_model, arcface_type

    # No cache: compute embeddings.
    logger.info("No cache found. Building embeddings from dataset at %s", dataset_path)
    embeddings = []
    names = []

    # prefer arcface_model callable if available
    use_deepface = False
    if arcface_model is None:
        # try deepface but catch TF-related errors early
        try:
            import deepface
            from deepface import DeepFace
            use_deepface = True
            logger.info("DeepFace available; will use it to compute embeddings (slow).")
        except Exception as e:
            logger.warning("DeepFace not usable in this environment: %s", e)
            use_deepface = False

    for person in sorted(os.listdir(dataset_path)):
        person_dir = os.path.join(dataset_path, person)
        if not os.path.isdir(person_dir):
            continue
        for fname in sorted(os.listdir(person_dir)):
            if not fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            path = os.path.join(person_dir, fname)
            emb = None
            try:
                if arcface_model is not None:
                    if arcface_type == 'onnx':
                        im = cv2.imread(path)
                        if im is None:
                            logger.warning("Could not read image %s", path)
                            continue
                        emb = arcface_model(im)
                    elif arcface_type == 'torch':
                        # try to use torch model - user should adapt preproc to their model
                        import torch
                        im = cv2.imread(path)
                        im = cv2.resize(im, (112,112))
                        im_rgb = im[..., ::-1].astype('float32') / 255.0
                        t = torch.from_numpy(im_rgb).permute(2,0,1).unsqueeze(0)
                        with torch.no_grad():
                            out = arcface_model(t)
                        emb = out.cpu().numpy().reshape(-1)
                elif use_deepface:
                    emb = _embed_with_deepface(path)
            except Exception as e:
                logger.warning("Failed to embed %s: %s", path, e)
                emb = None

            if emb is not None:
                embeddings.append(np.asarray(emb, dtype=np.float32))
                names.append(person)

    if len(embeddings) == 0:
        raise RuntimeError("No embeddings produced. Provide an arcface_path in config or install working DeepFace/TF in this environment.")

    embeddings = np.vstack(embeddings)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-12
    embeddings = (embeddings / norms).astype(np.float32)

    # save cache
    try:
        np.save(emb_file, embeddings)
        with open(names_file, "wb") as f:
            pickle.dump(names, f)
        logger.info("Saved embeddings cache to %s", emb_file)
    except Exception as e:
        logger.exception("Failed to save embeddings cache: %s", e)

    return yolo_model, embeddings, names, arcface_model, arcface_type
