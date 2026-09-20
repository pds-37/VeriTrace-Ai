import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as jpeg from 'jpeg-js';

/**
 * Region of Interest (ROI) bounding box and detection metadata.
 * Strictly spatial/image-processing telemetry metadata; non-diagnostic.
 */
export interface RegionOfInterest {
  x: number;
  y: number;
  width: number;
  height: number;
  detectionMethod: 'dynamic_contrast' | 'center_fallback';
  qualityScore: number;
}

/**
 * Provenance / source type for color references.
 */
export type ReferenceSourceType =
  | 'benchmark_reference'
  | 'project_demo'
  | 'manufacturer_documented_reference'
  | 'lab_confirmed_reference';

/**
 * Standard schema for color reference records.
 * Non-diagnostic metadata; used solely for image-level color similarity comparisons.
 */
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

/**
 * Numerical result of comparing an ROI color sample against a reference record.
 * Strictly a non-diagnostic digital color similarity score; NOT a chemical confidence.
 */
export interface ReferenceComparisonResult {
  referenceId: string;
  referenceName: string;
  distance: number;
  rawRgbDistance: number;
  similarityScore: number;
  metric: string;
  comparedAt: string;
}

/**
 * AI Image Assessment Result.
 * Non-diagnostic benchmark target modality prediction with Out-of-Distribution (OOD) safety gating.
 * Strictly non-diagnostic; does not identify substances or confirm chemistry.
 */
export interface AiImageAssessment {
  task: 'benchmark_target_modality_classification';
  classificationStatus: 'known' | 'unknown';
  prediction: 'calibrator_bar' | 'calibrator_spot' | 'cropped_roi' | 'lateral_flow_strip' | 'unknown';
  rawTopPrediction?: 'calibrator_bar' | 'calibrator_spot' | 'cropped_roi' | 'lateral_flow_strip';
  modelScore: number;
  oodScore: number;
  oodReason?: string;
  classProbabilities: {
    calibrator_bar: number;
    calibrator_spot: number;
    cropped_roi: number;
    lateral_flow_strip: number;
  };
  inferenceLatencyMs: number;
  disclaimer: string;
}

/**
 * Demo Classification result schema.
 * Transparent structural and camera-domain heuristic classification.
 * Strictly non-diagnostic; does not identify substances or fake AI predictions.
 */
export type DemoClassificationLabel = 'Cassette-like object' | 'Non-test object';

export interface DemoClassificationResult {
  label: DemoClassificationLabel;
  isCassetteLike: boolean;
  aspectRatio: number;
  detectedRoi: RegionOfInterest;
  dominantHex: string;
  rgb: [number, number, number];
  normalizedRgb: [number, number, number];
  intensityScore: number;
  structuralIndicators: string[];
  disclaimer: string;
}

/**
 * Colorimetric test metrics interface for image color analysis.
 */
export interface ColorMetrics {
  controlBandDetected?: boolean;
  testBandDetected?: boolean;
  dominantHex?: string;
  rgb?: [number, number, number];
  rawRgb?: [number, number, number];
  normalizedRgb?: [number, number, number];
  normalizedIntensity?: number;
  intensityScore?: number;
  roi?: RegionOfInterest;
  referenceComparison?: ReferenceComparisonResult;
  aiAssessment?: AiImageAssessment;
  demoClassification?: DemoClassificationResult;
}

/**
 * Standardized AI/CV analysis output contract.
 */
export interface AnalysisResult {
  status: 'completed' | 'failed' | 'inconclusive';
  presumptiveResult: string;
  confidenceScore: number | null;
  analyzedAt: string;
  colorMetrics?: ColorMetrics;
  aiAssessment?: AiImageAssessment;
  demoClassification?: DemoClassificationResult;
  isDemoStub: boolean;
  notes: string;
}

/**
 * Curated baseline benchmark references.
 * Derived from open-source methodology benchmarks for digital color comparison.
 */
export const BENCHMARK_COLOR_REFERENCES: ColorReferenceRecord[] = [
  {
    referenceId: 'REF-OR-BAR-BASELINE',
    name: 'Open_Reader Bar Calibrator Baseline',
    source: 'SMR-83/Open_Reader (benchmark dataset)',
    sourceType: 'benchmark_reference',
    rawRgb: [193, 193, 193],
    normalizedRgb: [0.3333, 0.3333, 0.3333],
    hex: '#C1C1C1',
    intensity: 193,
    lightingCondition: 'Standardized benchtop scanner / flatbed optical illumination',
    device: 'Open-Reader optical sensor box',
    notes: 'Mean baseline grayscale reflectance across Open_Reader bar calibrator series.',
  },
  {
    referenceId: 'REF-OR-SPOT-BASELINE',
    name: 'Open_Reader Spot Calibrator Baseline',
    source: 'SMR-83/Open_Reader (benchmark dataset)',
    sourceType: 'benchmark_reference',
    rawRgb: [194, 194, 194],
    normalizedRgb: [0.3333, 0.3333, 0.3333],
    hex: '#C2C2C2',
    intensity: 194,
    lightingCondition: 'Standardized benchtop scanner / flatbed optical illumination',
    device: 'Open-Reader optical sensor box',
    notes: 'Mean baseline grayscale reflectance across Open_Reader spot calibrator series.',
  },
  {
    referenceId: 'REF-DEMO-NEUTRAL-GRAY',
    name: 'Standard Neutral Gray Card Reference',
    source: 'Digital Colorimetry Standard (Demo)',
    sourceType: 'project_demo',
    rawRgb: [128, 128, 128],
    normalizedRgb: [0.3333, 0.3333, 0.3333],
    hex: '#808080',
    intensity: 128,
    lightingCondition: 'D65 Standard Daylight (Simulated Demo)',
    device: 'Calibrated Color Target',
    notes: 'Mid-gray reference for optical density verification.',
  },
];

/**
 * Normalizes an RGB color tuple to unit chromaticity coordinates [r, g, b].
 * Ensures r + g + b = 1.0 (for non-zero RGB).
 * When R = G = B = 0, returns [0.3333, 0.3333, 0.3333].
 *
 * NOTE ON LIMITATIONS:
 * Normalized chromaticity decouples pure color proportions from overall brightness/exposure,
 * but does NOT correct for colored illuminants, shadows, or camera sensor non-linearities.
 */
export function normalizeRgbChromaticity(rgb: [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb;
  const clampedR = Math.max(0, Math.min(255, r));
  const clampedG = Math.max(0, Math.min(255, g));
  const clampedB = Math.max(0, Math.min(255, b));

  const sum = clampedR + clampedG + clampedB;
  if (sum === 0) {
    return [0.3333, 0.3333, 0.3333];
  }

  const normR = Math.round((clampedR / sum) * 10000) / 10000;
  const normG = Math.round((clampedG / sum) * 10000) / 10000;
  const normB = Math.round((clampedB / sum) * 10000) / 10000;

  return [normR, normG, normB];
}

/**
 * Normalizes an intensity/luminance score (0-255) to a unit scale [0.00, 1.00].
 */
export function normalizeIntensity(intensity: number): number {
  const clamped = Math.max(0, Math.min(255, intensity));
  return Math.round((clamped / 255) * 10000) / 10000;
}

/**
 * Compares a sample RGB color tuple with a reference record using Euclidean distance in
 * normalized chromaticity space and standard RGB space.
 *
 * Strictly a non-diagnostic digital color similarity metric.
 * Does NOT indicate chemical reaction presence or drug identification.
 */
export function compareColorWithReference(
  sampleRgb: [number, number, number],
  reference: ColorReferenceRecord
): ReferenceComparisonResult {
  const normSample = normalizeRgbChromaticity(sampleRgb);
  const normRef = reference.normalizedRgb || normalizeRgbChromaticity(reference.rawRgb);

  // Euclidean distance in normalized chromaticity space (max theoretical distance is sqrt(2) approx 1.4142)
  const dr = normSample[0] - normRef[0];
  const dg = normSample[1] - normRef[1];
  const db = normSample[2] - normRef[2];
  const chromaDist = Math.round(Math.sqrt(dr * dr + dg * dg + db * db) * 10000) / 10000;

  // Euclidean distance in raw 0-255 RGB space (max theoretical distance is sqrt(3 * 255^2) approx 441.67)
  const dR = sampleRgb[0] - reference.rawRgb[0];
  const dG = sampleRgb[1] - reference.rawRgb[1];
  const dB = sampleRgb[2] - reference.rawRgb[2];
  const rawDist = Math.round(Math.sqrt(dR * dR + dG * dG + dB * dB) * 100) / 100;

  // Normalized similarity score (1.00 = identical chromaticity, 0.00 = maximum distance)
  const maxChromaDist = Math.SQRT2;
  const similarityScore = Math.max(0, Math.min(1, Math.round((1 - chromaDist / maxChromaDist) * 10000) / 10000));

  return {
    referenceId: reference.referenceId,
    referenceName: reference.name,
    distance: chromaDist,
    rawRgbDistance: rawDist,
    similarityScore,
    metric: 'normalized_chromaticity_euclidean',
    comparedAt: new Date().toISOString(),
  };
}

/**
 * Finds the closest matching reference record from a list of reference candidates.
 */
export function findClosestReference(
  sampleRgb: [number, number, number],
  references: ColorReferenceRecord[] = BENCHMARK_COLOR_REFERENCES
): ReferenceComparisonResult | null {
  if (!references || references.length === 0) {
    return null;
  }

  let bestMatch: ReferenceComparisonResult | null = null;
  for (const ref of references) {
    const comp = compareColorWithReference(sampleRgb, ref);
    if (!bestMatch || comp.distance < bestMatch.distance) {
      bestMatch = comp;
    }
  }

  return bestMatch;
}

const MODALITY_CLASSES = [
  'calibrator_bar',
  'calibrator_spot',
  'cropped_roi',
  'lateral_flow_strip',
] as const;

export type ModalityClass = typeof MODALITY_CLASSES[number];

const MODEL_FEATURE_MEANS = [
  0.333091, 0.333286, 0.333539, 0.761477, 0.97663, 0.994623, 0.867133, 0.000434,
];

const MODEL_FEATURE_STDS = [
  0.000933, 0.0002, 0.001134, 0.019828, 0.03284, 0.01424, 0.087354, 0.001449,
];

const MODEL_WEIGHTS: number[][] = [
  [0.103323, 0.140432, -0.317951, 0.074196],
  [-0.103591, -0.093024, 0.163101, 0.033514],
  [-0.084699, -0.119708, 0.275207, -0.0708],
  [-0.444081, 0.194656, 0.961096, -0.711672],
  [-0.456531, -0.16218, -0.995379, 1.614089],
  [0.398225, 0.481193, -0.344916, -0.534503],
  [0.102101, 0.474523, -0.244, -0.332624],
  [-0.222521, -0.272456, 0.587493, -0.092516],
];

const MODEL_BIASES = [0.47091, 0.539147, -0.977606, -0.032451];

/**
 * Class centroids in standardized Z-space computed strictly from the training partition.
 */
const MODEL_CLASS_CENTROIDS_Z: number[][] = [
  // Class 0: calibrator_bar
  [0.224557, 0.071116, -0.210627, -0.338692, 0.052045, 0.325288, -0.080573, -0.29972],
  // Class 1: calibrator_spot
  [0.224557, 0.071116, -0.210627, -0.12407, 0.094339, 0.317485, 0.061441, -0.29972],
  // Class 2: cropped_roi
  [-1.211885, -0.37909, 1.138001, 1.97715, -1.440325, -1.227077, 0.361026, 1.618489],
  // Class 3: lateral_flow_strip
  [0.224557, 0.071116, -0.210627, -0.635689, 0.653792, 0.038926, -0.181439, -0.29972],
];

/**
 * Out-of-Distribution (OOD) decision thresholds calibrated strictly on the validation set.
 * - OOD_THRESHOLD_CENTROID_DIST: Maximum allowable Euclidean distance to nearest training class centroid in Z-space.
 * - OOD_THRESHOLD_MAX_Z: Maximum allowable single-feature Z-score deviation from training distribution.
 */
const OOD_THRESHOLD_CENTROID_DIST = 8.5;
const OOD_THRESHOLD_MAX_Z = 5.0;

/**
 * Executes lightweight, pure-TypeScript prototype classification of benchmark target modality
 * with Out-of-Distribution (OOD) safety gating.
 *
 * NON-DIAGNOSTIC SAFEGUARD:
 * This model performs structural/colorimetric benchmark modality classification only.
 * It is NOT trained on chemical substances, does NOT classify drugs, and does NOT produce diagnostic results.
 */
export function classifyBenchmarkTargetModality(
  width: number,
  height: number,
  normalizedRgb: [number, number, number],
  normalizedIntensity: number,
  chromaDistance: number
): AiImageAssessment {
  const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

  const maxDim = Math.max(width, height, 1);
  const minDim = Math.min(width, height);
  const aspectW = width / maxDim;
  const aspectH = height / maxDim;
  const scaleFactor = minDim / 600.0;

  const rawFeatures = [
    normalizedRgb[0],
    normalizedRgb[1],
    normalizedRgb[2],
    normalizedIntensity,
    aspectW,
    aspectH,
    scaleFactor,
    chromaDistance,
  ];

  // Standardize features (z-score)
  const zFeatures = rawFeatures.map((val, idx) => {
    const std = MODEL_FEATURE_STDS[idx] || 1.0;
    return (val - MODEL_FEATURE_MEANS[idx]) / std;
  });

  // 1. Calculate linear classifier logits
  const logits = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    let sum = MODEL_BIASES[c];
    for (let f = 0; f < 8; f++) {
      sum += zFeatures[f] * MODEL_WEIGHTS[f][c];
    }
    logits[c] = sum;
  }

  // 2. Softmax with numerical stability
  const maxLogit = Math.max(...logits);
  const expValues = logits.map((l) => Math.exp(l - maxLogit));
  const sumExp = expValues.reduce((acc, v) => acc + v, 0);
  const probabilities = expValues.map((v) => v / sumExp);

  // Determine top raw class
  let bestClassIdx = 0;
  let bestProb = probabilities[0];
  for (let c = 1; c < 4; c++) {
    if (probabilities[c] > bestProb) {
      bestProb = probabilities[c];
      bestClassIdx = c;
    }
  }

  // 3. Out-of-Distribution (OOD) Safety Gating
  // A. Compute minimum Euclidean distance to nearest training class centroid in standardized Z-space
  let minCentroidDist = Number.POSITIVE_INFINITY;
  for (let c = 0; c < 4; c++) {
    let sumSq = 0;
    const centroid = MODEL_CLASS_CENTROIDS_Z[c];
    for (let f = 0; f < 8; f++) {
      const diff = zFeatures[f] - centroid[f];
      sumSq += diff * diff;
    }
    const dist = Math.sqrt(sumSq);
    if (dist < minCentroidDist) {
      minCentroidDist = dist;
    }
  }

  // B. Compute maximum single-feature absolute Z-score deviation
  let maxAbsZ = 0;
  for (let f = 0; f < 8; f++) {
    const absZ = Math.abs(zFeatures[f]);
    if (absZ > maxAbsZ) {
      maxAbsZ = absZ;
    }
  }

  const isOod = minCentroidDist > OOD_THRESHOLD_CENTROID_DIST || maxAbsZ > OOD_THRESHOLD_MAX_Z;
  const classificationStatus: 'known' | 'unknown' = isOod ? 'unknown' : 'known';
  const rawTopClass = MODALITY_CLASSES[bestClassIdx];
  const prediction = isOod ? 'unknown' : rawTopClass;
  const oodScore = Math.round(minCentroidDist * 100) / 100;
  const oodReason = isOod
    ? (maxAbsZ > OOD_THRESHOLD_MAX_Z
        ? 'Extreme feature deviation from benchmark training distribution'
        : 'Feature distance exceeds benchmark class boundaries')
    : 'Accepted — within benchmark distribution';

  const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const latency = Math.round((endTime - startTime) * 100) / 100;

  return {
    task: 'benchmark_target_modality_classification',
    classificationStatus,
    prediction,
    rawTopPrediction: rawTopClass,
    modelScore: Math.round(bestProb * 10000) / 10000,
    oodScore,
    oodReason,
    classProbabilities: {
      calibrator_bar: Math.round(probabilities[0] * 10000) / 10000,
      calibrator_spot: Math.round(probabilities[1] * 10000) / 10000,
      cropped_roi: Math.round(probabilities[2] * 10000) / 10000,
      lateral_flow_strip: Math.round(probabilities[3] * 10000) / 10000,
    },
    inferenceLatencyMs: latency,
    disclaimer:
      'AI output is a non-diagnostic image assessment and does not identify drugs or confirm chemical substances.',
  };
}

/**
 * Classifies an image into "Cassette-like object" vs "Non-test object" based on
 * camera-domain geometric, structural, and photometric properties.
 *
 * NON-DIAGNOSTIC / TRANSPARENT DEMO SAFEGUARD:
 * This classifier uses deterministic visual and spatial attributes (aspect ratio, edge contrast,
 * luminance, and chromatic neutrality) as a prototype demonstration.
 * It DOES NOT claim chemical verification, DOES NOT detect drugs, and DOES NOT output fake AI confidences.
 */
export function classifyDemoObject(
  roi: RegionOfInterest,
  imageWidth: number,
  imageHeight: number,
  rawRgb: [number, number, number],
  normalizedRgb: [number, number, number],
  intensityScore: number,
  dominantHex: string
): DemoClassificationResult {
  const aspectRatio = imageWidth > 0 && imageHeight > 0
    ? Math.round((imageWidth / imageHeight) * 100) / 100
    : 1.0;

  const maxChromaDiff = Math.round(
    Math.max(
      Math.abs(normalizedRgb[0] - normalizedRgb[1]),
      Math.abs(normalizedRgb[1] - normalizedRgb[2]),
      Math.abs(normalizedRgb[0] - normalizedRgb[2])
    ) * 10000
  ) / 10000;

  const hasAdaptiveContrast = roi.detectionMethod === 'dynamic_contrast' && roi.qualityScore >= 0.15;
  const isLuminanceValid = intensityScore >= 35 && intensityScore <= 250;
  const isChromaNeutral = maxChromaDiff < 0.28;
  const isAspectRatioValid = aspectRatio >= 0.35 && aspectRatio <= 2.85;

  const structuralIndicators: string[] = [];

  // Evaluate structural features
  if (hasAdaptiveContrast) {
    structuralIndicators.push(`Adaptive contrast boundary detected (Quality: ${(roi.qualityScore * 100).toFixed(0)}%)`);
  } else {
    structuralIndicators.push(`Center fallback ROI — No distinct test cassette contours`);
  }

  structuralIndicators.push(`Aspect ratio: ${aspectRatio.toFixed(2)}:1`);

  if (isLuminanceValid) {
    structuralIndicators.push(`Substrate luminance: ${intensityScore}/255 (Valid reflectance range)`);
  } else if (intensityScore < 35) {
    structuralIndicators.push(`Substrate luminance: ${intensityScore}/255 (Underexposed / too dark)`);
  } else {
    structuralIndicators.push(`Substrate luminance: ${intensityScore}/255 (Overexposed / clipped)`);
  }

  if (isChromaNeutral) {
    structuralIndicators.push(`Chromaticity balance: Neutral test substrate profile (Δchroma ${(maxChromaDiff * 100).toFixed(1)}%)`);
  } else {
    structuralIndicators.push(`Chromaticity balance: High saturation / non-standard substrate (Δchroma ${(maxChromaDiff * 100).toFixed(1)}%)`);
  }

  const isCassetteLike = hasAdaptiveContrast && isLuminanceValid && isChromaNeutral && isAspectRatioValid;
  const label: DemoClassificationLabel = isCassetteLike ? 'Cassette-like object' : 'Non-test object';

  return {
    label,
    isCassetteLike,
    aspectRatio,
    detectedRoi: roi,
    dominantHex,
    rgb: rawRgb,
    normalizedRgb,
    intensityScore,
    structuralIndicators,
    disclaimer: 'DEMO RESULT — NOT A VERIFIED AI PREDICTION',
  };
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < BASE64_CHARS.length; i++) {
  BASE64_LOOKUP[BASE64_CHARS.charCodeAt(i)] = i;
}

/**
 * Pure JavaScript / React Native compatible Base64 to Uint8Array decoder.
 * Does not rely on Node.js Buffer or browser-only atob APIs.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  let cleanBase64 = base64;
  const commaIdx = cleanBase64.indexOf(',');
  if (commaIdx !== -1) {
    cleanBase64 = cleanBase64.substring(commaIdx + 1);
  }
  cleanBase64 = cleanBase64.replace(/[\r\n\t\s]/g, '');

  const len = cleanBase64.length;
  if (len === 0) return new Uint8Array(0);

  let padding = 0;
  if (cleanBase64.endsWith('==')) {
    padding = 2;
  } else if (cleanBase64.endsWith('=')) {
    padding = 1;
  }

  const byteLength = Math.floor((len * 3) / 4) - padding;
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = BASE64_LOOKUP[cleanBase64.charCodeAt(i)];
    const encoded2 = BASE64_LOOKUP[cleanBase64.charCodeAt(i + 1)];
    const encoded3 = BASE64_LOOKUP[cleanBase64.charCodeAt(i + 2)];
    const encoded4 = BASE64_LOOKUP[cleanBase64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < byteLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < byteLength) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return bytes;
}

type PixelLuminanceAccessor = (x: number, y: number) => number;

/**
 * Lightweight pure-TypeScript adaptive ROI detector.
 *
 * Operates on a downsampled grid (~160x120 samples) to minimize JS compute latency.
 * Evaluates local contrast gradient magnitude with a central-proximity prior.
 * If contrast is weak or ambiguous, cleanly returns the standard center-patch fallback.
 */
function detectAdaptiveRoi(
  width: number,
  height: number,
  getLuminance: PixelLuminanceAccessor
): RegionOfInterest {
  // 1. Default conservative center-patch fallback (10% of min dimension, clamped 10-80px)
  const defaultPatchSize = Math.max(10, Math.min(80, Math.floor(Math.min(width, height) * 0.1)));
  const fallbackRoi: RegionOfInterest = {
    x: Math.max(0, Math.floor((width - defaultPatchSize) / 2)),
    y: Math.max(0, Math.floor((height - defaultPatchSize) / 2)),
    width: defaultPatchSize,
    height: defaultPatchSize,
    detectionMethod: 'center_fallback',
    qualityScore: 0,
  };

  if (width < 30 || height < 30) {
    return fallbackRoi;
  }

  // 2. Downsample target to ~160x120 grid
  const step = Math.max(1, Math.floor(Math.max(width, height) / 160));
  const gridW = Math.floor(width / step);
  const gridH = Math.floor(height / step);

  if (gridW < 8 || gridH < 8) {
    return fallbackRoi;
  }

  // 3. Populate downsampled luminance grid
  const grid = new Float32Array(gridW * gridH);
  for (let gy = 0; gy < gridH; gy++) {
    const yPx = Math.min(height - 1, gy * step);
    const rowOffset = gy * gridW;
    for (let gx = 0; gx < gridW; gx++) {
      const xPx = Math.min(width - 1, gx * step);
      grid[rowOffset + gx] = getLuminance(xPx, yPx);
    }
  }

  // 4. Calculate local gradient magnitude (Sobel/Manhattan proxy)
  const grad = new Float32Array(gridW * gridH);
  for (let gy = 1; gy < gridH - 1; gy++) {
    const rowOffset = gy * gridW;
    for (let gx = 1; gx < gridW - 1; gx++) {
      const gxVal = Math.abs(grid[rowOffset + gx + 1] - grid[rowOffset + gx - 1]);
      const gyVal = Math.abs(grid[(gy + 1) * gridW + gx] - grid[(gy - 1) * gridW + gx]);
      grad[rowOffset + gx] = gxVal + gyVal;
    }
  }

  // 5. Candidate search window in grid units (~25% of grid dimensions)
  const boxWg = Math.max(4, Math.floor(gridW * 0.25));
  const boxHg = Math.max(4, Math.floor(gridH * 0.25));

  const cxGrid = gridW / 2;
  const cyGrid = gridH / 2;

  let bestScore = -1;
  let bestGx = Math.floor(cxGrid - boxWg / 2);
  let bestGy = Math.floor(cyGrid - boxHg / 2);

  // Search within central 50% search envelope
  const minSearchX = Math.max(1, Math.floor(gridW * 0.2));
  const maxSearchX = Math.min(gridW - boxWg - 1, Math.floor(gridW * 0.8) - boxWg);
  const minSearchY = Math.max(1, Math.floor(gridH * 0.2));
  const maxSearchY = Math.min(gridH - boxHg - 1, Math.floor(gridH * 0.8) - boxHg);

  if (minSearchX > maxSearchX || minSearchY > maxSearchY) {
    return fallbackRoi;
  }

  const boxPixelCount = boxWg * boxHg;

  for (let gy = minSearchY; gy <= maxSearchY; gy += 2) {
    for (let gx = minSearchX; gx <= maxSearchX; gx += 2) {
      let gradSum = 0;
      let lumSum = 0;
      let lumSqSum = 0;

      for (let wy = 0; wy < boxHg; wy++) {
        const offset = (gy + wy) * gridW + gx;
        for (let wx = 0; wx < boxWg; wx++) {
          const gVal = grad[offset + wx];
          const lVal = grid[offset + wx];
          gradSum += gVal;
          lumSum += lVal;
          lumSqSum += lVal * lVal;
        }
      }

      const meanGrad = gradSum / boxPixelCount;
      const meanLum = lumSum / boxPixelCount;
      const varianceLum = Math.max(0, lumSqSum / boxPixelCount - meanLum * meanLum);
      const stdLum = Math.sqrt(varianceLum);

      // Distance penalty from image center (prefer centered test kits)
      const dx = (gx + boxWg / 2 - cxGrid) / (gridW / 2);
      const dy = (gy + boxHg / 2 - cyGrid) / (gridH / 2);
      const distSq = dx * dx + dy * dy;
      const centerWeight = Math.max(0.2, 1 - 0.6 * distSq);

      const score = (meanGrad * 0.6 + stdLum * 0.4) * centerWeight;
      if (score > bestScore) {
        bestScore = score;
        bestGx = gx;
        bestGy = gy;
      }
    }
  }

  // 6. Conservative validation: Reject weak contrast or low-confidence regions
  const MIN_CONTRAST_THRESHOLD = 4.0;
  if (bestScore < MIN_CONTRAST_THRESHOLD) {
    return {
      ...fallbackRoi,
      qualityScore: Math.max(0, Math.min(1, Math.round((bestScore / 20) * 100) / 100)),
    };
  }

  const roiX = bestGx * step;
  const roiY = bestGy * step;
  const roiW = boxWg * step;
  const roiH = boxHg * step;

  // Sanity check coordinates within native image bounds
  if (
    roiX < 0 ||
    roiY < 0 ||
    roiX + roiW > width ||
    roiY + roiH > height ||
    roiW < 10 ||
    roiH < 10
  ) {
    return fallbackRoi;
  }

  const qualityScore = Math.max(0, Math.min(1, Math.round((bestScore / 35) * 100) / 100));

  return {
    x: roiX,
    y: roiY,
    width: roiW,
    height: roiH,
    detectionMethod: 'dynamic_contrast',
    qualityScore,
  };
}

/**
 * Helper to sample pixel colors using adaptive ROI detection on Web via HTML5 Canvas.
 */
function sampleAdaptivePixelColorOnWeb(imageSource: string): Promise<ColorMetrics | undefined> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(undefined);
      return;
    }

    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          if (!width || !height) {
            resolve(undefined);
            return;
          }

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(undefined);
            return;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0);

          const fullImageData = ctx.getImageData(0, 0, width, height);
          const fullData = fullImageData.data;

          const getLuminance = (x: number, y: number): number => {
            const idx = (y * width + x) * 4;
            return 0.299 * fullData[idx] + 0.587 * fullData[idx + 1] + 0.114 * fullData[idx + 2];
          };

          const roi = detectAdaptiveRoi(width, height, getLuminance);

          const roiImageData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
          const data = roiImageData.data;

          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          const pixelCount = roi.width * roi.height;

          for (let i = 0; i < data.length; i += 4) {
            totalR += data[i];
            totalG += data[i + 1];
            totalB += data[i + 2];
          }

          if (pixelCount === 0) {
            resolve(undefined);
            return;
          }

          const avgR = Math.round(totalR / pixelCount);
          const avgG = Math.round(totalG / pixelCount);
          const avgB = Math.round(totalB / pixelCount);
          const hex = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`.toUpperCase();
          const intensityScore = Math.round(0.299 * avgR + 0.587 * avgG + 0.114 * avgB);

          const rawRgb: [number, number, number] = [avgR, avgG, avgB];
          const normalizedRgb = normalizeRgbChromaticity(rawRgb);
          const normalizedIntensity = normalizeIntensity(intensityScore);
          const referenceComparison = findClosestReference(rawRgb) || undefined;
          const chromaDist = referenceComparison ? referenceComparison.distance : 0;
          const aiAssessment = classifyBenchmarkTargetModality(
            width,
            height,
            normalizedRgb,
            normalizedIntensity,
            chromaDist
          );
          const demoClassification = classifyDemoObject(
            roi,
            width,
            height,
            rawRgb,
            normalizedRgb,
            intensityScore,
            hex
          );

          resolve({
            dominantHex: hex,
            rgb: rawRgb,
            rawRgb,
            normalizedRgb,
            normalizedIntensity,
            intensityScore,
            roi,
            referenceComparison,
            aiAssessment,
            demoClassification,
          });
        } catch (e) {
          console.warn('HTML5 Canvas pixel extraction failed on web:', e);
          resolve(undefined);
        }
      };

      img.onerror = () => {
        resolve(undefined);
      };

      img.src = imageSource;
    } catch {
      resolve(undefined);
    }
  });
}

/**
 * Decodes a raw JPEG binary byte buffer, runs adaptive ROI detection, and extracts the average
 * RGB/Hex/intensity within the detected (or fallback) ROI, including normalization and reference comparison.
 */
function sampleAdaptivePixelColorFromJpegBuffer(jpegBytes: Uint8Array): ColorMetrics | undefined {
  try {
    if (!jpegBytes || jpegBytes.length === 0) {
      return undefined;
    }

    const decoded = jpeg.decode(jpegBytes, { useTArray: true, formatAsRGBA: true });
    if (!decoded || !decoded.width || !decoded.height || !decoded.data) {
      return undefined;
    }

    const { width, height, data } = decoded;

    const getLuminance = (x: number, y: number): number => {
      const idx = (y * width + x) * 4;
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    };

    const roi = detectAdaptiveRoi(width, height, getLuminance);

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let validPixels = 0;

    const startX = roi.x;
    const startY = roi.y;
    const endX = Math.min(width, roi.x + roi.width);
    const endY = Math.min(height, roi.y + roi.height);

    for (let y = startY; y < endY; y++) {
      const rowOffset = y * width;
      for (let x = startX; x < endX; x++) {
        const offset = (rowOffset + x) * 4;
        totalR += data[offset];
        totalG += data[offset + 1];
        totalB += data[offset + 2];
        validPixels++;
      }
    }

    if (validPixels === 0) {
      return undefined;
    }

    const avgR = Math.round(totalR / validPixels);
    const avgG = Math.round(totalG / validPixels);
    const avgB = Math.round(totalB / validPixels);
    const hex = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`.toUpperCase();
    const intensityScore = Math.round(0.299 * avgR + 0.587 * avgG + 0.114 * avgB);

    const rawRgb: [number, number, number] = [avgR, avgG, avgB];
    const normalizedRgb = normalizeRgbChromaticity(rawRgb);
    const normalizedIntensity = normalizeIntensity(intensityScore);
    const referenceComparison = findClosestReference(rawRgb) || undefined;
    const chromaDist = referenceComparison ? referenceComparison.distance : 0;
    const aiAssessment = classifyBenchmarkTargetModality(
      width,
      height,
      normalizedRgb,
      normalizedIntensity,
      chromaDist
    );
    const demoClassification = classifyDemoObject(
      roi,
      width,
      height,
      rawRgb,
      normalizedRgb,
      intensityScore,
      hex
    );

    return {
      dominantHex: hex,
      rgb: rawRgb,
      rawRgb,
      normalizedRgb,
      normalizedIntensity,
      intensityScore,
      roi,
      referenceComparison,
      aiAssessment,
      demoClassification,
    };
  } catch (decodeErr) {
    console.warn('JPEG decode failed in aiAnalysis:', decodeErr);
    return undefined;
  }
}

/**
 * Validates and processes a field test image using a non-diagnostic telemetry workflow with adaptive ROI detection.
 *
 * Platform behaviors:
 * - Web: Measures real RGB/Hex pixel values from adaptive/center ROI via HTML5 Canvas.
 * - Android/iOS: Decodes the captured JPEG payload via jpeg-js and calculates real RGB/Hex/intensity from adaptive/center ROI.
 *
 * IMPORTANT NON-DIAGNOSTIC SAFEGUARD:
 * This function performs basic image telemetry and color measurement only.
 * It does NOT classify drug substances, confirm chemical reactions, or return positive/negative results.
 *
 * @param imageUri URI of the image (e.g., local file://, content://, or data: scheme)
 * @param base64Data Optional pre-loaded Base64 string of the image
 * @returns Promise<AnalysisResult>
 */
export async function analyzeFieldTestImageAsync(
  imageUri: string,
  base64Data?: string
): Promise<AnalysisResult> {
  const timestamp = new Date().toISOString();

  const trimmedUri = (imageUri || '').trim();
  const trimmedBase64 = (base64Data || '').trim();

  // 1. Input validation: Verify that trimmed image URI or Base64 payload is provided
  if (!trimmedUri && !trimmedBase64) {
    return {
      status: 'failed',
      presumptiveResult: 'Analysis Failed — No Image Provided',
      confidenceScore: null,
      analyzedAt: timestamp,
      isDemoStub: false,
      notes: 'Error: An image URI or valid Base64 data string must be supplied for telemetry.',
    };
  }

  try {
    // 2. Web Platform: Perform pixel color measurement with adaptive ROI via HTML5 Canvas
    if (Platform.OS === 'web') {
      const source = trimmedBase64
        ? (trimmedBase64.startsWith('data:') ? trimmedBase64 : `data:image/jpeg;base64,${trimmedBase64}`)
        : trimmedUri;

      const sampledColor = await sampleAdaptivePixelColorOnWeb(source);

      if (sampledColor && sampledColor.rgb) {
        const method = sampledColor.roi?.detectionMethod === 'dynamic_contrast' ? 'Adaptive' : 'Center';
        const refNote = sampledColor.referenceComparison
          ? ` [Ref Match: ${sampledColor.referenceComparison.referenceId}, Similarity: ${(sampledColor.referenceComparison.similarityScore * 100).toFixed(1)}%]`
          : '';
        const aiNote = sampledColor.aiAssessment
          ? sampledColor.aiAssessment.classificationStatus === 'unknown'
            ? ` [AI Assessment: Outside benchmark distribution / OOD (Dist: ${sampledColor.aiAssessment.oodScore})]`
            : ` [AI Modality: ${sampledColor.aiAssessment.prediction.replace(/_/g, ' ')} (${(sampledColor.aiAssessment.modelScore * 100).toFixed(1)}%)]`
          : '';
        return {
          status: 'completed',
          presumptiveResult: sampledColor.demoClassification
            ? `Demo: ${sampledColor.demoClassification.label}`
            : 'Image Telemetry — Diagnostic Only (No Drug Classification)',
          confidenceScore: null,
          analyzedAt: timestamp,
          colorMetrics: sampledColor,
          aiAssessment: sampledColor.aiAssessment,
          demoClassification: sampledColor.demoClassification,
          isDemoStub: false,
          notes: `Web telemetry: ${method} ROI sampled (${sampledColor.dominantHex}, RGB [${sampledColor.rgb.join(', ')}], Intensity ${sampledColor.intensityScore}/255).${refNote}${aiNote} Non-diagnostic telemetry only.`,
        };
      }

      return {
        status: 'completed',
        presumptiveResult: 'Image Telemetry — Diagnostic Only (No Drug Classification)',
        confidenceScore: null,
        analyzedAt: timestamp,
        isDemoStub: false,
        notes: 'Web telemetry: Image verified. Canvas pixel sampling was inconclusive or unreadable.',
      };
    }

    // 3. Android / iOS Native: Decode JPEG payload and extract adaptive ROI pixels via jpeg-js
    let rawBase64 = trimmedBase64;
    if (!rawBase64 && trimmedUri && (trimmedUri.startsWith('file:') || trimmedUri.startsWith('content:'))) {
      try {
        rawBase64 = await FileSystem.readAsStringAsync(trimmedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (fsErr) {
        console.warn('FileSystem Base64 read failed:', fsErr);
      }
    }

    if (rawBase64) {
      const jpegBytes = base64ToUint8Array(rawBase64);
      const sampledColor = sampleAdaptivePixelColorFromJpegBuffer(jpegBytes);

      if (sampledColor && sampledColor.rgb) {
        const method = sampledColor.roi?.detectionMethod === 'dynamic_contrast' ? 'Adaptive' : 'Center';
        const refNote = sampledColor.referenceComparison
          ? ` [Ref Match: ${sampledColor.referenceComparison.referenceId}, Similarity: ${(sampledColor.referenceComparison.similarityScore * 100).toFixed(1)}%]`
          : '';
        const aiNote = sampledColor.aiAssessment
          ? sampledColor.aiAssessment.classificationStatus === 'unknown'
            ? ` [AI Assessment: Outside benchmark distribution / OOD (Dist: ${sampledColor.aiAssessment.oodScore})]`
            : ` [AI Modality: ${sampledColor.aiAssessment.prediction.replace(/_/g, ' ')} (${(sampledColor.aiAssessment.modelScore * 100).toFixed(1)}%)]`
          : '';
        return {
          status: 'completed',
          presumptiveResult: sampledColor.demoClassification
            ? `Demo: ${sampledColor.demoClassification.label}`
            : 'Image Telemetry — Diagnostic Only (No Drug Classification)',
          confidenceScore: null,
          analyzedAt: timestamp,
          colorMetrics: sampledColor,
          aiAssessment: sampledColor.aiAssessment,
          demoClassification: sampledColor.demoClassification,
          isDemoStub: false,
          notes: `Android telemetry: Decoded JPEG image. ${method} ROI sampled (${sampledColor.dominantHex}, RGB [${sampledColor.rgb.join(', ')}], Intensity ${sampledColor.intensityScore}/255).${refNote}${aiNote} Non-diagnostic telemetry only.`,
        };
      }
    }

    // Fallback if image could not be decoded as JPEG
    let fileSizeKb: number | null = null;
    if (trimmedUri && (trimmedUri.startsWith('file:') || trimmedUri.startsWith('content:'))) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(trimmedUri);
        if (fileInfo.exists && typeof fileInfo.size === 'number') {
          fileSizeKb = Math.round(fileInfo.size / 1024);
        }
      } catch (fsErr) {
        console.warn('FileSystem.getInfoAsync metadata check skipped:', fsErr);
      }
    }

    const payloadDetail = fileSizeKb !== null
      ? `File size: ${fileSizeKb} KB`
      : (trimmedBase64 ? `Base64 payload: ${Math.round(trimmedBase64.length / 1024)} KB` : 'Local URI verified');

    return {
      status: 'completed',
      presumptiveResult: 'Image Telemetry — Diagnostic Only (No Drug Classification)',
      confidenceScore: null,
      analyzedAt: timestamp,
      isDemoStub: false,
      notes: `Android telemetry: Verified image payload (${payloadDetail}). Pixel decoding was inconclusive. Non-diagnostic telemetry only.`,
    };
  } catch (error: unknown) {
    console.error('Image telemetry encountered an error:', error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown error occurred';

    return {
      status: 'failed',
      presumptiveResult: 'Analysis Failed — Unexpected Error',
      confidenceScore: null,
      analyzedAt: timestamp,
      isDemoStub: false,
      notes: `Unexpected error during telemetry execution: ${detail}`,
    };
  }
}


