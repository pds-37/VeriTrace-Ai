# STEP 9.7 — CAMERA-DOMAIN DATASET COLLECTION GUIDE & PROTOCOL
**Field Test Companion — Visual Object Modality Dataset Collection Manual**

---

## 1. Purpose & Non-Diagnostic Boundary
To bridge the domain gap between scanner benchmark data (Open_Reader) and real-world smartphone cameras, Field Test Companion includes an in-app **Dataset Collection Mode**.

### Core Non-Diagnostic Boundary:
- **Scope:** Physical visual object-format recognition ONLY (`lateral_flow_cassette` vs. `non_test_object`).
- **Strict Prohibitions:** This dataset contains **NO drug samples**, **NO chemical substances**, **NO biohazards**, and **NO positive/negative diagnostic labels**.

---

## 2. The Two Target Classes

### Class 1: `lateral_flow_cassette`
- **Definition:** Genuine physical plastic cassette housings designed for rapid lateral-flow assays (e.g., educational blank cassettes, saliva test housings, water quality test cassettes).
- **Key Visual Features:** Rectangular plastic cassette body, circular/oval sample well, rectangular reading strip window, and molded control/test markers (C/T lines).

### Class 2: `non_test_object`
- **Definition:** Common everyday non-test items and backgrounds.
- **Examples:** Blank/yellow/lined paper, notebooks, cards, pens, tabletops, empty mugs, keyboards, coins, and mobile devices.

---

## 3. What Counts as a Valid Capture

| Attribute | Valid Requirement | Disallowed / Rejected |
|---|---|---|
| **Subject** | Clear view of test cassette or non-test object | Obscured, heavily blocked, or personal IDs |
| **Focus** | In-focus with visible edges | Severely blurred, motion smudged |
| **Lighting** | Recognizable natural/indoor illumination | Completely pitch black or extreme flash burnout |
| **Privacy** | Only inanimate objects & backgrounds | Faces, names, personal data, serial numbers |
| **Safety** | Clean educational/demo kits | Real controlled substances, hazardous chemicals |

---

## 4. Capture Variation Grid (Aim for 80–100 per class)

To train an AI model resilient to real-world usage, operators must vary the capture conditions systematically:

### A. Spatial Placement:
- **Centered:** Object directly in middle of frame ($30\%$ of samples).
- **Shifted Left / Right:** Object positioned $20-30\%$ towards the edges ($30\%$).
- **Shifted Top / Bottom:** Object in upper or lower third ($20\%$).
- **Planar Tilt:** Cassette angled at $\pm 15^\circ$ or $\pm 25^\circ$ ($20\%$).

### B. Distance Categories:
- **`close` (10–15 cm):** Object fills $70-90\%$ of frame.
- **`medium` (15–25 cm):** Standard operational distance, object fills $40-60\%$.
- **`far` (30–40 cm):** Object fills $20-30\%$ of frame.

### C. Lighting Environments:
- **`indoor_normal`:** Standard fluorescent or white LED office lighting.
- **`warm_light`:** Incandescent or evening warm lamp ($2700\text{K}$).
- **`daylight`:** Natural diffuse window light ($5500-6500\text{K}$).
- **`mild_shadow`:** Partial cast shadow across half the object.
- **`low_light`:** Dim ambient room lighting ($50-100\text{ lux}$).

---

## 5. Recorded Metadata Schema

Every captured image automatically captures 14 verifiable metadata attributes in `dataset_manifest.json` and `camera_domain_manifest.csv`:
1. `image_id`: Structured unique ID (e.g. `CAM_CAS_20260919183000_1234`)
2. `label`: `lateral_flow_cassette` | `non_test_object`
3. `source`: `project_real_capture`
4. `device_model`: e.g. `Samsung Galaxy S22`, `Google Pixel 7`, `iPhone 13`
5. `os_version`: e.g. `Android 14`, `iOS 17.4`, `Web Browser`
6. `lighting_condition`: `indoor_normal` | `warm_light` | `daylight` | `mild_shadow` | `low_light`
7. `orientation`: `portrait` | `landscape` | `15deg_tilt`
8. `distance_category`: `close` | `medium` | `far`
9. `resolution_width`: Pixel width (e.g. 1080)
10. `resolution_height`: Pixel height (e.g. 1920)
11. `timestamp`: ISO-8601 UTC timestamp
12. `sha256`: 64-character lowercase hexadecimal hash
13. `provenance`: `captured_internally_with_non_hazardous_demo_object`
14. `notes`: Contextual observation notes

---

## 6. Duplicate & Quality Control Protocol

1. **SHA-256 Integrity:** Generated directly from image buffer prior to disk save.
2. **Duplicate Collision Rejection:** If an incoming image matches an existing SHA-256 digest in the dataset, the system rejects it immediately with the warning:  
   `"Duplicate image detected (identical SHA-256 hash) — sample not added."`
3. **Group-Aware Splitting:** Burst photos of the exact same physical object are preserved in the same partition (`train`, `val`, or `test`) to prevent data leakage.

---

## 7. Export Process for Model Training

Exporting the collected dataset creates:
```
camera_domain_export/
├── images/
│   ├── lateral_flow_cassette/
│   │   └── CAM_CAS_*.jpg
│   └── non_test_object/
│       └── CAM_NON_*.jpg
└── camera_domain_manifest.csv
```

---

## 8. In-App Dashboard & Progress Tracking

The in-app Collection Mode tracks live progress without fabricating figures:
- **Lateral Flow Cassette:** Actual Count / 80 target
- **Non-Test Object:** Actual Count / 80 target
- **Total Genuine Count:** Actual Count
- **Duplicates Rejected Counter**
