# STEP 9.7 — QUICK REFERENCE: DATASET COLLECTION MODE

---

## 1. Quick Facts
- **Mode:** Prototype in-app camera-domain dataset collection.
- **Access Route:** Home Dashboard -> **"Camera-Domain Dataset Collection"** card (`/dataset-collect`).
- **Target Classes:** `lateral_flow_cassette` & `non_test_object`.
- **Target Volume:** 80–100 per class (160–200 minimum total).
- **Core Security:** Instant SHA-256 fingerprinting & duplicate collision detection.
- **Safety Policy:** Non-diagnostic physical object format recognition only; no drug testing or clinical labels.

---

## 2. Collection Steps
1. Open **Dataset Collection Mode** from Home Screen.
2. Select **Dataset Label** (`lateral_flow_cassette` or `non_test_object`).
3. Select **Lighting Condition**, **Distance Category**, and **Orientation**.
4. Press **📷 Capture Dataset Image**.
5. Inspect Preview, Resolution, and SHA-256 Hash.
6. Tap **💾 Save to Dataset** (or **🔄 Discard & Retake**).

---

## 3. Storage Locations
- **Manifest:** `field_test_dataset/camera_domain/manifest/camera_domain_manifest.csv`
- **Images:** `field_test_dataset/camera_domain/images/<label>/`
- **Local SQLite / Device:** Maintained in local app document directory.
