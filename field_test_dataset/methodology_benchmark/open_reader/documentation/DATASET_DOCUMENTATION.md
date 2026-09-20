# Open_Reader Colorimetric Benchmark Dataset Documentation

**Package Name:** Field Test Companion - Methodology Benchmark: Open_Reader  
**Dataset Version:** 1.0  
**Release Date:** 2026-09-19  
**License:** MIT ([Open_Reader](https://github.com/SMR-83/Open_Reader))  
**Diagnostic Scope:** **Strictly Non-Diagnostic Methodology Benchmark**.

---

## 1. Purpose & Overview

The **Open_Reader Colorimetric Benchmark Dataset** is imported into the Field Test Companion repository to serve as an open, standardized image-processing and colorimetric benchmark. 

Its primary purpose is to provide:
1. Standardized geometric targets (bars and circles) to test spatial scaling, aspect ratio preservation, and optical transfer linearity.
2. Real-world paper-based lateral flow strip images to test region-of-interest (ROI) extraction and multi-channel telemetry algorithms.
3. Reference baseline measurements for automated RGB, Hex, and luminance calculation pipelines.

---

## 2. Source & Provenance

- **Originating Repository:** [https://github.com/SMR-83/Open_Reader](https://github.com/SMR-83/Open_Reader)
- **Scientific Foundation:** *Improving the accuracy of colorimetric detection in paper-based immunosensors with an open-source reader*, Sensors 2022, 22(5), 1880 (DOI: 10.3390/s22051880).
- **License Terms:** Openly licensed under the terms of the MIT License. A complete copy of the original license is preserved in [`LICENSE`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/LICENSE).
- **Import Integrity:** All 108 raw image files were imported without recompression, downsampling, or alteration. Complete SHA-256 cryptographic provenance is documented in [`PROVENANCE.md`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/PROVENANCE.md).

---

## 3. Directory Structure

```
field_test_dataset/methodology_benchmark/open_reader/
├── LICENSE                                    # Original MIT License
├── PROVENANCE.md                              # Upstream source and acquisition metadata
├── documentation/
│   ├── DATASET_DOCUMENTATION.md               # Comprehensive dataset guide (this document)
│   └── DATASET_QUICK_REFERENCE.md             # One-page executive reference sheet
├── imageDatasets/                             # Unmodified raw benchmark images (108 files)
│   ├── bars/                                  # 30 rectangular bar calibration images (.jpg)
│   ├── imageJ_ROIs/                           # 18 ROI crops and analytical screenshots (.png/.PNG)
│   ├── lateralFlow/                           # 30 lateral-flow strip scans (.jpg)
│   └── spots/                                 # 30 circular spot calibration images (.jpg)
└── metadata/
    ├── README.md                              # Metadata directory overview
    ├── open_reader_manifest.csv               # 108-row master manifest with file attributes & SHA-256
    ├── open_reader_color_analysis.csv         # 108-row full-pixel colorimetric telemetry
    ├── open_reader_curation.csv               # 108-row curation classifications (KEEP/REVIEW/EXCLUDE)
    ├── OPEN_READER_ANALYSIS_REPORT.md         # Statistical colorimetric analysis report
    ├── OPEN_READER_CURATION_REPORT.md         # Curation methodology and findings report
    └── FINAL_DATASET_SUMMARY.md               # High-level dataset summary
```

---

## 4. Metadata Schema

The dataset includes three core CSV metadata tables linked through the primary key `image_id` (`OR-0001` through `OR-0108`):

### 1. `open_reader_manifest.csv`
| Column | Type | Description |
| :--- | :--- | :--- |
| `image_id` | String | Unique identifier (`OR-0001` to `OR-0108`) |
| `relative_path` | String | Relative path from dataset root to file |
| `filename` | String | Base filename with extension |
| `file_extension` | String | Lowercase extension (`.jpg`, `.png`) |
| `dataset_group` | String | Benchmark group (`bars`, `imageJ_ROIs`, `lateralFlow`, `spots`) |
| `source_repository` | String | Upstream repo (`SMR-83/Open_Reader`) |
| `source_url` | String | Full source URL |
| `license` | String | License identifier (`MIT`) |
| `provenance_status` | String | `verified_imported_benchmark` |
| `intended_use` | String | `colorimetric_and_image_processing_benchmark_only` |
| `label_status` | String | `unlabeled_benchmark_not_ground_truth` |
| `image_width` | Integer | Native image width in pixels |
| `image_height` | Integer | Native image height in pixels |
| `file_size_bytes` | Integer | Raw file size in bytes |
| `sha256` | String | 64-character SHA-256 cryptographic hash |
| `notes` | String | Contextual notes |

### 2. `open_reader_color_analysis.csv`
| Column | Type | Description |
| :--- | :--- | :--- |
| `image_id` | String | Primary key linking to manifest |
| `filename` | String | Image filename |
| `dataset_group` | String | Benchmark group |
| `image_width` | Integer | Pixel width |
| `image_height` | Integer | Pixel height |
| `avg_r` | Float | Mean Red channel intensity (0.00 – 255.00) |
| `avg_g` | Float | Mean Green channel intensity (0.00 – 255.00) |
| `avg_b` | Float | Mean Blue channel intensity (0.00 – 255.00) |
| `avg_hex` | String | 6-character hexadecimal color representation (`#RRGGBB`) |
| `luminance_intensity` | Float | Weighted luminance $Y = 0.299R + 0.587G + 0.114B$ |
| `notes` | String | Analysis methodology notes |

### 3. `open_reader_curation.csv`
| Column | Type | Description |
| :--- | :--- | :--- |
| `image_id` | String | Primary key linking to manifest |
| `relative_path` | String | Relative path to image |
| `dataset_group` | String | Benchmark group |
| `curation_status` | String | Exactly one of: `KEEP`, `REVIEW`, `EXCLUDE` |
| `reason` | String | Concrete justification for curation state |
| `original_hash` | String | SHA-256 hash for integrity validation |
| `notes` | String | Operational and split-isolation recommendations |

---

## 5. Analysis & Curation Methodologies

### Colorimetric Telemetry Computation
Every image was processed across 100% of its native pixels without spatial downsampling. 
- Pixel buffer decoding used 32-bit ARGB uncompressed memory buffers.
- Channel averages ($\bar{R}, \bar{G}, \bar{B}$) were computed by summing raw unsigned 8-bit integers divided by total pixel count ($W \times H$).
- Luminance intensity was computed via CCIR 601 coefficients:
  $$Y = 0.299 \bar{R} + 0.587 \bar{G} + 0.114 \bar{B}$$

### Curation Decision Framework
1. **`KEEP` (78 images):**
   - 30 `bars`: Grayscale calibration targets ($R=G=B$).
   - 30 `spots`: Grayscale spot calibration targets ($R=G=B$).
   - 10 primary `lateralFlow` (`*.1.jpg`): Primary strip captures.
   - 8 clean `imageJ_ROIs` (`*c.png`): Pure cropped assay reactive zones without text or bounding box overlays.
2. **`REVIEW` (28 images):**
   - 20 `lateralFlow` repeat captures (`*.2.jpg`, `*.3.jpg`): Technical near-duplicate captures of the same physical strips.
   - 8 annotated `imageJ_ROIs` (`ROI1-8.PNG`): Crops containing colored ImageJ selection boxes / crosshairs ($\Delta_{RG} = 255$).
3. **`EXCLUDE` (2 images):**
   - `OR-0047` (`ROIResults.PNG`): UI spreadsheet table screenshot.
   - `OR-0048` (`zoom32.PNG`): 32x zoomed UI pixel inspection frame.

---

## 6. Data Quality & Leakage Safeguards

- **Bit-Level Integrity:** 0 corrupted or unreadable images out of 108.
- **Hash Verification:** 108 unique SHA-256 hashes confirm no accidental duplicate file copies exist.
- **Data Leakage Mitigation:**
  - The 20 repeat captures (`*.2.jpg`, `*.3.jpg`) in `lateralFlow` represent technical replicates of the same underlying physical strips.
  - If any subset of this dataset is partitioned into training, validation, or test folds for future research, images MUST be partitioned at the **sample/condition level** (`HealthyControl1to1`, `vaccinated1to1`, etc.), never randomly at the image level.

---

## 7. Permitted Use & Limitations

### Permitted Uses
- Validating digital image ingestion and colorimetric extraction algorithms.
- Testing image quality metrics, noise thresholds, and illumination invariance algorithms.
- Benchmarking region-of-interest (ROI) detection and bounding box localization.

### Prohibited / Invalid Uses
- **DO NOT** use as ground truth for presumptive drug testing or chemical narcotics identification.
- **DO NOT** interpret grayscale values or lateral flow dilution bands as positive/negative drug detection indicators.
- **DO NOT** claim diagnostic sensitivity, specificity, accuracy, or clinical/forensic efficacy based on this dataset.

---

## 8. Future Roadmap

1. **Synthetic & Simulated Chemical Reaction Benchmarks:** Introduce standardized color charts (e.g., Munsell / ColorChecker) for lighting calibration.
2. **Standardized Reagent Ground-Truth Collection:** Establish a laboratory-verified sample collection protocol (governed by Step 6A labeling manifest) prior to any substance classification model training.
