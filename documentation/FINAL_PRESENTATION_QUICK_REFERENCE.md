# Field Test Companion — Final Presentation Quick Reference

**Audience:** SIH / Hackathon / Project Evaluation Panel & Technical Judges  
**System:** Offline-First Mobile Field Test Image Telemetry & Non-Diagnostic AI Assistant  
**Core Technologies:** React Native, Expo SDK 52/57, TypeScript, `jpeg-js`, Pure-TS Linear ML & OOD Gating  
**Status:** **100% Validated End-to-End**

---

## 1. Project Overview

**Field Test Companion** is a mobile application designed for field officers and laboratory technicians to standardize field test documentation, capture cryptographic audit trails, perform automated adaptive ROI sampling, compare colors against digital reference standards, and provide non-diagnostic AI modality classification.

---

## 2. End-to-End AI/CV Pipeline

```
Camera Capture / Upload
         ↓
Platform JPEG / Canvas Decode
         ↓
Adaptive Contrast ROI Detector (Downsampled 160x120 Grid)
         ↓
RGB / Hex / Luminance Telemetry & L1 Chromaticity Normalization
         ↓
Digital Color Reference Comparison (REF-OR-BAR / SPOT)
         ↓
Trained Softmax Modality Classifier (8-dim Feature Vector)
         ↓
OOD / Unknown Rejection Gate (Threshold_Centroid = 8.5, Threshold_MaxZ = 5.0)
         ↓
Save Record (SQLite / LocalStorage with SHA-256 Digest)
```

---

## 3. Dataset & Provenance

- **Source:** Open-source `Open_Reader` Methodology Benchmark Dataset.
- **Total Physical Images:** 108 images across 4 modality subfolders.
- **Curation Decisions:** 78 `KEEP`, 28 `REVIEW` (illumination variance notes), 2 `EXCLUDE` (non-assay UI graphics).
- **Usable ML Dataset:** **106 images**.
- **Replicate Leakage Prevention:** Replicates from identical chemical conditions were grouped atomically to prevent near-duplicate leakage across splits.
- **Splits (Seed 42):** Train: **64** ($60.4\%$), Val: **21** ($19.8\%$), Test: **21** ($19.8\%$).

---

## 4. Machine Learning & OOD Architecture

- **Model Type:** Softmax Linear Classifier ($L_2$-Regularized Multinomial Logistic Regression).
- **Features ($d=8$):** $[r_{norm}, g_{norm}, b_{norm}, Y_{norm}, \text{aspect\_w}, \text{aspect\_h}, \text{scale\_factor}, D_{chroma}]$.
- **Held-Out Test Accuracy:** **$71.43\%$** ($15 / 21$ correct on held-out test split).
- **Macro Average F1-Score:** **$74.17\%$** (Precision: $79.17\%$, Recall: $75.00\%$).
- **Majority Baseline:** $28.57\%$ (Model achieves $+42.86\%$ gain over baseline).
- **OOD Rejection Gate:** Centroid distance in $Z$-space $\le 8.5$ and maximum feature $|z| \le 5.0$ (calibrated strictly on validation set with $0.0\%$ false rejection rate).

---

## 5. Security & Cryptographic Auditability

- **SHA-256 Provenance:** Hash computed immediately upon image capture to ensure tamper-evident chain of custody.
- **Offline Architecture:** Zero external cloud dependencies; SQLite database and pure TypeScript inference execute fully locally.
- **Immutable Presumptive Status:** Stored records permanently retain the status `"Presumptive (Unanalyzed)"`.

---

## 6. Live Demonstration Flow

1. **Capture:** Capture photo or select image in camera view.
2. **ROI Localization:** Adaptive contrast detector finds the test region ($160 \times 120$ grid search).
3. **Color Telemetry:** Calculates mean RGB, Hex code, and luminance score.
4. **Reference Comparison:** Matches chromaticity against benchmark baseline standards.
5. **AI Modality Assessment:** Evaluates layout modality (Bar / Spot / Crop / Lateral Flow).
6. **OOD Decision:** Accepts in-distribution benchmark targets; flags non-benchmark scenes as **Unknown (Out of Distribution)**.
7. **Save Record:** Persists record with GPS, Operator ID, SHA-256, and telemetry notes.

---

## 7. Judge Q&A Cheatsheet

### Q1: Why do we need an ROI (Region of Interest)?
> **A:** Real-world photos contain background clutter (hands, tables, lighting shadows). Restricting color sampling to the specific test area ensures that telemetry measures the chemical test strip rather than ambient noise.

### Q2: Why normalize RGB chromaticity?
> **A:** Normalized chromaticity ($r = R/(R+G+B)$) decouples color ratios from overall exposure and brightness variations, allowing consistent digital comparisons across different lighting levels.

### Q3: Why use an Adaptive ROI detector rather than a fixed center box?
> **A:** In field operations, users cannot always center test kits with millimeter precision. Our pure TypeScript gradient-search detector automatically scans the central envelope and locks onto high-contrast test boundaries.

### Q4: Why train a lightweight linear classifier instead of a heavy deep neural network?
> **A:** It delivers sub-millisecond execution ($< 0.15 \text{ ms}$) in pure TypeScript without requiring native C++/WebGL bindings, ensuring $100\%$ zero-dependency compatibility with standard Expo Go and web browsers.

### Q5: How was dataset leakage prevented?
> **A:** In the lateral flow dataset, each sample condition has 3 technical captures (`.1`, `.2`, `.3`). Splitting by raw image would leak near-identical images into the test set. We enforced atomic condition-level grouping, guaranteeing zero condition overlap across splits.

### Q6: Why could a plain yellow sheet fool an uncalibrated softmax classifier?
> **A:** A standard Softmax model partitions the entire mathematical feature space into the known classes without an "Unknown" option. Yellow color produces extreme z-scores ($z > 100$) because the training data was near-grayscale. The linear weights multiply these extreme numbers into an overwhelming logit that saturates softmax to $\sim 99\%$.

### Q7: How does your OOD (Out-of-Distribution) rejection solve this?
> **A:** We implemented a class-centroid distance and feature-deviation gate calibrated on the validation set. If an input's standardized feature distance exceeds benchmark boundaries ($D > 8.5$ or $|z| > 5.0$), it is safely flagged as **Unknown (Out of Distribution)**, preventing false positive classification.

### Q8: Why is this system strictly non-diagnostic?
> **A:** The Open_Reader benchmark contains imaging format data, not chemical ground-truth. To maintain complete scientific integrity, the app classifies test layouts and measures digital color similarities without making unsubstantiated claims about drug presence or chemical positivity.

### Q9: What would be required to transition this prototype into a certified diagnostic tool?
> **A:** Gathering an extensive dataset of chemical reagent reactions confirmed by laboratory Gas Chromatography–Mass Spectrometry (GC/MS) across diverse lighting environments, paired with standardized physical color-calibration cards.
