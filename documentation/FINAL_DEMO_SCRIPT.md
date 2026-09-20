# FIELD TEST COMPANION — FINAL DEMO SCRIPT
**Step-by-Step Live Demonstration Protocol with Screen-by-Screen Verbal Cues**

---

## Demonstration Overview & Objective
This live demonstration protocol showcases the end-to-end functionality of **Field Test Companion**, highlighting:
1. Instant cryptographic SHA-256 evidence integrity.
2. Real-time Adaptive ROI localization and telemetry extraction (RGB, Hex, Intensity).
3. Reference color comparison and quantitative delta analysis.
4. AI image-modality classification with active Out-of-Distribution (OOD) rejection.
5. Strict non-diagnostic safety guardrails and local record persistence.

---

## Demo Script Walkthrough

### Step 1: Launch Application
- **Screen:** Home Dashboard (`/index`)
- **Action:** Open the Field Test Companion app on device or browser (`http://localhost:8083`).
- **Verbal Explanation:**
  > *"Welcome judges. We are presenting Field Test Companion, an offline-first computer vision and telemetry system designed to eliminate subjective visual bias from field test documentation and provide cryptographic evidence integrity. As you see on the dashboard, all core telemetry and storage engines operate completely locally on the device with zero cloud dependency."*

---

### Step 2: Start New Test
- **Screen:** Dashboard -> Tap **"Start New Test"** button
- **Action:** Navigate to the Capture screen (`/capture`).
- **Verbal Explanation:**
  > *"When an operator initiates a field test, the application enters our calibrated capture workflow. Here the operator can capture a live camera frame or import an assay image for mathematical telemetry extraction."*

---

### Step 3: Capture / Ingest Image
- **Screen:** Capture Screen (`/capture`)
- **Action:** Select or capture a test assay image (e.g., standard benchmark calibrator image).
- **Verbal Explanation:**
  > *"Upon image acquisition, our edge processing pipeline immediately triggers. Notice that before any processing or display occurs, the raw byte stream is decoded and fingerprinted in memory."*

---

### Step 4: Show Adaptive ROI Localization
- **Screen:** Analysis Preview / ROI Card
- **Action:** Point out the detected Region-of-Interest coordinates `[x, y, width, height]` and detection method (`adaptive_luminance` or `fallback_center`).
- **Verbal Explanation:**
  > *"Instead of relying on rigid, hardcoded crop boxes, our Adaptive ROI algorithm scans spatial luminance gradients to detect the exact boundaries of the assay reaction window. If ambient lighting is degraded, it utilizes a calibrated center fallback, guaranteeing the app never crashes in the field."*

---

### Step 5: Show RGB / Hex / Intensity Telemetry
- **Screen:** Raw Telemetry Card
- **Action:** Point to the exact Red, Green, Blue channel values, Hex code swatch (`#RRGGBB`), and scalar Intensity ($0.0 - 255.0$).
- **Verbal Explanation:**
  > *"Here you see the objective colorimetric telemetry. The system computes the spatial average across the isolated ROI patch, delivering precise RGB channel integers, hexadecimal color values, and luminance intensity. This provides an objective, tamper-evident color measurement rather than an unverified human opinion."*

---

### Step 6: Show Normalized Color Analysis
- **Screen:** Normalization & Color Metrics Card
- **Action:** Highlight the normalized color ratios ($R/I, G/I, B/I$).
- **Verbal Explanation:**
  > *"To mitigate the impact of variable ambient lighting, the raw RGB telemetry is normalized against the overall luminance intensity. This chromaticity transformation preserves relative spectral proportions even under fluctuating illumination levels."*

---

### Step 7: Show Reference Comparison
- **Screen:** Reference Comparison Section
- **Action:** Show the calculated color difference ($\Delta E$) and reference deviation.
- **Verbal Explanation:**
  > *"The system compares the sampled patch against a calibrated baseline reference standard, computing the exact Euclidean color difference ($\Delta E$). This quantitative metric indicates how closely the sample aligns with expected control tones."*

---

### Step 8: Show AI Image-Modality Assessment
- **Screen:** AI Analysis / Modality Card
- **Action:** Show the predicted modality class (e.g., `calibrator_bar`, `calibrator_spot`, `lateral_flow_strip`, or `cropped_roi`) and the raw softmax score.
- **Verbal Explanation:**
  > *"Our lightweight on-device machine learning model evaluates the visual modality of the assay. It is trained on an 8-dimensional feature vector encompassing normalized dimensions, aspect ratio, area, and color metrics. Notice that this classifier assesses assay presentation format—it does not identify substances or chemicals."*

---

### Step 9: Show OOD Status (In-Distribution & Out-of-Distribution Challenge)
- **Screen:** OOD Status Badge & OOD Metric Details
- **Action:** 
  1. Show that for valid benchmark inputs, `classificationStatus` is **`known`** with an OOD distance within the calibrated threshold ($D_{centroid} \le 8.5$).
  2. **Live Challenge:** Import/capture an arbitrary out-of-distribution input (e.g., plain yellow paper or textured surface).
  3. Show the UI instantly triggering the yellow warning box: `classificationStatus: 'unknown'`, `prediction: 'unknown'`, with suppressed prediction.
- **Verbal Explanation:**
  > *"Standard AI models suffer from softmax saturation, giving over 99% confidence on arbitrary blank paper. Field Test Companion implements a strict Out-of-Distribution rejection gate based on feature Z-scores and centroid Euclidean distance. When an uncalibrated or non-assay image is presented, the gate rejects it, marks the status as 'unknown', and suppresses the model prediction with a clear warning."*

---

### Step 10: Show SHA-256 Cryptographic Hash
- **Screen:** Security & Integrity Card
- **Action:** Highlight the full 64-character SHA-256 hash string.
- **Verbal Explanation:**
  > *"For legal and evidentiary chain of custody, the system displays the SHA-256 cryptographic digest generated at the instant of capture. This guarantees that this digital record cannot be substituted, modified, or forged after the fact."*

---

### Step 11: Save Record
- **Screen:** Capture Screen -> Tap **"Save Record"** button
- **Action:** Press save and observe the confirmation feedback.
- **Verbal Explanation:**
  > *"When the operator saves the record, the full telemetry bundle—including raw RGB, Hex, intensity, ROI bounds, SHA-256 hash, timestamps, and modality evaluation—is committed to local persistent storage. Notice that the record status is permanently locked as 'Presumptive (Unanalyzed)' to enforce regulatory safety."*

---

### Step 12: Open Records Screen
- **Screen:** Records Screen (`/records`)
- **Action:** Navigate to Records tab; select the newly created record; expand details.
- **Verbal Explanation:**
  > *"On the Records screen, historical test logs can be reviewed, searched, and verified offline. Every record maintains its cryptographic hash and full telemetry log for auditability."*

---

### Step 13: Explain Non-Diagnostic Safeguards
- **Screen:** Footer Disclaimer & Audit Log
- **Action:** Point out the persistent safety banner on screen.
- **Verbal Explanation:**
  > *"In summary, Field Test Companion is built on the principle of responsible AI. It is strictly a non-diagnostic, objective documentation tool. It does not claim chemical detection or forensic certainty, but provides law enforcement, researchers, and field technicians with verifiable mathematical telemetry and tamper-evident evidence management. Thank you, and we welcome your questions."*
