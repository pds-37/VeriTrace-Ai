# Step 8: Reference Color Pipeline Quick Reference

**Component:** Color Normalization & Reference Color Comparison  
**Implementation:** [`services/aiAnalysis.ts`](file:///c:/Users/PIYUSH/app/field-test-companion/services/aiAnalysis.ts)  
**Status:** Validated  
**Classification:** **Non-Diagnostic Image-Level Color Similarity**

---

### Core Specifications

| Attribute | Specification |
| :--- | :--- |
| **Normalization Method** | $L_1$ Chromaticity Normalization ($r = R/(R+G+B), g = G/(R+G+B), b = B/(R+G+B)$) |
| **Comparison Metric** | Normalized Chromaticity Euclidean Distance ($D_{chroma} = \sqrt{\Delta r^2 + \Delta g^2 + \Delta b^2}$) |
| **Similarity Metric** | Visual Match Score ($\text{similarityScore} = \max(0, 1 - D_{chroma}/\sqrt{2}) \in [0.00, 1.00]$) |
| **Zero-Sum Protection** | Pure black $[0, 0, 0]$ maps safely to neutral $[0.3333, 0.3333, 0.3333]$ |
| **Reference Sources** | `benchmark_reference`, `project_demo`, `manufacturer_documented_reference`, `lab_confirmed_reference` |
| **Baseline References** | `REF-OR-BAR-BASELINE` ($[193, 193, 193]$), `REF-OR-SPOT-BASELINE` ($[194, 194, 194]$), `REF-DEMO-NEUTRAL-GRAY` ($[128, 128, 128]$) |
| **Dependencies** | **0 new packages installed** (Pure TypeScript) |
| **TypeScript Check** | **PASS (0 errors, `npx tsc --noEmit`)** |
| **Automated Tests** | **12 / 12 PASS** |

---

### Extended Data Structures

```typescript
export interface ColorReferenceRecord {
  referenceId: string;
  name: string;
  source: string;
  sourceType: ReferenceSourceType;
  rawRgb: [number, number, number];
  normalizedRgb: [number, number, number];
  hex: string;
  intensity: number;
  lightingCondition?: string;
  device?: string;
  notes?: string;
}

export interface ReferenceComparisonResult {
  referenceId: string;
  referenceName: string;
  distance: number;         // Normalized chromaticity Euclidean distance
  rawRgbDistance: number;   // Raw 0-255 RGB Euclidean distance
  similarityScore: number;  // 0.0000 to 1.0000 visual match score
  metric: string;           // "normalized_chromaticity_euclidean"
  comparedAt: string;
}

export interface ColorMetrics {
  dominantHex?: string;
  rgb?: [number, number, number];
  rawRgb?: [number, number, number];
  normalizedRgb?: [number, number, number];
  normalizedIntensity?: number;
  intensityScore?: number;
  roi?: RegionOfInterest;
  referenceComparison?: ReferenceComparisonResult;
}
```

---

### Critical Safeguards

> [!IMPORTANT]
> - **The system computes image-level color similarity against a digital reference.**
> - It **DOES NOT** identify drugs, detect controlled substances, confirm chemical reactions, or declare positive/negative testing outcomes.
> - Raw $[R, G, B]$ pixel values are preserved alongside normalized chromaticity coordinates.
