# FIELD TEST COMPANION — JUDGE / HOD DEFENSE Q&A
**Factual, Mathematical, and Architectural Technical Defense Guide**

---

### Q1: What problem does the project solve?
**Answer:**  
Presumptive field color tests (such as colorimetric spot tests and lateral flow assays) rely on subjective human visual inspection under uncontrolled ambient lighting. This leads to perceptual bias, unrecorded color data, lack of evidence chain of custody, and uncalibrated photographic documentation. Field Test Companion solves this by automating on-device Region of Interest (ROI) extraction, logging objective mathematical RGB/Hex/Intensity telemetry, normalizing chromaticity against reference baselines, providing cryptographic SHA-256 evidence sealing, and classifying assay modality with strict Out-of-Distribution (OOD) rejection guardrails.

---

### Q2: Why is ROI detection needed?
**Answer:**  
A raw camera frame contains background noise, fingers, packaging, table surfaces, and uneven shadows. Extracting the specific Region of Interest (ROI) isolates the active chemical reaction window or calibration strip. This ensures color sampling computes telemetry exclusively over the active assay area rather than background artifacts.

---

### Q3: Why use RGB?
**Answer:**  
RGB is the native three-channel digital color representation produced by smartphone CMOS camera sensors and JPEG decoding pipelines. Extracting individual Red, Green, and Blue pixel intensity values ($0 - 255$) provides raw, uncompressed colorimetry that can be mathematically averaged, converted to standard Hex codes, transformed into luminance intensity ($0.299R + 0.587G + 0.114B$), and mapped into normalized chromaticity coordinates.

---

### Q4: Why normalize colors?
**Answer:**  
Raw RGB values fluctuate heavily when ambient illumination changes (e.g., direct sunlight vs. indoor fluorescent lighting). Color normalization divides each RGB channel by the total luminance intensity ($R/I, G/I, B/I$), isolating chromaticity (color tint/spectral balance) from pure luminance (brightness). This allows more consistent comparative telemetry across different field lighting environments.

---

### Q5: What is the reference comparison?
**Answer:**  
The reference comparison evaluates the sampled ROI color against calibrated baseline control values. It calculates the Euclidean color distance ($\Delta E = \sqrt{\Delta R^2 + \Delta G^2 + \Delta B^2}$) and relative intensity shifts, giving field technicians an objective mathematical metric of how much the sample deviates from standard control tones.

---

### Q6: What dataset was used?
**Answer:**  
The project utilized the open-source **Open_Reader** benchmark dataset created by Kevin DeRosier (MIT License, [GitHub: Open_Reader](https://github.com/derosierk/Open_Reader)). It contains 108 raw colorimetric assay and calibration images.

---

### Q7: Why is Open_Reader used?
**Answer:**  
Open_Reader provides high-quality, diverse, open-source colorimetric assay and calibration imagery exhibiting real-world variations in lighting, orientation, aspect ratios, and assay formats. It serves as an ideal methodology benchmark for validating computer vision algorithms, JPEG decoders, adaptive ROI locators, and modality classification pipelines.

---

### Q8: Is Open_Reader a drug dataset?
**Answer:**  
**No.** The Open_Reader dataset is an image-processing and colorimetric assay methodology benchmark. It does **not** contain ground-truth illicit drug labels, chemical spectra, or forensic substance confirmations. It is explicitly used to evaluate assay presentation formats (strip vs. spot vs. bar) and visual telemetry pipelines.

---

### Q9: What ML model is used?
**Answer:**  
The machine learning component is a **Softmax Linear Classifier** (Multinomial Logistic Regression) parameterized with learned weights ($4 \times 8$) and biases ($4 \times 1$). It was trained using Cross-Entropy loss with $L_2$ regularization ($\lambda = 0.01$) on standardized 8-dimensional feature vectors.

---

### Q10: What features does the model use?
**Answer:**  
The model uses an 8-dimensional engineered feature vector:
1. `roi_width_norm`: ROI width normalized by image width.
2. `roi_height_norm`: ROI height normalized by image height.
3. `aspect_ratio`: ROI width divided by ROI height ($w/h$).
4. `area_norm`: ROI bounding box area normalized by image area.
5. `r_norm`: Mean Red channel value normalized to $[0, 1]$.
6. `g_norm`: Mean Green channel value normalized to $[0, 1]$.
7. `b_norm`: Mean Blue channel value normalized to $[0, 1]$.
8. `intensity_norm`: Mean luminance intensity normalized to $[0, 1]$.

---

### Q11: How was the dataset split?
**Answer:**  
The 106 curated, usable samples from Open_Reader were partitioned using stratified sampling:
- **Training Set:** 64 samples ($60.38\%$)
- **Validation Set:** 21 samples ($19.81\%$)
- **Held-Out Test Set:** 21 samples ($19.81\%$)

---

### Q12: How was leakage addressed?
**Answer:**  
All feature scaling parameters ($\mu$ and $\sigma$ for standard normalization) and Out-of-Distribution thresholds were fitted **exclusively on the training and validation sets**. The held-out test set ($N=21$) was completely sequestered and only evaluated once during final model scoring, ensuring zero data leakage.

---

### Q13: What were the measured test metrics?
**Answer:**  
Evaluated strictly on the held-out test set ($N=21$):
- **Accuracy:** **71.43%** ($15 / 21$ correct)
- **Macro Precision:** **79.17%**
- **Macro Recall:** **75.00%**
- **Macro F1-Score:** **74.17%**
- **Majority-Class Baseline:** **28.57%** (Demonstrating a $+42.86\%$ relative gain above trivial guessing).

---

### Q14: Why can softmax be overconfident?
**Answer:**  
Softmax normalizes unconstrained linear logits into a probability distribution via exponential exponentiation ($\frac{e^{z_i}}{\sum e^{z_j}}$). For inputs far outside the training distribution, even arbitrary linear projections produce a dominant logit that results in extreme, saturated probabilities ($>95\%$) despite having zero semantic resemblance to the training classes.

---

### Q15: What is OOD rejection?
**Answer:**  
Out-of-Distribution (OOD) rejection is a safety gate that detects whether an input feature vector lies outside the geometric and statistical support of the training data. If an input is identified as out-of-distribution, the system rejects it, labels it as `unknown`, and suppresses the classifier's class prediction.

---

### Q16: How does the system handle unknown images?
**Answer:**  
Field Test Companion executes a dual-constraint OOD safety gate before displaying predictions:
1. **Centroid Distance Constraint:** $D_{centroid} = \min_{c} ||Z - \mu_c||_2 \le 8.5$ (in standardized $Z$-score space).
2. **Extreme Z-Score Constraint:** $\max_i |Z_i| \le 5.0$.  
If either threshold is violated (e.g., yellow paper: $D_{centroid} = 527.63 > 8.5$), the system sets `classificationStatus: 'unknown'`, sets `prediction: 'unknown'`, displays an OOD alert banner, and completely suppresses the raw softmax prediction.

---

### Q17: Why is this not a diagnostic system?
**Answer:**  
Field chemical color tests are inherently presumptive and non-specific. False positives and cross-reactions can occur with common household chemicals, cutting agents, and pharmaceuticals. True confirmation requires laboratory analytical instruments such as Gas Chromatography–Mass Spectrometry (GC-MS) or High-Performance Liquid Chromatography (HPLC). Field Test Companion strictly enforces presumptive labeling (`Presumptive (Unanalyzed)`) to uphold legal and scientific integrity.

---

### Q18: What happens if lighting changes?
**Answer:**  
The system employs multiple levels of mitigation:
1. Spatial averaging over the ROI reduces localized specular reflections.
2. Color normalization ($R/I, G/I, B/I$) isolates chromaticity from absolute luminance variations.
3. If lighting is too extreme ($I > 250$ or $I < 15$), the quality score drops and the center-fallback ensures graceful degradation rather than erroneous processing.

---

### Q19: What happens if the image is blurred?
**Answer:**  
The adaptive ROI detection calculates spatial contrast gradients across candidate regions. If an image is severely blurred or out of focus, the contrast gradient falls below threshold, triggering the calibrated center-fallback mode and assigning a low ROI quality score to warn the operator.

---

### Q20: What is the role of SHA-256?
**Answer:**  
SHA-256 creates a 256-bit (64-character hexadecimal) cryptographic hash directly from the raw captured image byte stream. This hash is embedded into the test record at creation time. If the image file is later edited, cropped, or replaced, re-hashing will yield a completely different digest, providing tamper-evident verification for chain of custody.

---

### Q21: What currently works offline?
**Answer:**  
**100% of the core architecture works offline.** The camera frame capture, JPEG pixel decoding, adaptive ROI detection, RGB/Hex/Intensity extraction, color normalization, reference comparison, ML modality classification, OOD rejection gating, SHA-256 hashing, and SQLite/AsyncStorage record persistence all run strictly on-device with zero internet connectivity.

---

### Q22: What would be required for future real-world validation?
**Answer:**  
Deploying this architecture for real-world presumptive testing requires:
1. Multi-center field testing protocols approved by institutional/legal ethics review boards.
2. Certified physical reference color cards (such as 24-patch Macbeth charts) with fiducial markers for real-time camera perspective correction and white-balance calibration.
3. A large-scale, laboratory-verified ground-truth dataset pairing high-resolution test kit imagery with verified GC-MS analytical laboratory results.

---

### Q23: What are the current limitations?
**Answer:**  
1. **Benchmark Modality Scope:** The current ML model categorizes assay visual formats (strip vs. spot vs. bar); it does not classify chemical substances or determine positive/negative test outcomes.
2. **Lighting Extremes:** Highly uneven shadows or extreme backlight can skew uncalibrated color channels.
3. **Planar Perspective Assumption:** Severe camera tilt angles ($> 25^\circ$) may distort bounding box aspect ratio features.
