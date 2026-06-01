from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import numpy as np
from PIL import Image
import io
import os
import datetime
import traceback

from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import img_to_array

app = Flask(__name__)
CORS(app)


# MODEL PATH (auto-detect inside this project)

_HERE = os.path.dirname(os.path.abspath(__file__))
_CANDIDATE_MODEL_PATHS = [
    os.path.join(_HERE, "vegetable_disease_model.h5"),
    os.path.join(os.path.dirname(_HERE), "vegetable_disease_model.h5"),
]
MODEL_PATH = next((p for p in _CANDIDATE_MODEL_PATHS if os.path.exists(p)), _CANDIDATE_MODEL_PATHS[0])

model = None
CONFIDENCE_THRESHOLD = 55.0
OOD_CONFIDENCE_THRESHOLD = 70.0
MARGIN_THRESHOLD = 8.0
ENTROPY_THRESHOLD = 0.75
HIGH_ENTROPY_UNWANTED_THRESHOLD = 0.92
LOW_CONFIDENCE_UNWANTED_THRESHOLD = 35.0
QUALITY_BRIGHTNESS_MIN = 35.0
QUALITY_BRIGHTNESS_MAX = 225.0
QUALITY_CONTRAST_MIN = 18.0
QUALITY_SHARPNESS_MIN = 12.0
LEAF_GREEN_RATIO_MIN = 0.08
UNCERTAIN_LABEL = "Uncertain Image"
UNWANTED_IMAGE_LABEL = "Unwanted Image"
UNWANTED_LABEL_KEYWORDS = (
    "unwanted",
    "unknown",
    "other",
    "background",
    "not_",
    "non_",
)
TRAIN_DIR_DEFAULT = r"D:\vegetable_disease\PlantVillage\train"
TRAIN_DIR = os.environ.get("VEGETABLE_TRAIN_DIR", TRAIN_DIR_DEFAULT)
FALLBACK_CLASSES = [
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Ill_cucumber",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
    "cauliflower_Downy_Mildew",
    "cauliflower_bacteria_spot",
    "cauliflower_black_rot",
    "cauliflower_no_disease",
    "good_Cucumber"
]
CLASSES = []


def load_classes():
    """Load class labels in the exact training order (alphabetical directory order)."""
    if os.path.isdir(TRAIN_DIR):
        classes = sorted(
            [name for name in os.listdir(TRAIN_DIR) if os.path.isdir(os.path.join(TRAIN_DIR, name))]
        )
        if classes:
            print(f"Loaded {len(classes)} classes from train dir: {TRAIN_DIR}")
            return classes

    print("Warning: Train directory not found/empty, using fallback class list")
    return FALLBACK_CLASSES


# DATABASE
def init_db():
    conn = sqlite3.connect("predictions.db")
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_name TEXT,
            disease TEXT,
            confidence REAL,
            timestamp TEXT
        )
    """)

    conn.commit()
    conn.close()
    print("Database Ready")



# LOAD MODEL

def load_trained_model():
    global model

    try:
        print("Checking Model Path:", MODEL_PATH)

        if os.path.exists(MODEL_PATH):
            model = load_model(MODEL_PATH)
            print("Model Loaded Successfully")
            print("Output Shape:", model.output_shape)
            print("Class Count:", len(CLASSES))
            if model.output_shape[-1] != len(CLASSES):
                print(
                    "Warning: model output classes and label classes mismatch:",
                    model.output_shape[-1],
                    "!=",
                    len(CLASSES),
                )

        else:
            print("Model File Not Found")

    except Exception as e:
        print("Model Load Error:", str(e))



# IMAGE PREPROCES
def preprocess_image(image):
    # Center-crop to square first to avoid aspect-ratio distortion.
    width, height = image.size
    crop_size = min(width, height)
    left = (width - crop_size) // 2
    top = (height - crop_size) // 2
    image = image.crop((left, top, left + crop_size, top + crop_size))
    image = image.resize((224, 224))
    img = img_to_array(image)
    img = img / 255.0
    return img


def predict_with_tta(image):
    """
    Test-time augmentation:
    - original image
    - horizontal flip
    Average both probability vectors for more stable predictions.
    """
    variants = [
        image,
        image.transpose(Image.FLIP_LEFT_RIGHT),
        image.rotate(8, resample=Image.BICUBIC),
        image.rotate(-8, resample=Image.BICUBIC),
    ]

    batch = np.stack([preprocess_image(variant) for variant in variants], axis=0)
    preds = model.predict(batch, verbose=0)
    return np.mean(preds, axis=0)


def normalized_entropy(probabilities):
    """Return entropy normalized to [0, 1]. Higher means more uncertain/flat distribution."""
    probs = np.clip(probabilities, 1e-12, 1.0)
    entropy = -np.sum(probs * np.log(probs))
    max_entropy = np.log(len(probs))
    if max_entropy <= 0:
        return 0.0
    return float(entropy / max_entropy)


def is_unwanted_class(label):
    """Return True if predicted class name represents unwanted/non-target image."""
    normalized = str(label or "").strip().lower()
    return any(keyword in normalized for keyword in UNWANTED_LABEL_KEYWORDS)


def assess_image_quality(image):
    """
    Lightweight no-retrain quality checks to reject hard-to-predict images.
    Returns quality stats and whether image is poor quality.
    """
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    gray = np.asarray(image.convert("L"), dtype=np.float32)
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    # Gradient magnitude variance works as a simple sharpness proxy.
    gx = np.diff(gray, axis=1)
    gy = np.diff(gray, axis=0)
    sharpness = float(np.var(gx) + np.var(gy))
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    b = rgb[:, :, 2]
    # Simple green-dominance heuristic for leaf-like content.
    green_mask = (g > r * 1.05) & (g > b * 1.05) & (g > 40.0)
    green_ratio = float(np.mean(green_mask))

    too_dark = brightness < QUALITY_BRIGHTNESS_MIN
    too_bright = brightness > QUALITY_BRIGHTNESS_MAX
    too_low_contrast = contrast < QUALITY_CONTRAST_MIN
    too_blurry = sharpness < QUALITY_SHARPNESS_MIN
    non_leaf_like = green_ratio < LEAF_GREEN_RATIO_MIN

    is_poor_quality = too_dark or too_bright or too_low_contrast or too_blurry
    reasons = []
    if too_dark:
        reasons.append("too_dark")
    if too_bright:
        reasons.append("too_bright")
    if too_low_contrast:
        reasons.append("low_contrast")
    if too_blurry:
        reasons.append("blurry")
    if non_leaf_like:
        reasons.append("non_leaf_like")

    return {
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "sharpness": round(sharpness, 2),
        "green_ratio": round(green_ratio, 4),
        "is_non_leaf_like": non_leaf_like,
        "is_poor_quality": is_poor_quality,
        "reasons": reasons,
    }



# HOME

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Vegetable Disease API Running ✅",
        "predict_endpoint": "/predict"
    })


# PREDICT
@app.route("/predict", methods=["POST"])
def predict():
    global model

    try:
        if model is None:
            return jsonify({"error": "Model not loaded"}), 500

        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]

        if file.filename == "":
            return jsonify({"error": "No selected file"}), 400

        # Read Image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        quality = assess_image_quality(image)

        image_name = file.filename

        # Predict with TTA averaging for better robustness.
        preds = predict_with_tta(image)

        pred_index = int(np.argmax(preds))
        confidence = float(np.max(preds) * 100)
        entropy_score = normalized_entropy(preds)

        # Return top-3 classes for debugging/inspection on uncertain predictions.
        top_indices = np.argsort(preds)[-3:][::-1]
        top_predictions = []
        for idx in top_indices:
            label = CLASSES[idx] if idx < len(CLASSES) else "Unknown"
            top_predictions.append({
                "class_id": int(idx),
                "disease": label,
                "confidence": float(preds[idx] * 100)
            })
        top1 = float(preds[top_indices[0]] * 100)
        top2 = float(preds[top_indices[1]] * 100) if len(top_indices) > 1 else 0.0
        confidence_margin = top1 - top2

        # Safety Check + confidence/margin guard to avoid forcing likely wrong class.
        if pred_index >= len(CLASSES):
            disease = UNCERTAIN_LABEL
            is_uncertain = True
        else:
            disease = CLASSES[pred_index]
            is_ood_like = (
                confidence < OOD_CONFIDENCE_THRESHOLD
                and entropy_score > ENTROPY_THRESHOLD
            )
            is_uncertain = (
                confidence < CONFIDENCE_THRESHOLD
                or confidence_margin < MARGIN_THRESHOLD
                or is_ood_like
            )
            if quality["is_non_leaf_like"]:
                disease = UNWANTED_IMAGE_LABEL
                is_uncertain = True
            elif quality["is_poor_quality"]:
                disease = UNCERTAIN_LABEL
                is_uncertain = True
            elif is_unwanted_class(disease):
                # Keep a stable UI-friendly label for non-target images.
                disease = UNWANTED_IMAGE_LABEL
                is_uncertain = True
            elif (
                confidence < LOW_CONFIDENCE_UNWANTED_THRESHOLD
                and entropy_score > HIGH_ENTROPY_UNWANTED_THRESHOLD
            ):
                # Very low confidence + very high entropy often means non-target image.
                disease = UNWANTED_IMAGE_LABEL
                is_uncertain = True
            elif is_uncertain:
                disease = UNCERTAIN_LABEL

        # Save DB
        conn = sqlite3.connect("predictions.db")
        c = conn.cursor()

        c.execute("""
            INSERT INTO predictions(image_name,disease,confidence,timestamp)
            VALUES(?,?,?,?)
        """, (
            image_name,
            disease,
            confidence,
            str(datetime.datetime.now())
        ))

        conn.commit()
        conn.close()

        print(
            f"{image_name} --> {disease} ({confidence:.2f}%) | "
            f"margin={confidence_margin:.2f}% | entropy={entropy_score:.3f} | "
            f"quality={quality} | uncertain={is_uncertain}"
        )

        return jsonify({
            "success": True,
            "disease": disease,
            "confidence": f"{confidence:.2f}%",
            "class_id": pred_index,
            "is_uncertain": is_uncertain,
            "confidence_margin": f"{confidence_margin:.2f}%",
            "entropy_score": round(entropy_score, 4),
            "top_predictions": top_predictions,
            "quality": quality
        })

    except Exception as e:
        print("Prediction Error")
        traceback.print_exc()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500



# RUN
if __name__ == "__main__":
    print("Starting Vegetable Disease Detection Server")
    init_db()
    CLASSES = load_classes()
    load_trained_model()

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )