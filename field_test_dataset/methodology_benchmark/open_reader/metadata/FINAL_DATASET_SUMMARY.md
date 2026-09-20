# Open_Reader Benchmark Dataset: Final Dataset Summary

**Document Version:** 1.0  
**Package Date:** 2026-09-19  
**Dataset Location:** `field_test_dataset/methodology_benchmark/open_reader/`  
**License:** MIT ([SMR-83/Open_Reader](https://github.com/SMR-83/Open_Reader))  
**Diagnostic Posture:** **NON-DIAGNOSTIC METHODOLOGY BENCHMARK ONLY**.

---

## 1. Dataset Provenance & Identity

- **Source Repository:** SMR-83 / Open_Reader
- **Source URL:** [https://github.com/SMR-83/Open_Reader](https://github.com/SMR-83/Open_Reader)
- **Primary Scientific Publication:** *Improving the accuracy of colorimetric detection in paper-based immunosensors with an open-source reader* (Sensors 2022, 22(5), 1880; DOI: 10.3390/s22051880).
- **License:** MIT License (Full text preserved in [`LICENSE`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/LICENSE)).
- **Provenance Record:** [`PROVENANCE.md`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/PROVENANCE.md).

---

## 2. Quantitative Inventory

### Image Counts by Group and File Format
| Dataset Group | JPG (`.jpg`) | PNG (`.png`/`.PNG`) | Total Images | Total File Size |
| :--- | :---: | :---: | :---: | :---: |
| **`bars`** | 30 | 0 | **30** | 1,223,595 bytes |
| **`imageJ_ROIs`** | 0 | 18 | **18** | 1,811,940 bytes |
| **`lateralFlow`** | 30 | 0 | **30** | 895,357 bytes |
| **`spots`** | 30 | 0 | **30** | 1,199,175 bytes |
| **Total Dataset** | **90** | **18** | **108** | **5,130,067 bytes (~4.89 MB)** |

---

## 3. Curation Breakdown

All 108 images are indexed in [`open_reader_curation.csv`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/metadata/open_reader_curation.csv) and classified into three mutually exclusive curation states:

| Status | Count | Percentage | Description / Composition |
| :--- | :---: | :---: | :--- |
| **`KEEP`** | **78** | **72.2%** | Valid benchmark targets: 30 `bars`, 30 `spots`, 10 primary `lateralFlow` (`*.1.jpg`), 8 unannotated clean `imageJ_ROIs` (`*c.png`). |
| **`REVIEW`** | **28** | **25.9%** | Technical repeats and annotated files: 20 `lateralFlow` repeat captures (`*.2.jpg`, `*.3.jpg`), 8 annotated `imageJ_ROIs` (`ROI1-8.PNG`). |
| **`EXCLUDE`** | **2** | **1.9%** | Non-assay graphics: `OR-0047` (`ROIResults.PNG` - results table screenshot), `OR-0048` (`zoom32.PNG` - 32x UI zoom overlay). |
| **Total** | **108** | **100.0%** | **Complete verified dataset** |

---

## 4. Integrity & Telemetry Status

- **Readability & Decodability:** 108 / 108 files (100.0%) successfully decoded across all pixels. Corrupted files: **0**.
- **Cryptographic Uniqueness:** 108 unique SHA-256 hashes verified; 0 exact byte duplicates.
- **Colorimetric Telemetry:** Available for all 108 files in [`open_reader_color_analysis.csv`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/metadata/open_reader_color_analysis.csv).
- **Overall Mean Luminance ($Y = 0.299R + 0.587G + 0.114B$):** 194.58 (Range: 184.90 – 230.11).

---

## 5. Scope, Boundaries & Limitations

> [!WARNING]
> **CRITICAL NON-DIAGNOSTIC NOTICE:**
> 1. **NOT a Drug Test Ground-Truth Dataset:** This benchmark consists of calibration shapes (printed bars/spots) and paper-based immunosensor lateral flow test strips from optical reader research. It does **NOT** contain chemical colorimetric reagent reactions (e.g., Marquis, Mecke, Simon's, Scott) or narcotic substances.
> 2. **No Presumptive Classification Claims:** The 78 `KEEP` images are curated solely as valid digital image-processing benchmarks (geometric linearity, ROI segmentation, and optical density telemetry). They MUST NOT be represented as training samples or ground truth for drug identification or positive/negative classification.
> 3. **No Model Performance Claims:** No machine learning accuracy, sensitivity, specificity, or predictive metrics are asserted.
