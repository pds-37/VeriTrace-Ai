# Open_Reader Benchmark Dataset Manifest & Documentation

## 1. Overview & Purpose
This metadata directory contains the structured manifest (`open_reader_manifest.csv`) for the imported **Open_Reader** image benchmark dataset.

* **Primary Purpose**: Used exclusively as a methodology benchmark to evaluate colorimetric image analysis, Region of Interest (ROI) extraction, and calibration algorithms.
* **Non-Diagnostic Notice**: This dataset does **NOT** contain drug-classification ground-truth data. No image is labeled as `drug_positive`, `drug_negative`, `confirmed_drug`, or `unknown_drug`.

---

## 2. Source & License Information

* **Upstream Repository**: [`SMR-83/Open_Reader`](https://github.com/SMR-83/Open_Reader)
* **Associated Academic Paper**: *"Improving the accuracy of colorimetric detection in paper-based immunosensors with an open-source reader"* (Sensors 2022, DOI: [10.3390/s22051880](https://doi.org/10.3390/s22051880))
* **License**: **MIT License** (Copyright (c) 2022 Steven, preserved in `../LICENSE`)
* **Intended Use**: Colorimetric & image-processing methodology benchmark only.

---

## 3. Manifest Schema & Field Definitions

The file `open_reader_manifest.csv` defines 16 columns for each imported image file:

| Column Header | Data Type | Description |
| :--- | :--- | :--- |
| `image_id` | `STRING` | Unique identifier formatted as `OR-0001` through `OR-0108`. |
| `relative_path` | `STRING` | Relative file path from the `open_reader` root directory. |
| `filename` | `STRING` | Exact original filename. |
| `file_extension` | `STRING` | File extension (`.jpg` or `.PNG`). |
| `dataset_group` | `ENUM` | Specific test category: `bars`, `imageJ_ROIs`, `lateralFlow`, or `spots`. |
| `source_repository` | `STRING` | Origin repository identifier (`SMR-83/Open_Reader`). |
| `source_url` | `STRING` | Direct repository URL (`https://github.com/SMR-83/Open_Reader`). |
| `license` | `STRING` | Applicable license (`MIT`). |
| `provenance_status` | `STRING` | Origin status (`external_benchmark`). |
| `intended_use` | `STRING` | Designated application (`colorimetric/image-processing benchmark`). |
| `label_status` | `STRING` | Label classification (`benchmark_reference_only`). |
| `image_width` | `INTEGER` | Actual pixel width of the image. |
| `image_height` | `INTEGER` | Actual pixel height of the image. |
| `file_size_bytes` | `INTEGER` | Exact file size on disk in bytes. |
| `sha256` | `STRING (64 Hex)` | Cryptographic SHA-256 hash identifying the exact image file. |
| `notes` | `STRING` | Descriptive technical note on image group and non-diagnostic constraints. |

---

## 4. Integrity & Provenance Verification

* **Cryptographic Hashing**: Every image row contains a bitwise SHA-256 hash calculated directly from the file content.
* **Zero Duplicates**: All 108 files have unique SHA-256 digests.
* **Zero File Corruption**: All images have been verified as fully readable with non-zero dimensions.
