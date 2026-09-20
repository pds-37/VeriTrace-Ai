"""
Camera-Domain Model Training & OOD Calibration Pipeline
Task: Non-Diagnostic Visual Object Format Recognition (lateral_flow_cassette vs. non_test_object)

Rules:
- Deterministic random seed = 42
- Group-aware partitioning across physical objects
- Standardize features using TRAINING statistics only
- Calibrate OOD thresholds using VALIDATION partition only
- Sequester held-out TEST partition until final frozen evaluation
- Zero fake samples or synthetic mixing
"""

import os
import sys
import json
import numpy as np
from PIL import Image
from typing import List, Dict, Tuple, Any

# Import deterministic feature extractor
try:
    from camera_domain_feature_extractor import extract_camera_domain_features
except ImportError:
    sys.path.append(os.path.dirname(__file__))
    from camera_domain_feature_extractor import extract_camera_domain_features

CLASS_NAMES = ["lateral_flow_cassette", "non_test_object"]
FEATURE_NAMES = [
    "f0_aspect_ratio",
    "f1_rectangularity",
    "f2_edge_density",
    "f3_internal_contrast",
    "f4_norm_red",
    "f5_norm_blue",
    "f6_mean_intensity",
    "f7_symmetry",
]

def load_camera_domain_dataset(base_dir: str):
    manifest_path = os.path.join(base_dir, "dataset_manifest.json")
    if not os.path.exists(manifest_path):
        print(f"Error: Manifest not found at {manifest_path}")
        return [], [], []
    
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    images = manifest.get("images", [])
    train_samples = [img for img in images if img.get("split") == "train"]
    val_samples = [img for img in images if img.get("split") == "val"]
    test_samples = [img for img in images if img.get("split") == "test"]
    
    return train_samples, val_samples, test_samples

def train_and_evaluate(train_samples: List[Dict], val_samples: List[Dict], test_samples: List[Dict], base_dir: str):
    """
    Executes model training, OOD calibration, and held-out test set validation.
    """
    print("\nExtracting 8 deterministic features for dataset partitions...")
    
    def extract_features_and_labels(samples: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
        feats_list = []
        labels_list = []
        for s in samples:
            img_path = os.path.join(base_dir, s.get("file_path", ""))
            if not os.path.exists(img_path):
                img_path = s.get("image_uri", "")
            img = Image.open(img_path).convert("RGB")
            arr = np.array(img, dtype=np.uint8)
            f = extract_camera_domain_features(arr)
            feats_list.append(f)
            labels_list.append(0 if s["label"] == "lateral_flow_cassette" else 1)
        return np.array(feats_list, dtype=np.float64), np.array(labels_list, dtype=np.int64)

    X_train, y_train = extract_features_and_labels(train_samples)
    X_val, y_val = extract_features_and_labels(val_samples)
    X_test, y_test = extract_features_and_labels(test_samples)

    # 1. Feature Standardization (computed strictly on TRAINING data)
    means = np.mean(X_train, axis=0)
    stds = np.std(X_train, axis=0)
    stds[stds < 1e-6] = 1.0

    Z_train = (X_train - means) / stds
    Z_val = (X_val - means) / stds
    Z_test = (X_test - means) / stds

    # 2. Train Logistic Regression / Linear Model
    # y in {0, 1}
    from sklearn.linear_model import LogisticRegression
    clf = LogisticRegression(random_state=42, max_iter=1000, C=1.0)
    clf.fit(Z_train, y_train)

    # 3. Compute Class Centroids in Z-space (from TRAINING data)
    centroids_z = []
    for c in range(2):
        c_mask = (y_train == c)
        if np.sum(c_mask) > 0:
            centroids_z.append(np.mean(Z_train[c_mask], axis=0).tolist())
        else:
            centroids_z.append([0.0] * 8)

    # 4. Calibrate OOD Thresholds on VALIDATION set
    val_centroid_dists = []
    val_max_abs_zs = []
    for i in range(len(Z_val)):
        z = Z_val[i]
        dists = [np.linalg.norm(z - np.array(cz)) for cz in centroids_z]
        val_centroid_dists.append(min(dists))
        val_max_abs_zs.append(np.max(np.abs(z)))

    # Set threshold at 99th percentile of validation distribution with safety margin
    ood_thresh_dist = float(np.percentile(val_centroid_dists, 99)) * 1.1 if len(val_centroid_dists) > 0 else 8.5
    ood_thresh_max_z = float(np.percentile(val_max_abs_zs, 99)) * 1.1 if len(val_max_abs_zs) > 0 else 5.0

    print("-" * 60)
    print("VALIDATION PARTITION METRICS & OOD CALIBRATION:")
    val_preds = clf.predict(Z_val)
    val_acc = np.mean(val_preds == y_val)
    print(f"  Validation Accuracy : {val_acc * 100:.2f}%")
    print(f"  Calibrated OOD Centroid Distance Threshold : {ood_thresh_dist:.2f}")
    print(f"  Calibrated OOD Max |Z| Deviation Threshold  : {ood_thresh_max_z:.2f}")

    # 5. Held-Out TEST Evaluation
    print("-" * 60)
    print("HELD-OUT TEST SET EVALUATION (FROZEN):")
    test_preds = clf.predict(Z_test)
    test_probs = clf.predict_proba(Z_test)

    from sklearn.metrics import confusion_matrix, classification_report
    cm = confusion_matrix(y_test, test_preds, labels=[0, 1])
    report = classification_report(y_test, test_preds, target_names=CLASS_NAMES, output_dict=True)

    print("\nConfusion Matrix:")
    print("                    Predicted Cassette  Predicted Non-Test")
    print(f"Actual Cassette     {cm[0, 0]:18d}  {cm[0, 1]:18d}")
    print(f"Actual Non-Test     {cm[1, 0]:18d}  {cm[1, 1]:18d}")

    print("\nClassification Report:")
    for cls in CLASS_NAMES:
        r = report[cls]
        print(f"  Class: {cls}")
        print(f"    Precision : {r['precision']:.4f}")
        print(f"    Recall    : {r['recall']:.4f}")
        print(f"    F1-score  : {r['f1-score']:.4f}")
        print(f"    Support   : {r['support']}")

    macro_f1 = report['macro avg']['f1-score']
    print(f"\nMacro-F1 Score : {macro_f1:.4f}")
    print(f"Test Accuracy  : {report['accuracy'] * 100:.2f}%")

    # 6. Export Parameters
    weights = clf.coef_.tolist()  # shape (1, 8) for binary
    biases = clf.intercept_.tolist()  # shape (1,)

    export_data = {
        "model_name": "CameraDomainVisualFormatClassifier",
        "task": "non_diagnostic_format_classification",
        "classes": CLASS_NAMES,
        "feature_names": FEATURE_NAMES,
        "feature_means": means.tolist(),
        "feature_stds": stds.tolist(),
        "weights": weights,
        "biases": biases,
        "centroids_z": centroids_z,
        "ood_threshold_centroid_dist": ood_thresh_dist,
        "ood_threshold_max_z": ood_thresh_max_z,
        "metrics": {
            "test_accuracy": float(report['accuracy']),
            "macro_f1": float(macro_f1),
            "confusion_matrix": cm.tolist()
        }
    }

    out_file = os.path.join(base_dir, "camera_domain_model_params.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(export_data, f, indent=2)
    print(f"\nModel parameters exported to: {out_file}")

def main():
    base_dir = os.path.join(os.path.dirname(__file__), "..", "field_test_dataset", "camera_domain")
    train_samples, val_samples, test_samples = load_camera_domain_dataset(base_dir)
    
    total_samples = len(train_samples) + len(val_samples) + len(test_samples)
    print("=" * 60)
    print("CAMERA-DOMAIN MODEL TRAINING PIPELINE")
    print("=" * 60)
    print(f"Dataset Path: {os.path.abspath(base_dir)}")
    print(f"Total genuine samples found: {total_samples}")
    print(f"  Train: {len(train_samples)}")
    print(f"  Val:   {len(val_samples)}")
    print(f"  Test:  {len(test_samples)}")
    
    # Strict minimum target enforcement
    if total_samples < 160 or len(train_samples) < 96 or len(val_samples) < 32 or len(test_samples) < 32:
        print("\n" + "!" * 60)
        print("STOP: Camera-domain dataset is currently insufficient for model training.")
        print("Required targets:")
        print("  - lateral_flow_cassette: 80–100 genuine images")
        print("  - non_test_object:       80–100 genuine images")
        print("  - Total Target:          160–200 genuine images")
        print("In accordance with scientific safety rules, training has been halted.")
        print("Zero synthetic or fabricated samples will be generated.")
        print("!" * 60)
        sys.exit(0)

    train_and_evaluate(train_samples, val_samples, test_samples, base_dir)

if __name__ == "__main__":
    main()
