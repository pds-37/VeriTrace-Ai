# STEP 9.6 — CAMERA-DOMAIN QUICK REFERENCE

---

## Key Facts
- **Objective:** Bridge domain gap between scanner benchmarks (Open_Reader) and smartphone cameras.
- **Task:** Physical Object Format Recognition (`lateral_flow_cassette` vs. `non_test_object`).
- **Nature:** Non-diagnostic, offline-first, pure-TypeScript edge execution on Expo Go and Web.
- **Target Volume:** 80–100 `lateral_flow_cassette` + 80–100 `non_test_object` genuine camera photos.
- **Current Dataset Count:** 0 genuine images (Collection active; training paused).
- **Feature Extractor:** 8-D Morphological/Photometric Extractor (`scratch/camera_domain_feature_extractor.py`) verified 8/8 PASS.

---

## 8-D Features
1. `f0_aspect_ratio`: $W / \max(1, H)$
2. `f1_rectangularity`: Contour fill ratio
3. `f2_edge_density`: Sobel gradient edge ratio
4. `f3_internal_contrast`: Luminance coefficient of variation
5. `f4_norm_red`: $R / (R + G + B + \epsilon)$
6. `f5_norm_blue`: $B / (R + G + B + \epsilon)$
7. `f6_mean_intensity`: Normalized luminance $(0-1)$
8. `f7_symmetry`: Bilateral Pearson correlation

---

## Safety & Compliance Rules
- ❌ No drug detection or substance identification
- ❌ No positive/negative results
- ❌ No fabricated samples or synthetic data in training
- ✅ Presumptive status locked as `Presumptive (Unanalyzed)`
