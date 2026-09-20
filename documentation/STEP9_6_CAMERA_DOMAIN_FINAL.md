# STEP 9.6 — FINAL CAMERA-DOMAIN OBJECT RECOGNITION ARCHITECTURE & AUDIT
**Field Test Companion — Visual Modality & Physical Format Recognition Strategy**

---

## 1. The Old Domain-Gap Problem
When phone-camera captures of physical lateral-flow test cassettes were analyzed by the benchmark model (Step 9.5), they were rejected as **"Unknown (Out-of-Distribution)"** ($D_{\text{centroid}} > 8.5$ or $\max |z| > 5.0$).

### Quantitative Root Cause:
- **Scanner Baseline Variance:** The Open_Reader dataset was acquired using flatbed scanners / specialized optical boxes under rigid, monochromatic lighting. Feature standard deviations in training were artificially microscopic ($\sigma_{\text{norm\_g}} = 0.000200, \sigma_{\text{norm\_r}} = 0.000933$).
- **Smartphone Lighting Shift:** Natural smartphone cameras under standard indoor LED or daylight experience modest color temperature shifts ($\Delta R \approx +0.017$).
- Standardizing against the scanner distribution resulted in $Z_{\text{norm\_r}} \approx +18.2 \gg 5.0$, causing the OOD gate to reject valid mobile photos.
- **Aspect Ratio Mismatch:** Open_Reader images were predominantly 1:1 square crops ($\mu = 0.9766$), while smartphones capture in 4:3 or 16:9 portrait ($w/h \approx 0.56 - 0.75$), generating $Z \approx -12.6$.

---

## 2. New Camera-Domain Dataset Architecture

To eliminate the domain gap without compromising scientific integrity, a dedicated **Camera-Domain Dataset Architecture** was established under `field_test_dataset/camera_domain/`.

### Target Classes (Physical Format Only):
1. **`lateral_flow_cassette`**: Rectangular plastic rapid test cassette housings with sample well and reading window.
2. **`non_test_object`**: Common non-test objects (stationery, notebook, card, pen, tabletop, containers).

---

## 3. Data Collection Protocol & Metadata Schema

All ingested camera-domain images must record 11 standardized metadata attributes in `dataset_manifest.json`:
- `image_id`: Unique identifier (e.g. `CAM_CASSETTE_001`)
- `label`: `lateral_flow_cassette` | `non_test_object`
- `source`: Capture campaign protocol / authorized contributor
- `device_model`: e.g. Samsung Galaxy S22, Google Pixel 7, iPhone 13
- `os_version`: e.g. Android 14, iOS 17.4
- `lighting_condition`: `indoor_normal` | `warm_light` | `daylight` | `mild_shadow` | `low_light`
- `orientation`: `portrait` | `landscape` | `15deg_tilt`
- `distance_category`: `close` (10-15cm), `medium` (15-25cm), `far` (30-40cm)
- `resolution`: Pixel dimensions (e.g. `1080x1920`)
- `timestamp`: ISO-8601 UTC timestamp
- `sha256`: 64-character SHA-256 cryptographic digest
- `provenance`: `project_real_capture` | `external_open_reference` | `synthetic_demo`
- `notes`: Contextual observation notes

---

## 4. Actual Dataset Counts & Quality Status

In strict accordance with global safety and scientific integrity rules:
- **Zero Synthetic or Fabricated Images:** No fake samples or duplicated images were generated.
- **Actual Counts:**
  - `lateral_flow_cassette`: **0**
  - `non_test_object`: **0**
  - **Total Genuine Samples:** **0**
- **Target Proposal:** 80–100 cassette images + 80–100 non-test images (160–200 total).
- **Status:** **INSUFFICIENT FOR MODEL TRAINING (Collection Active — Training Paused)**.

---

## 5. Feature Engineering Pipeline

A deterministic 8-dimensional morphological, structural, and photometric feature extractor was implemented and verified in [`scratch/camera_domain_feature_extractor.py`](file:///c:/Users/PIYUSH/app/field-test-companion/scratch/camera_domain_feature_extractor.py):

| Feature | Name | Formula / Description | Role in Camera Domain |
|---|---|---|---|
| $f_0$ | `aspect_ratio` | $W / \max(1, H)$ | Identifies elongated cassette geometry vs. arbitrary shapes |
| $f_1$ | `rectangularity` | $\text{Area}_{\text{mask}} / (W \times H)$ | Measures solid rectangular contour fill factor |
| $f_2$ | `edge_density` | $\frac{\sum \|\nabla I\| > 30}{N_{\text{pixels}}}$ | Quantifies structural casing borders |
| $f_3$ | `internal_contrast` | $\sigma_{\text{lum}} / (\mu_{\text{lum}} + \epsilon)$ | Contrast of reading window / sample well against plastic housing |
| $f_4$ | `norm_red_chroma` | $R / (R + G + B + \epsilon)$ | Realistic mobile camera color balance |
| $f_5$ | `norm_blue_chroma` | $B / (R + G + B + \epsilon)$ | Realistic mobile camera color balance |
| $f_6$ | `mean_intensity` | $(0.299R + 0.587G + 0.114B) / 255$ | Photometric exposure level |
| $f_7$ | `symmetry_score` | $\text{Corr}(I_{\text{left}}, \text{flip}(I_{\text{right}}))$ | Bilateral geometric symmetry along long axis |

**Feature Extractor Verification Result:** **PASS (8/8 features mathematically valid and finite).**

---

## 6. Model Architecture & Training Procedure

- **Target Architecture:** Softmax Logistic Regression / Multinomial Logistic Regression (or 2-layer MLP $8 \to 16 \to 2$ if non-linear boundary is required) implemented in pure TypeScript for Expo Go and Web runtime compatibility.
- **Partitioning Protocol:** 60% Train / 20% Validation / 20% Frozen Held-Out Test with strict group-aware splitting across physical devices and capture sessions.
- **Training Gate:** [`scratch/train_camera_domain_model.py`](file:///c:/Users/PIYUSH/app/field-test-companion/scratch/train_camera_domain_model.py) enforces a dataset sufficiency check before parameter fitting. Training is currently **NOT RUN** to prevent fitting on empty or fabricated data.

---

## 7. Validation & OOD Calibration Protocol

- **OOD Formulation:**
  - Standardized distance $D_{\text{centroid}} = \min_c \|Z - \mu_c\|_2$
  - Maximum single-feature deviation $\max_i |Z_i|$
- **Calibration Rule:** Calibrated strictly on the validation partition of real camera-domain images once collected.
- **Held-Out Test Partition:** Evaluated only once after model parameters and OOD thresholds are frozen.
- **Current Status:** **NOT ESTABLISHED (Awaiting real data collection).**

---

## 8. Android & Web Runtime Status

- **Android (Expo Go):** **PASS** — Active Step 9.5 production pipeline (CameraView $\to$ Adaptive ROI $\to$ RGB/Hex/Intensity $\to$ Ref Normalization $\to$ SHA-256 $\to$ Record Persistence) remains fully functional without regressions.
- **Web Runtime:** **PASS** — Operational on `http://localhost:8082`.
- **TypeScript:** **PASS** — `npx tsc --noEmit` exits with 0 errors.

---

## 9. Non-Diagnostic Scope & Ethical Guardrails

- **Strict Non-Diagnostic Operation:** The model evaluates physical object modality (cassette vs. non-test object). It does **NOT** detect drugs, identify chemical substances, confirm chemical reactions, or produce positive/negative results.
- **Presumptive Status:** All records remain permanently flagged as `Presumptive (Unanalyzed)`.
- **Zero Fabrication Guarantee:** No synthetic or duplicated image samples were created.

---

## 10. Next Operational Steps
1. Execute multi-device data collection campaign to acquire 80–100 genuine cassette photos and 80–100 non-test object photos under diverse lighting conditions.
2. Ingest photos and metadata into `field_test_dataset/camera_domain/dataset_manifest.json`.
3. Run `python scratch/train_camera_domain_model.py` to fit weights and export `camera_domain_model_params.json`.
4. Update `services/aiAnalysis.ts` and `app/capture.tsx` with the validated camera-domain weights and thresholds.
