# STEP 9.6 — QUICK REFERENCE GUIDE: CAMERA-DOMAIN OBJECT RECOGNITION

---

## 1. Quick Summary
- **Task:** Visual Physical Object-Format Recognition (`lateral_flow_cassette` vs. `non_test_object`).
- **Nature:** Non-diagnostic, edge-capable, pure-TypeScript compatible with Expo Go and Web.
- **Root Cause of Old Rejection:** Open_Reader benchmark had artificially microscopic color standard deviations ($\sigma \sim 0.0002$) and square geometry; real phone images experienced $Z > 18.0$, tripping the OOD gate.
- **Solution:** Camera-domain dataset collection with 8 lighting-invariant morphological and contrast features.

---

## 2. Feature Extractor Summary (8 Dimensions)
- **`f0_aspect_ratio`**: $W / H$
- **`f1_rectangularity`**: Active mask area ratio
- **`f2_edge_density`**: Sobel gradient density ($>30$)
- **`f3_internal_contrast`**: $\sigma_{\text{lum}} / (\mu_{\text{lum}} + \epsilon)$
- **`f4_norm_red`**: $R / (R + G + B + \epsilon)$
- **`f5_norm_blue`**: $B / (R + G + B + \epsilon)$
- **`f6_mean_intensity`**: Grayscale luminance $/ 255.0$
- **`f7_symmetry`**: Bilateral Pearson correlation

---

## 3. Dataset Collection Checklist
- **Path:** `field_test_dataset/camera_domain/`
- **Target Count:** 80–100 `lateral_flow_cassette` + 80–100 `non_test_object`
- **Current Count:** 0 (Ready for data ingestion; zero fabricated images)
- **Partition:** 60% Train / 20% Val / 20% Test (group-aware)

---

## 4. Safety Guardrails
- ❌ No drug identification
- ❌ No substance detection
- ❌ No positive/negative results
- ❌ No clinical/forensic claims
- ❌ No fabricated data or synthetic metrics
- ✅ Presumptive status locked as `Presumptive (Unanalyzed)`
