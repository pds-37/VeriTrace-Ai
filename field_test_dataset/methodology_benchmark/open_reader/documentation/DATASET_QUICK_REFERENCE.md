# Open_Reader Benchmark: Quick Reference

**Package:** Field Test Companion - Methodology Benchmark  
**Source:** [https://github.com/SMR-83/Open_Reader](https://github.com/SMR-83/Open_Reader) (MIT License)  
**Classification:** **Non-Diagnostic Colorimetric Benchmark Only**

---

### Dataset at a Glance

```
Total Images: 108 | Total Size: 4.89 MB | Unreadable Files: 0 | SHA-256 Verified: 100%
```

| Metric | bars | imageJ_ROIs | lateralFlow | spots | Total |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Image Count** | 30 | 18 | 30 | 30 | **108** |
| **Formats** | 30 JPG | 18 PNG | 30 JPG | 30 JPG | **90 JPG, 18 PNG** |
| **`KEEP`** | 30 | 8 | 10 | 30 | **78** (72.2%) |
| **`REVIEW`** | 0 | 8 | 20 | 0 | **28** (25.9%) |
| **`EXCLUDE`** | 0 | 2 | 0 | 0 | **2** (1.9%) |
| **Mean Luminance ($Y$)** | 192.51 | 205.46 | 191.21 | 193.50 | **194.58** |
| **Intensity Range** | 190.92–193.61 | 202.86–230.11 | 184.90–196.61 | 190.95–197.89 | **184.90–230.11** |

---

### Curation Summary

- **`KEEP` (78 Images):**
  - `bars` (30): Geometric bar calibration targets spanning 10 grayscale levels.
  - `spots` (30): Circular spot calibration targets spanning 10 grayscale levels.
  - `lateralFlow` (10): Primary physical strip scans (`*.1.jpg`).
  - `imageJ_ROIs` (8): Clean unannotated cropped test zones (`*c.png`).
- **`REVIEW` (28 Images):**
  - `lateralFlow` (20): Technical replicate captures (`*.2.jpg`, `*.3.jpg`); requires sample-level split isolation.
  - `imageJ_ROIs` (8): Crops with ImageJ bounding box line overlays (`ROI1-8.PNG`).
- **`EXCLUDE` (2 Images):**
  - `ROIResults.PNG`: UI screenshot of ImageJ results table window.
  - `zoom32.PNG`: 32x magnified UI inspection grid graphic.

---

### Key Metadata Artifacts

| File | Path | Description |
| :--- | :--- | :--- |
| **Master Manifest** | `metadata/open_reader_manifest.csv` | 108-row manifest with dimensions, size, and SHA-256 |
| **Color Analysis** | `metadata/open_reader_color_analysis.csv` | 108-row full-pixel RGB, Hex, and Luminance data |
| **Curation Manifest** | `metadata/open_reader_curation.csv` | 108-row KEEP/REVIEW/EXCLUDE classifications |
| **Full Documentation** | `documentation/DATASET_DOCUMENTATION.md` | Comprehensive methodology and governance manual |

---

### Critical Safeguards

> [!IMPORTANT]
> - **Non-Diagnostic:** Telemetry measures optical and digital pixel values only. No chemical reaction or drug detection is performed.
> - **No Drug Ground Truth:** These images derive from calibration targets and paper immunosensors, NOT field reagent drug tests.
> - **No Model Claims:** No classification accuracy, sensitivity, or specificity is asserted.
