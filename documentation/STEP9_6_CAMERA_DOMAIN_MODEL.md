# STEP 9.6 — CAMERA-DOMAIN OBJECT RECOGNITION MODEL ARCHITECTURE & INSPECTION
**Non-Diagnostic Physical Modality & Format Recognition for Mobile Edge Capture**

---

## 1. Root Cause of Previous Domain Rejection

When phone-camera captures of physical lateral-flow test cassettes were analyzed by the Step 9.5 model, they were rejected as **"Unknown (Out-of-Distribution)"** despite visually representing lateral-flow cassettes.

### Quantitative Domain Gap Analysis:
1. **Microscopic Feature Variances in Scanner Baseline:**
   - The Open_Reader benchmark dataset was created using a specialized flatbed scanner / sensor box under standardized, monochromatic optical illumination.
   - The feature standard deviations learned from Open_Reader were artificially tiny:
     - $\sigma_{\text{norm\_g}} = 0.000200$ (0.02% variation across dataset)
     - $\sigma_{\text{norm\_r}} = 0.000933$ (0.09% variation across dataset)
     - $\sigma_{d\_\text{chroma}} = 0.001449$
   - A normal smartphone camera capturing under warm indoor LED or natural daylight experiences a modest chromatic shift (e.g. `norm_r` moves from $0.333$ to $0.350$, $\Delta = +0.017$).
   - In standardized Z-space, this minor shift yields:
     $$Z_{\text{norm\_r}} = \frac{0.350 - 0.333}{0.000933} \approx \mathbf{+18.2}$$
   - Because $18.2 \gg 5.0$ (the $Z_{\max}$ threshold) and $D_{\text{centroid}} \ge 18.2 \gg 8.5$, the OOD gate correctly protected the Open_Reader scanner boundary, but rejected valid phone images.
2. **Aspect Ratio Mismatch:**
   - Open_Reader images were mostly square scanner crops ($\mu = 0.9766, \sigma = 0.0328$).
   - Mobile phones capture at 4:3 or 16:9 ($w/h \approx 0.56 - 0.75$), generating $Z \approx -12.6$, which also triggered rejection.

---

## 2. Non-Diagnostic Target Classes

The camera-domain classifier targets visual **object format and modality recognition only**:

1. **`lateral_flow_cassette`**: Rectangular plastic housing containing sample well, reaction strip, and reading window.
2. **`non_test_object`**: Common everyday background or non-test objects (stationery, tabletops, cards, coins, containers).

> **CRITICAL NON-DIAGNOSTIC SAFEGUARD:**  
> This task classifies only the **physical object format** (whether the image contains a test cassette vs. an ordinary non-test object). It does **NOT** detect chemicals, does **NOT** identify drugs, and does **NOT** produce positive/negative outcomes.

---

## 3. Camera-Domain Dataset Structure & Schema

### Directory Layout:
```
field_test_dataset/
└── camera_domain/
    ├── dataset_manifest.json
    ├── train/
    │   ├── lateral_flow_cassette/
    │   └── non_test_object/
    ├── val/
    │   ├── lateral_flow_cassette/
    │   └── non_test_object/
    └── test/
        ├── lateral_flow_cassette/
        └── non_test_object/
```

### Manifest Metadata Schema:
Every image entry in `dataset_manifest.json` tracks 11 verifiable fields:
- `image_id`: Unique alphanumeric ID (e.g. `CAM_CASSETTE_001`)
- `label`: `lateral_flow_cassette` | `non_test_object`
- `source`: Capture campaign protocol / authorized contributor
- `device`: Smartphone model (e.g. `Samsung S22`, `Pixel 7`, `iPhone 13`)
- `lighting`: `indoor_warm_led` | `daylight_d65` | `fluorescent` | `low_light`
- `orientation`: `portrait` | `landscape` | `15deg_tilt`
- `distance_cm`: Approximate camera distance in centimeters
- `resolution`: Pixel dimensions (e.g. `1080x1920`)
- `roi_bounding_box`: `[x, y, width, height]`
- `provenance`: Origin and authorization notes
- `sha256`: 64-character SHA-256 cryptographic hash of image bytes

### Current Collection Status:
- **Zero Fabrication Policy:** In accordance with scientific integrity rules, 0 fake or duplicated samples were generated.
- **Current Counts:**
  - `lateral_flow_cassette`: 0
  - `non_test_object`: 0
  - **Total:** 0
- **Status:** **Camera-domain dataset is currently insufficient for model training.** (Target: 80–100 genuine cassette photos + 80–100 non-test object photos).

---

## 4. Feature Engineering Architecture

A deterministic 8-dimensional feature extractor has been implemented and mathematically verified in [`scratch/camera_domain_feature_extractor.py`](file:///c:/Users/PIYUSH/app/field-test-companion/scratch/camera_domain_feature_extractor.py):

| Index | Feature | Formula / Algorithm | Role in Camera Domain |
|---|---|---|---|
| $f_0$ | `aspect_ratio` | $W / \max(1, H)$ | Elongated cassette vs. arbitrary objects |
| $f_1$ | `rectangularity` | $\text{Area}_{\text{mask}} / (W \times H)$ | Measures boundary fill factor |
| $f_2$ | `edge_density` | $\frac{\sum \|\nabla I\| > 30}{N_{\text{pixels}}}$ | Sharp structural casing edges |
| $f_3$ | `internal_contrast` | $\sigma_{\text{lum}} / (\mu_{\text{lum}} + \epsilon)$ | Contrast between reading window and plastic casing |
| $f_4$ | `norm_red_chroma` | $R / (R + G + B + \epsilon)$ | Real camera color balance |
| $f_5$ | `norm_blue_chroma` | $B / (R + G + B + \epsilon)$ | Real camera color balance |
| $f_6$ | `mean_intensity` | $(0.299R + 0.587G + 0.114B) / 255$ | Photometric exposure level |
| $f_7$ | `symmetry_score` | $\text{Corr}(I_{\text{left}}, \text{flip}(I_{\text{right}}))$ | Bilateral geometric symmetry along long axis |

---

## 5. Training, Validation & OOD Recalibration Protocol

Once the target collection of 80–100 real cassette images and 80–100 non-test objects is assembled:

1. **Partitioning Protocol:**
   - 60% Training ($N \approx 100$)
   - 20% Validation ($N \approx 35$)
   - 20% Held-Out Test ($N \approx 35$)
   - Strict group-aware splitting: all photos of the same physical cassette kit must remain in the same partition.
2. **Model Training:**
   - Multinomial Logistic Regression / 2-layer MLP ($8 \to 16 \to 2$) in pure Python (`scratch/train_camera_domain_model.py`).
   - Export parameters to `scratch/camera_domain_model_params.json` for pure TypeScript inference.
3. **OOD Recalibration:**
   - Fit feature means $\mu_{\text{train}}$ and standard deviations $\sigma_{\text{train}}$ on training set only.
   - Compute class centroids in Z-space on training set.
   - Set distance threshold $D_{\text{thresh}}$ and $Z_{\max}$ on validation set aiming for $98-100\%$ in-distribution acceptance.
   - Evaluate held-out test set **only once** after freezing all thresholds.

---

## 6. Current Operational Recommendation

To maintain production stability in Expo Go without injecting untrained/fabricated weights:
1. **Preserve Current Step 9.5 Benchmark Classifier:** Keeps existing validated benchmark and color normalization engines fully functional.
2. **Execute Camera-Domain Data Collection Campaign:** Gather 80–100 permissioned cassette photos and 80–100 non-test object photos using the created directory hierarchy and manifest schema.
3. **Trigger Step 9.6 Training Workflow:** Execute `scratch/camera_domain_feature_extractor.py` and model trainer upon completion of genuine dataset collection.
