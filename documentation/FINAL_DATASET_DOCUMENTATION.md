# Field Test Companion — Final Dataset Documentation

**Dataset:** `Open_Reader` Methodology Benchmark Dataset  
**Location:** [`field_test_dataset/methodology_benchmark/open_reader/`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/)  
**Status:** Curated, Audited, and Frozen  
**Classification:** **Colorimetric & Image-Processing Methodology Benchmark (Non-Diagnostic)**

---

> [!IMPORTANT]
> **CRITICAL DATA LIMITATION & NON-DIAGNOSTIC NOTICE:**  
> The Open_Reader dataset is a colorimetric and image-processing methodology benchmark and is **NOT** a drug ground-truth dataset. It contains no validated chemical, forensic, or narcotic labels. It must not be used to train models claiming substance identification or chemical reaction confirmation.

---

## 1. Dataset Provenance & Metadata

- **Original Source Repository:** `SMR-83/Open_Reader`
- **Repository URL:** `https://github.com/SMR-83/Open_Reader`
- **License:** Open-source research benchmark license (details documented in [`LICENSE`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/LICENSE) and [`PROVENANCE.md`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/PROVENANCE.md))
- **Total Physical Source Images:** **108 images**
- **File Extensions:** `.jpg` (102 images), `.PNG` (6 images)
- **Image Integrity:** 108 unique cryptographic SHA-256 digests verified; zero corrupt or missing files.

---

## 2. Directory Structure & Raw Groups

```
field_test_dataset/methodology_benchmark/open_reader/
├── imageDatasets/
│   ├── bars/          (30 images: optical calibration bar targets)
│   ├── spots/         (30 images: optical calibration spot targets)
│   ├── lateralFlow/   (30 images: lateral flow test strips across 12 conditions)
│   └── imageJ_ROIs/   (16 images: pre-cropped localized assay test regions + 2 UI graphics)
└── metadata/
    ├── open_reader_manifest.csv       (108 rows: physical file metadata)
    ├── open_reader_color_analysis.csv (108 rows: baseline RGB & luminance telemetry)
    ├── open_reader_curation.csv       (108 rows: curation classifications)
    ├── FINAL_DATASET_SUMMARY.md       (Summary package)
    └── OPEN_READER_CURATION_REPORT.md (Detailed audit report)
```

---

## 3. Curation Breakdown (Step 6E / 6F)

Every image was audited and classified into exactly one curation tier:

| Curation Status | Count | Description | Action in ML Pipeline |
| :--- | :---: | :--- | :--- |
| **`KEEP`** | **78** | High-quality, valid optical reader benchmark captures. | Retained in ML dataset. |
| **`REVIEW`** | **28** | Valid assay images exhibiting minor illumination or framing variances. | Retained in ML dataset with documented notes. |
| **`EXCLUDE`** | **2** | Non-assay software UI graphics (`ROIResults.PNG`, `zoom32.PNG`). | **Excluded from all ML training & evaluation.** |
| **Total** | **108** | Complete physical image repository. | **106 usable ML instances.** |

---

## 4. Machine Learning Usable Dataset Breakdown ($N = 106$)

After filtering the 2 non-assay UI graphics, the remaining 106 images map to 4 benchmark modality classes:

| Modality Class | Dataset Directory | Sample Count | Format Description |
| :--- | :--- | :---: | :--- |
| `calibrator_bar` | `imageDatasets/bars/` | 30 | Grayscale calibration bar series |
| `calibrator_spot` | `imageDatasets/spots/` | 30 | Grayscale calibration spot series |
| `cropped_roi` | `imageDatasets/imageJ_ROIs/` | 16 | Localized test region crops |
| `lateral_flow_strip` | `imageDatasets/lateralFlow/` | 30 | Lateral flow test strip assays (12 conditions $\times$ 3 replicates) |
| **Total** | | **106** | **Curated ML Dataset** |

---

## 5. Replicate Leakage Prevention

In the `lateralFlow` group, images represent 12 distinct sample conditions with 3 technical captures each (`.1`, `.2`, `.3`).
- **Grouping Policy:** Replicates were clustered by condition (`lf_<condition>`). All captures of any given condition were assigned atomically to a single split partition.
- **Leakage Status:** Verified **0 condition overlap** across train, validation, and test partitions.

---

## 6. Train / Validation / Test Partitioning

Deterministic split executed with random seed `42`:

| Partition | Total Samples | Calibrator Bar | Calibrator Spot | Cropped ROI | Lateral Flow | Percentage |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Train** | **64** | 18 | 18 | 10 | 18 | $60.38\%$ |
| **Validation** | **21** | 6 | 6 | 3 | 6 | $19.81\%$ |
| **Held-Out Test** | **21** | 6 | 6 | 3 | 6 | $19.81\%$ |
| **Total** | **106** | **30** | **30** | **16** | **30** | **100.0%** |

---

## 7. Dataset Limitations & Future Real-World Domain Data

1. **Methodology Benchmark vs. Field Assays:** The Open_Reader dataset was designed to validate optical scanner algorithms, not mobile smartphone cameras in field environments.
2. **Grayscale Bias:** Background surfaces across the benchmark images are near-neutral gray ($R \approx G \approx B \approx 193$), necessitating out-of-distribution rejection gating for non-benchmark colored scenes.
3. **Future Data Requirements:** Transitioning to certified chemical screening will require collecting certified chemical reaction images with laboratory GC/MS confirmation and standardized physical color-calibration target cards.
