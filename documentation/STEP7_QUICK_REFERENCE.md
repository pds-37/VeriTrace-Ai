# Step 7: Adaptive ROI Pipeline Quick Reference

**Component:** Adaptive Visual Region-of-Interest (ROI) Localization & Telemetry  
**File:** [`services/aiAnalysis.ts`](file:///c:/Users/PIYUSH/app/field-test-companion/services/aiAnalysis.ts)  
**Status:** Validated  
**Classification:** **Non-Diagnostic Image Telemetry**

---

### Key Capabilities at a Glance

| Feature | Specification |
| :--- | :--- |
| **Algorithm** | 2D Contrast Gradient with Quadratic Center-Distance Prior |
| **Grid Resolution** | Subsampled $\approx 160 \times 120$ grid ($S = \max(1, \lfloor \max(W, H)/160 \rfloor)$) |
| **Decision Threshold** | Contrast score $\ge 4.0$ for `dynamic_contrast`; else `center_fallback` |
| **Quality Score** | Normalized contrast prominence $Q = \min(1.0, \text{Score}/35.0) \in [0.00, 1.00]$ |
| **Platforms** | Android (`jpeg-js` RGBA buffer) & Web (HTML5 Canvas `ImageData`) |
| **Dependencies** | **0 new packages installed** (Pure TypeScript) |
| **Measured Latency** | **5.0 ms – 17.4 ms** (Web Canvas runtime benchmark) |

---

### Verification Summary

```
Automated Robustness Tests (Step 7C): 12 / 12 PASSED
Web Runtime Tests (Step 7D):           3 / 3 PASSED
Android Runtime Tests (Step 7D):       NOT TESTED (No device attached)
TypeScript Audit (Step 7E):            PASSED (0 errors, npx tsc --noEmit)
Dependencies Installed:                0
Production App Code Modifications:     Confined strictly to services/aiAnalysis.ts
```

---

### Core Data Structures

```typescript
export interface RegionOfInterest {
  x: number;               // Pixel offset from left
  y: number;               // Pixel offset from top
  width: number;           // Width in native pixels
  height: number;          // Height in native pixels
  detectionMethod: 'dynamic_contrast' | 'center_fallback';
  qualityScore: number;    // 0.00 to 1.00 digital contrast metric
}

export interface ColorMetrics {
  dominantHex?: string;
  rgb?: [number, number, number];
  intensityScore?: number;
  roi?: RegionOfInterest;
}
```

---

### Critical Safeguards

> [!IMPORTANT]
> - **Non-Diagnostic:** Spatial localization and colorimetric telemetry only.
> - **No Substance Classification:** Does NOT detect drugs, chemical reactions, or positive/negative states.
> - **Fail-Safe:** Guaranteed fallback to 10% center patch on low-contrast or ambiguous framing.
