# Open_Reader Benchmark Curation & Quality Review Report

**Document Version:** 1.0  
**Review Date:** 2026-09-19  
**Dataset Path:** `field_test_dataset/methodology_benchmark/open_reader/`  
**License:** MIT ([SMR-83/Open_Reader](https://github.com/SMR-83/Open_Reader))  
**Diagnostic Posture:** **NON-DIAGNOSTIC**. Curation is strictly based on digital image modality, calibration target validity, Region of Interest (ROI) cleanliness, and technical replicate isolation.

---

## 1. Executive Curation Summary

A comprehensive quality review was performed across all **108 images** in the Open_Reader benchmark dataset. Each image was evaluated for structural validity, digital artifacts, visual integrity, and role in colorimetric benchmarking.

Every image has been classified into one of three explicit curation states:
- **`KEEP`**: Valid assay test images, clean ROI crops, or geometric calibration reference targets ready for colorimetric evaluation.
- **`REVIEW`**: Technical repeat captures (near-duplicates) or annotated images requiring human validation or strict sample-level split isolation.
- **`EXCLUDE`**: Non-assay graphics, user interface (UI) screenshots, or inspection overlays that must not be ingested into colorimetry or machine learning pipelines.

### Exact Curation Counts

| Curation Status | Count | Percentage | Primary Composition |
| :--- | :---: | :---: | :--- |
| **`KEEP`** | **78** | **72.2%** | 30 `bars`, 30 `spots`, 10 primary `lateralFlow` (.1), 8 unannotated `imageJ_ROIs` (`*c.png`) |
| **`REVIEW`** | **28** | **25.9%** | 20 `lateralFlow` technical replicates (.2, .3), 8 annotated `imageJ_ROIs` (`ROI1-8.PNG`) |
| **`EXCLUDE`** | **2** | **1.9%** | 1 ImageJ results table screenshot, 1 UI 32x zoom inspection graphic |
| **Total** | **108** | **100.0%** | **All files in dataset** |

---

## 2. Image Category Breakdown & Taxonomy

```
Open_Reader Benchmark (108 images)
├── Calibration / Reference Targets (60 images) -> 100% KEEP
│   ├── bars/ (30 images) [largeBar, mediumBar, smallBar @ 10 intensity steps]
│   └── spots/ (30 images) [largeCircle, mediumCircle, smallCircle @ 10 intensity steps]
├── Assay / Test Images (30 images in lateralFlow/)
│   ├── Primary Condition Strips (10 images, .1.jpg) -> KEEP
│   └── Technical Replicates / Near-Duplicates (20 images, .2.jpg & .3.jpg) -> REVIEW
└── Region of Interest (ROI) & Interface Graphics (18 images in imageJ_ROIs/)
    ├── Unannotated Grayscale ROI Crops (8 images, ROI1c.png - ROI8c.png) -> KEEP
    ├── Bounding Box Annotated ROI Crops (8 images, ROI1.PNG - ROI8.PNG) -> REVIEW
    └── Non-Assay UI Screenshots / Graphics (2 images) -> EXCLUDE
        ├── ROIResults.PNG (Spreadsheet table screenshot)
        └── zoom32.PNG (32x magnified UI pixel grid overlay)
```

---

## 3. Group-by-Group Curation Analysis

### A. `bars` (30 Images — All `KEEP`)
- **Category:** Calibration / Reference Images.
- **Characteristics:** Controlled synthetic/printed rectangular bar targets spanning 10 grayscale intensity levels ($0, 25, 50, 75, 100, 125, 150, 175, 200, 225$) across 3 geometrical widths (`large`, `medium`, `small`).
- **Curation Decision:** **`KEEP`** (30 / 30).
- **Justification:** Essential reference targets for verifying spatial linearity, aspect ratio scaling, and grayscale transfer function calibration.

### B. `spots` (30 Images — All `KEEP`)
- **Category:** Calibration / Reference Images.
- **Characteristics:** Controlled circular spot targets spanning 10 grayscale intensity levels across 3 diameter variations (`large`, `medium`, `small`).
- **Curation Decision:** **`KEEP`** (30 / 30).
- **Justification:** Valid calibration standards for circular morphology detection, center-of-mass ROI localization, and radial intensity profiling.

### C. `lateralFlow` (30 Images — 10 `KEEP`, 20 `REVIEW`)
- **Category:** Assay / Test Images.
- **Characteristics:** Photographic scans of physical paper-based lateral flow test strips across 10 dilution/control conditions (`HealthyControl1to1`, `HealthyControl1to2`, `vaccinated1to1` through `vaccinated1to512`), each captured with 3 technical replicates (`.1`, `.2`, `.3`).
- **Curation Decisions:**
  - **Primary Captures (`*.1.jpg`, 10 images): `KEEP`**
    - *Justification:* Representative primary scan for each dilution tier.
  - **Technical Replicates (`*.2.jpg`, `*.3.jpg`, 20 images): `REVIEW`**
    - *What requires verification:* These images are repeat captures of the exact same physical test strip under identical conditions. If used in machine learning evaluation or training/validation splits, they must be grouped strictly by sample/condition ID to prevent data leakage across splits.

### D. `imageJ_ROIs` (18 Images — 8 `KEEP`, 8 `REVIEW`, 2 `EXCLUDE`)
- **Category:** ROI Crops & Analytical Screenshots.
- **Curation Decisions:**
  - **Clean Cropped ROIs (`ROI1c.png` through `ROI8c.png`, 8 images): `KEEP`**
    - *Justification:* Pure grayscale ($R=G=B$) unannotated crops of test zone reactive areas.
  - **Annotated ROIs (`ROI1.PNG` through `ROI8.PNG`, 8 images): `REVIEW`**
    - *What requires verification:* These files contain synthetic ImageJ bounding box and crosshair line overlays (yielding maximum channel differences of $\Delta_{RG} = 255$ along line perimeters). Human review is needed to confirm whether the unannotated companion (`ROIxc.png`) should be used instead to avoid colorimetric distortion.
  - **Excluded Graphics (2 images): `EXCLUDE`**
    1. **`OR-0047` (`ROIResults.PNG`):**
       - *Reason:* **UI screenshot of ImageJ results table window rather than an assay or calibration image.** Contains tabular text, column headers, window chrome, and white background pixels ($Y=230.11$).
    2. **`OR-0048` (`zoom32.PNG`):**
       - *Reason:* **Non-assay visual graphic: 32x zoomed pixel grid and UI inspection window.** Contains magnified UI visualization lines rather than a standard planar assay capture.

---

## 4. Integrity & Data Quality Verification

- **File Corruption / Unreadable Images:** **0** (All 108 files successfully decoded and verified).
- **Exact Duplicate File Hashes (Byte-for-byte):** **0** (All 108 SHA-256 hashes are unique).
- **Original Files Preserved:** All 108 original image files and manifest rows remain completely unaltered.
- **Manifest Reference:** Detailed row-level curation decisions are recorded in [`open_reader_curation.csv`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/metadata/open_reader_curation.csv).

---

## 5. Non-Diagnostic Compliance Notice

> [!IMPORTANT]
> **Methodology Benchmark Disclaimer:**
> - Curation classifications (`KEEP`, `REVIEW`, `EXCLUDE`) indicate suitability for image-processing, geometric calibration, and non-diagnostic colorimetric telemetry algorithms only.
> - No image is labeled, interpreted, or curated as a drug-positive, drug-negative, or confirmed chemical reaction result.
> - No classification model accuracy or diagnostic efficacy is claimed or implied.
