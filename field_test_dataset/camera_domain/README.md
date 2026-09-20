# Camera-Domain Dataset Collection Protocol & Manifest Guide
**Field Test Companion — Visual Modality & Physical Format Recognition Dataset**

---

## 1. Objective & Non-Diagnostic Boundary
This dataset is designed specifically to bridge the domain gap between flatbed scanner benchmark images (Open_Reader) and real-world smartphone camera photographs.

**Target Task (Visual Object Format Only):**
1. `lateral_flow_cassette`: Physical plastic cassette housing featuring a sample application well, internal reaction strip window, and control/test reference markers.
2. `non_test_object`: Harmless, everyday background and non-test items (e.g. stationery, paper, cards, pens, desk surfaces, containers).

> **CRITICAL ETHICAL & REGULATORY SAFEGUARD:**  
> This dataset contains **NO drug samples**, **NO chemical interpretations**, **NO clinical ground-truth**, and **NO positive/negative diagnostic labels**. It is solely used for physical visual object format recognition.

---

## 2. Dataset Collection Specification & Targets

### Target Collection Volume:
- **`lateral_flow_cassette`**: 80–100 genuine phone-camera photos
- **`non_test_object`**: 80–100 genuine phone-camera photos
- **Total Target**: 160–200 genuine camera samples

### Current Status:
- **Genuine Samples Collected:** 0
- **Missing Required for Training:** 80–100 cassette images + 80–100 non-test images
- **Status:** **INSUFFICIENT (Collection Active — Training Paused)**

---

## 3. Standardized Capture Protocol

To ensure robust machine learning generalization and reliable Out-of-Distribution (OOD) boundaries, all real-world captures must adhere to the following variation grid:

### A. Spatial & Geometric Variations (`lateral_flow_cassette`):
- **Positioning:** Centered, shifted left ($25\%$), shifted right ($25\%$), shifted top, shifted bottom.
- **Orientation:** $0^\circ$ (standard portrait/landscape), $\pm 15^\circ$ planar tilt, $\pm 25^\circ$ perspective slant.
- **Distance Categories:**
  - `close`: 10–15 cm (fills $70-90\%$ of frame)
  - `medium`: 15–25 cm (standard recommended operational range, fills $40-60\%$)
  - `far`: 30–40 cm (fills $20-30\%$)

### B. Ambient Lighting Variations:
- `indoor_normal`: Standard indoor LED / fluorescent illumination ($300-500\text{ lux}$).
- `warm_light`: Incandescent / warm yellow evening lighting ($2700\text{K}$).
- `daylight`: Natural diffuse daylight through window ($5000-6500\text{K}$).
- `mild_shadow`: Partial cast shadow across one half of the object.
- `low_light`: Dim evening room lighting ($50-100\text{ lux}$).

### C. Background & Surface Variations:
- White/light office desk
- Dark wood/laminate surface
- Neutral gray / textured surface
- Grid paper / document background

### D. Non-Test Object Categories (`non_test_object`):
- Blank white, yellow, or lined paper
- Notebooks, spiral pads, clipboards
- Office pens, markers, stylus
- Plastic ID cards, business cards, coins
- Empty mugs, beverage cans, keyboards

---

## 4. Metadata Schema Specification (`dataset_manifest.json`)

Every real image ingested into this dataset must have an entry in `dataset_manifest.json` adhering to:

```json
{
  "image_id": "CAM_CASSETTE_001",
  "label": "lateral_flow_cassette",
  "source": "project_real_capture",
  "device_model": "Samsung Galaxy S22 / Google Pixel 7 / iPhone 13",
  "os_version": "Android 14 / iOS 17.4",
  "lighting_condition": "indoor_normal | warm_light | daylight | mild_shadow | low_light",
  "orientation": "portrait | landscape | 15deg_tilt",
  "distance_category": "close | medium | far",
  "resolution": "1080x1920",
  "timestamp": "2026-09-19T18:30:00Z",
  "sha256": "64_character_hexadecimal_hash_string",
  "provenance": "project_real_capture",
  "notes": "Educational rapid test cassette on white desk under warm LED"
}
```

### Allowed Provenance Tags:
- `project_real_capture`: Genuine photo taken by the team using mobile device hardware.
- `external_open_reference`: Verified open-source reference image with clear licensing.
- `synthetic_demo`: **PROHIBITED from training partitions.** (For isolated UI visualization only).

---

## 5. Quality Assurance & Anti-Leakage Protocol

1. **SHA-256 Deduplication:** Duplicate file hashes are automatically flagged and rejected.
2. **Decode Validation:** Every file is verified by decoding the raw raster matrix before inclusion.
3. **Group-Aware Partitioning:** All photos taken of the **same physical cassette unit** or in the same capture burst must be assigned exclusively to either `train`, `val`, or `test` to guarantee zero data leakage.
4. **Held-Out Test Set Isolation:** 20% of genuine samples are permanently frozen as the test set and never used for feature normalization or OOD threshold calibration.
