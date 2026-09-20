# Open_Reader Colorimetric Benchmark Analysis Report

**Document Version:** 1.0  
**Analysis Date:** 2026-09-19  
**Dataset Source:** [SMR-83/Open_Reader](https://github.com/SMR-83/Open_Reader) (MIT License)  
**Intended Use:** Technical image-processing and colorimetric telemetry verification only.  
**Diagnostic Status:** **NON-DIAGNOSTIC**. No presumptive drug testing, positive/negative classification, or substance identification is performed.

---

## 1. Executive Summary

This report documents the image-processing and colorimetric analysis performed on the 108 benchmark images imported from the open-source `Open_Reader` repository. Every image was decoded and analyzed programmatically across its full pixel dimensions to extract core image telemetry (Width, Height, Mean Red, Mean Green, Mean Blue, Mean Hex Color, and Luminance/Intensity).

All computed values have been exported to [`open_reader_color_analysis.csv`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/metadata/open_reader_color_analysis.csv), linked directly via `image_id` to [`open_reader_manifest.csv`](file:///c:/Users/PIYUSH/app/field-test-companion/field_test_dataset/methodology_benchmark/open_reader/metadata/open_reader_manifest.csv).

### High-Level Metrics
- **Total Images in Manifest:** 108
- **Successfully Analyzed Images:** 108 (100.0%)
- **Failed / Unreadable Images:** 0 (0.0%)
- **Overall Mean Luminance / Intensity:** 194.58 (Range: 184.90 – 230.11)
- **Overall Mean RGB:** R: 194.41, G: 194.61, B: 194.90

---

## 2. Group-Wise Colorimetric Statistics

The dataset comprises 4 distinct benchmark sub-categories. Color channel averages and luminance intensities ($Y = 0.299R + 0.587G + 0.114B$) were evaluated per group:

| Dataset Group | Image Count | Mean R | Mean G | Mean B | Mean Intensity | Intensity StdDev | Intensity Range (Min – Max) | Representative Hex |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`bars`** | 30 | 192.51 | 192.51 | 192.51 | **192.51** | 0.54 | 190.92 – 193.61 | `#C1C1C1` |
| **`imageJ_ROIs`** | 18 | 204.43 | 205.61 | 207.35 | **205.46** | 6.04 | 202.86 – 230.11 | `#CDCDCD` |
| **`lateralFlow`** | 30 | 191.21 | 191.21 | 191.21 | **191.21** | 4.44 | 184.90 – 196.61 | `#BFBFBF` |
| **`spots`** | 30 | 193.50 | 193.50 | 193.50 | **193.50** | 1.02 | 190.95 – 197.89 | `#C1C1C1` |
| **Total / Overall** | **108** | **194.41** | **194.61** | **194.90** | **194.58** | **6.03** | **184.90 – 230.11** | **`#C2C2C2`** |

---

## 3. Telemetry & Channel Observations

1. **Monochrome / Grayscale Encoding (`bars`, `lateralFlow`, `spots`):**
   - In 90 out of the 108 images (`bars`, `lateralFlow`, and `spots`), the mean red, green, and blue values are identical ($R = G = B$). These represent synthetic or pre-processed grayscale calibration benchmarks used in colorimetric measurement pipelines.
   - The standard deviation in the `bars` group is exceptionally tight ($\sigma = 0.54$), indicating consistent synthetic background and target contrast across variations (`largeBar`, `mediumBar`, `smallBar`).

2. **Subtle Chromatic Shifts (`imageJ_ROIs`):**
   - The `imageJ_ROIs` group exhibits slight chromatic divergence (Mean R: 204.43, Mean G: 205.61, Mean B: 207.35), reflecting ImageJ screenshot captures and user-interface background artifacts.

3. **Dimensional Uniformity:**
   - `bars`: Approximately $514 \times 514$ to $525 \times 538$ px.
   - `imageJ_ROIs`: Crops range from $186 \times 320$ px to $520 \times 444$ px.
   - `lateralFlow`: Approximately $492 \times 407$ to $547 \times 471$ px.
   - `spots`: Approximately $514 \times 526$ to $519 \times 531$ px.

---

## 4. Outlier & Edge-Case Identification

Inspection of the distribution extremes revealed several noteworthy points:

### Highest Luminance / Intensity
- **`OR-0047` (`ROIResults.PNG`):** Mean Intensity = **230.11** (Avg RGB: 226.55, 230.54, 237.21, Hex: `#E3E7ED`).
  - *Observation:* This file is an ImageJ summary results table screenshot rather than an assay crop, resulting in a white/light-gray background and elevated luminance.
- **`OR-0036` (`ROI3c.png`) & `OR-0032` (`ROI1c.png`):** Mean Intensity = **205.05** (Avg RGB: ~205, 205, 204, Hex: `#CDCDCD`).
  - *Observation:* Higher baseline reflectance compared to raw strip crops.

### Lowest Luminance / Intensity
- **`OR-0055` (`vaccinated1to1.1.jpg`):** Mean Intensity = **184.90** (Avg RGB: 184.90, 184.90, 184.90, Hex: `#B9B9B9`).
- **`OR-0052` (`HealthyControl1to2.1.jpg`):** Mean Intensity = **185.23** (Avg RGB: 185.23, 185.23, 185.23, Hex: `#B9B9B9`).
- **`OR-0059` (`vaccinated1to128.2.jpg`):** Mean Intensity = **186.12** (Avg RGB: 186.12, 186.12, 186.12, Hex: `#BABABA`).
  - *Observation:* These lateral-flow strip scans contain darker contrast bands and vignetting near the frame edges, yielding lower aggregate full-frame intensity.

---

## 5. Scope & Safeguards

> [!IMPORTANT]
> **Non-Diagnostic & Benchmark-Only Scope:**
> 1. **No Drug Classification:** Color metrics (RGB, Hex, Luminance) are objective physical/digital signal measurements and MUST NOT be interpreted as indicative of any chemical reaction, presumptive test result, or drug presence/absence.
> 2. **No Model Performance Claims:** This analysis does not evaluate classification accuracy, sensitivity, specificity, precision, or predictive capability, as no machine learning model is deployed or trained on these files.
> 3. **Data Integrity:** Source image files remain unmodified in their original format and byte stream. Manifest and analysis datasets are linked strictly through immutable `image_id` identifiers.
