/**
 * Reference Colour Card Lighting Calibration Engine
 * 
 * Provides dynamic white-balance and illuminant gain calibration using an in-frame
 * reference colour card to eliminate ambient lighting discrepancies (tungsten warm cast,
 * cold fluorescent illumination, harsh shadows, daylight).
 * 
 * STANDARD REFERENCE TARGETS:
 * - Neutral Gray 18% (Target: RGB [128, 128, 128] / #808080)
 * - Calibrated Reference White 90% (Target: RGB [230, 230, 230] / #E6E6E6)
 * - Control Black 5% (Target: RGB [25, 25, 25] / #191919)
 */

import { Platform } from 'react-native';
import * as jpeg from 'jpeg-js';
import { rgbToCielab, formatCielab, type CielabColor } from './cielabColor';

export interface ReferenceCardPatch {
  name: string;
  nominalHex: string;
  nominalRgb: [number, number, number];
  purpose: 'white_balance' | 'gray_balance' | 'shadow_baseline' | 'color_gamut';
}

export const STANDARD_REFERENCE_PATCHES: ReferenceCardPatch[] = [
  {
    name: '18% Neutral Gray',
    nominalHex: '#808080',
    nominalRgb: [128, 128, 128],
    purpose: 'gray_balance',
  },
  {
    name: 'Calibrated White',
    nominalHex: '#E6E6E6',
    nominalRgb: [230, 230, 230],
    purpose: 'white_balance',
  },
  {
    name: 'Control Deep Black',
    nominalHex: '#191919',
    nominalRgb: [25, 25, 25],
    purpose: 'shadow_baseline',
  },
  {
    name: 'Cyan Reference',
    nominalHex: '#00AEEF',
    nominalRgb: [0, 174, 239],
    purpose: 'color_gamut',
  },
  {
    name: 'Magenta Reference',
    nominalHex: '#EC008C',
    nominalRgb: [236, 0, 140],
    purpose: 'color_gamut',
  },
  {
    name: 'Yellow Reference',
    nominalHex: '#FFF200',
    nominalRgb: [255, 242, 0],
    purpose: 'color_gamut',
  },
];

export interface CalibrationGainFactors {
  gainR: number;
  gainG: number;
  gainB: number;
  overallIlluminance: number; // 0 to 255
  colorTemperatureEstimate: 'WARM_TUNGSTEN' | 'DAYLIGHT_BALANCED' | 'COOL_FLUORESCENT';
}

export interface CardValidationReport {
  isValid: boolean;
  status: 'CALIBRATED' | 'CALIBRATION_REQUIRED';
  reason: string;
}

export interface ReactionValidationReport {
  isValid: boolean;
  reason: string;
}

export interface CalibrationReport {
  isCalibrated: boolean;
  lightingQuality: 'GOOD' | 'MARGINAL' | 'POOR';
  rawReferenceRgb: [number, number, number];
  rawReferenceHex: string;
  gainFactors: CalibrationGainFactors;
  rawSampleRgb: [number, number, number];
  rawSampleHex: string;
  calibratedSampleRgb: [number, number, number];
  calibratedSampleHex: string;
  calibratedCielab?: CielabColor;
  calibratedCielabFormatted?: string;
  illuminantCorrectionApplied: boolean;
  notes: string;
  cardValidation?: CardValidationReport;
  reactionValidation?: ReactionValidationReport;
}

/**
 * Normalizes an RGB tuple to clamped 0-255 integers.
 */
export function clampRgb(rgb: [number, number, number]): [number, number, number] {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0]))),
    Math.max(0, Math.min(255, Math.round(rgb[1]))),
    Math.max(0, Math.min(255, Math.round(rgb[2]))),
  ];
}

/**
 * Converts RGB tuple to Hex string.
 */
export function rgbToHex(rgb: [number, number, number]): string {
  const [r, g, b] = clampRgb(rgb);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Validates the in-frame reference card patch for neutral gray spectral balance,
 * operational exposure limits, and spatial texture uniformity.
 */
export function validateReferenceCardPatch(
  refRgb: [number, number, number],
  stdDev?: number
): CardValidationReport {
  if (!refRgb || (refRgb[0] === 0 && refRgb[1] === 0 && refRgb[2] === 0)) {
    return {
      isValid: false,
      status: 'CALIBRATION_REQUIRED',
      reason: 'Reference card missing: No optical signal detected in card reticle.',
    };
  }

  const [r, g, b] = refRgb;
  const illuminance = 0.299 * r + 0.587 * g + 0.114 * b;

  // 1. Exposure limits for an 18% neutral gray card under operational field lighting
  if (illuminance < 35) {
    return {
      isValid: false,
      status: 'CALIBRATION_REQUIRED',
      reason: `Reference region severely underexposed (luminance ${illuminance.toFixed(0)} < 35). Reference card cannot be verified in darkness.`,
    };
  }
  if (illuminance > 235) {
    return {
      isValid: false,
      status: 'CALIBRATION_REQUIRED',
      reason: `Reference region saturated by glare (luminance ${illuminance.toFixed(0)} > 235). Angle sensor to eliminate glare.`,
    };
  }

  // 2. Gray Neutrality Check:
  // An 18% neutral gray card reflects R, G, B equally across the spectrum.
  // Real field illuminants (2500K warm incandescent to 7500K cool shade) induce moderate chromatic cast.
  // Strongly chromatic surfaces (green desks, blue folders, wood tables, red carpet) exhibit extreme channel divergence.
  const sum = r + g + b || 1;
  const normR = r / sum;
  const normG = g / sum;
  const normB = b / sum;

  const maxChromaDev = Math.max(
    Math.abs(normR - 0.3333),
    Math.abs(normG - 0.3333),
    Math.abs(normB - 0.3333)
  );

  if (maxChromaDev > 0.11) {
    return {
      isValid: false,
      status: 'CALIBRATION_REQUIRED',
      reason: `Reference region lacks neutral gray chromaticity (chromatic deviation ${(maxChromaDev * 100).toFixed(1)}% exceeds 11% field tolerance). Non-gray surface detected.`,
    };
  }

  const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
  if (channelSpread > 60) {
    return {
      isValid: false,
      status: 'CALIBRATION_REQUIRED',
      reason: `Reference region channel variance too high (spread ${channelSpread} > 60). Valid neutral gray reference card not detected.`,
    };
  }

  // 3. Patch Uniformity Check: Reference card patches are flat, uniform surfaces.
  // Standard photographic gray cards have low spatial noise. Digital displays, camera compression,
  // and screen moiré patterns exhibit moderate variance (σ ~25-40). Cluttered surfaces (keyboards,
  // desks, fabrics) exhibit extreme spatial clutter (σ > 55).
  if (stdDev !== undefined && stdDev > 45) {
    return {
      isValid: false,
      status: 'CALIBRATION_REQUIRED',
      reason: `Reference region exhibits high spatial clutter/texture (σ = ${stdDev.toFixed(1)} > 45). Ensure the gray card fills the upper reticle box without borders or text.`,
    };
  }

  return {
    isValid: true,
    status: 'CALIBRATED',
    reason: 'Valid neutral reference card verified within operational tolerances.',
  };
}

/**
 * Validates the reaction zone for basic optical presence and contrast against background.
 */
export function validateReactionRegion(
  reactionRgb: [number, number, number],
  refRgb: [number, number, number],
  stdDev?: number
): ReactionValidationReport {
  if (!reactionRgb) {
    return { isValid: false, reason: 'Reaction region data missing.' };
  }

  const [r, g, b] = reactionRgb;
  const illuminance = 0.299 * r + 0.587 * g + 0.114 * b;

  if (illuminance < 15) {
    return { isValid: false, reason: 'Reaction region unlit (illuminance < 15).' };
  }

  // Check contrast between reference zone and reaction zone:
  // If the user captures an arbitrary flat scene (e.g. blank wall, empty desk, carpet)
  // where the reaction box has the same color as the reference box:
  const dR = r - refRgb[0];
  const dG = g - refRgb[1];
  const dB = b - refRgb[2];
  const distToRef = Math.sqrt(dR * dR + dG * dG + dB * dB);

  // In real field test setups (Scott, Marquis, Duquenois, etc.), the reaction sample
  // has a distinct optical presence compared to the neutral 18% gray card (dist >= 12).
  if (distToRef < 12) {
    return {
      isValid: false,
      reason: `Reaction zone does not exhibit optical contrast with reference zone (ΔE = ${distToRef.toFixed(1)} < 12). Uniform background without reaction vessel detected.`,
    };
  }

  return {
    isValid: true,
    reason: 'Valid reaction optical signal detected.',
  };
}

/**
 * Analyzes the measured reference card color and computes the illuminant gain factors.
 * Ideal target defaults to 18% Neutral Gray ([128, 128, 128]) or Calibrated White ([230, 230, 230]).
 */
export function computeIlluminantGains(
  measuredRefRgb: [number, number, number],
  referenceType: 'gray_18' | 'white_90' = 'gray_18'
): { gains: CalibrationGainFactors; lightingQuality: 'GOOD' | 'MARGINAL' | 'POOR'; notes: string } {
  const targetRgb = referenceType === 'gray_18' ? [128, 128, 128] : [230, 230, 230];

  const mR = Math.max(1, measuredRefRgb[0]);
  const mG = Math.max(1, measuredRefRgb[1]);
  const mB = Math.max(1, measuredRefRgb[2]);

  const illuminance = 0.299 * mR + 0.587 * mG + 0.114 * mB;

  // Compute channel gains
  let gainR = targetRgb[0] / mR;
  let gainG = targetRgb[1] / mG;
  let gainB = targetRgb[2] / mB;

  // Clamp extreme gains to avoid catastrophic amplifier noise
  gainR = Math.max(0.3, Math.min(3.5, gainR));
  gainG = Math.max(0.3, Math.min(3.5, gainG));
  gainB = Math.max(0.3, Math.min(3.5, gainB));

  // Estimate illuminant color temperature
  let colorTemp: 'WARM_TUNGSTEN' | 'DAYLIGHT_BALANCED' | 'COOL_FLUORESCENT' = 'DAYLIGHT_BALANCED';
  if (mR > mB * 1.25) {
    colorTemp = 'WARM_TUNGSTEN';
  } else if (mB > mR * 1.25) {
    colorTemp = 'COOL_FLUORESCENT';
  }

  // Evaluate lighting quality
  let quality: 'GOOD' | 'MARGINAL' | 'POOR' = 'GOOD';
  let notes = 'Lighting conditions are optimal. Illumination calibration active.';

  if (illuminance < 35) {
    quality = 'POOR';
    notes = 'Severe underexposure: Ambient lighting is too dark (< 35/255) for accurate colorimetry.';
  } else if (illuminance > 240) {
    quality = 'POOR';
    notes = 'Sensor saturation: Direct glare or intense overexposure detected (> 240/255).';
  } else if (illuminance < 60 || illuminance > 220 || gainR > 2.2 || gainB > 2.2) {
    quality = 'MARGINAL';
    notes = `Marginal lighting: Strong ${colorTemp.toLowerCase().replace('_', ' ')} color cast normalized via reference card.`;
  }

  return {
    gains: {
      gainR: Math.round(gainR * 1000) / 1000,
      gainG: Math.round(gainG * 1000) / 1000,
      gainB: Math.round(gainB * 1000) / 1000,
      overallIlluminance: Math.round(illuminance),
      colorTemperatureEstimate: colorTemp,
    },
    lightingQuality: quality,
    notes,
  };
}

/**
 * Applies reference card lighting calibration to an uncalibrated test reaction sample.
 */
export function calibrateSampleWithReferenceCard(
  rawSampleRgb: [number, number, number],
  rawReferenceRgb: [number, number, number],
  referenceType: 'gray_18' | 'white_90' = 'gray_18',
  refStdDev?: number,
  sampleStdDev?: number
): CalibrationReport {
  const cardValidation = validateReferenceCardPatch(rawReferenceRgb, refStdDev);
  const reactionValidation = validateReactionRegion(rawSampleRgb, rawReferenceRgb, sampleStdDev);

  const { gains, lightingQuality, notes } = computeIlluminantGains(rawReferenceRgb, referenceType);

  // Calibration is declared valid ONLY if reference card validation passed AND lighting is not POOR
  const isCalibrated = cardValidation.isValid && lightingQuality !== 'POOR';

  // Apply gains with chromatic adaptation
  const calibratedR = Math.min(255, Math.max(0, rawSampleRgb[0] * gains.gainR));
  const calibratedG = Math.min(255, Math.max(0, rawSampleRgb[1] * gains.gainG));
  const calibratedB = Math.min(255, Math.max(0, rawSampleRgb[2] * gains.gainB));

  const calibratedRgb: [number, number, number] = clampRgb([calibratedR, calibratedG, calibratedB]);
  const calLab = rgbToCielab(calibratedRgb);

  const combinedNotes = !cardValidation.isValid
    ? cardValidation.reason
    : !reactionValidation.isValid
    ? reactionValidation.reason
    : notes;

  return {
    isCalibrated,
    lightingQuality: isCalibrated ? lightingQuality : 'POOR',
    rawReferenceRgb,
    rawReferenceHex: rgbToHex(rawReferenceRgb),
    gainFactors: gains,
    rawSampleRgb,
    rawSampleHex: rgbToHex(rawSampleRgb),
    calibratedSampleRgb: calibratedRgb,
    calibratedSampleHex: rgbToHex(calibratedRgb),
    calibratedCielab: calLab,
    calibratedCielabFormatted: formatCielab(calLab),
    illuminantCorrectionApplied: isCalibrated,
    notes: combinedNotes,
    cardValidation,
    reactionValidation,
  };
}

/**
 * Pre-configured benchmark test presets for instant live demonstration.
 * Allows instant verification of the entire dual-target CV pipeline with realistic
 * field-test conditions (warm tungsten lighting, cool shade, optimal daylight).
 */
export interface DemoBenchmarkPreset {
  id: string;
  title: string;
  kitId: string;
  expectedOutcome: 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';
  expectedSubstance: string;
  ambientLighting: string;
  sampleDescription: string;
  rawSampleRgb: [number, number, number];
  rawReferenceRgb: [number, number, number]; // Reference card 18% neutral gray under this lighting
}

export const DEMO_BENCHMARK_PRESETS: DemoBenchmarkPreset[] = [
  {
    id: 'preset_scott_cocaine_positive',
    title: 'Scott Reagent: Cocaine HCl (Warm Tungsten Illumination)',
    kitId: 'scott',
    expectedOutcome: 'POSITIVE',
    expectedSubstance: 'Cocaine (HCl / Base)',
    ambientLighting: 'Indoor tungsten lamp (warm yellow cast, R-heavy)',
    sampleDescription: 'Reaction ampoule shows vivid cobalt blue precipitate under warm incandescent bulb',
    // Uncalibrated has warm yellowish-red shift from 2700K lamp
    rawSampleRgb: [35, 62, 140],
    rawReferenceRgb: [155, 126, 98], // Shifted warm yellow (Gain R: ~0.82, Gain B: ~1.30)
  },
  {
    id: 'preset_marquis_heroin_positive',
    title: 'Marquis Reagent: Heroin / Morphine (Daylight Calibrated)',
    kitId: 'marquis',
    expectedOutcome: 'POSITIVE',
    expectedSubstance: 'Opiates (Heroin / Morphine / Codeine)',
    ambientLighting: '5500K Balanced outdoor daylight',
    sampleDescription: 'Dry sample spot turns deep violet-purple upon Marquis contact',
    rawSampleRgb: [72, 5, 128],
    rawReferenceRgb: [129, 127, 128], // Balanced daylight
  },
  {
    id: 'preset_marquis_meth_positive',
    title: 'Marquis Reagent: Methamphetamine (Fluorescent Lighting)',
    kitId: 'marquis',
    expectedOutcome: 'POSITIVE',
    expectedSubstance: 'Amphetamine / Methamphetamine',
    ambientLighting: 'Cool commercial fluorescent (greenish-blue cast)',
    sampleDescription: 'Sample turns deep orange-brown within 15 seconds',
    rawSampleRgb: [180, 85, 45],
    rawReferenceRgb: [120, 138, 134],
  },
  {
    id: 'preset_scott_negative',
    title: 'Scott Reagent: Negative / Non-Reactive (No Reaction)',
    kitId: 'scott',
    expectedOutcome: 'NEGATIVE',
    expectedSubstance: 'Negative / No Reaction',
    ambientLighting: 'Daylight balanced office lighting',
    sampleDescription: 'Reagent ampoule remains light pink without blue precipitate formation',
    rawSampleRgb: [228, 209, 212],
    rawReferenceRgb: [128, 128, 128],
  },
  {
    id: 'preset_duquenois_cannabis_positive',
    title: 'Duquenois-Levine: Cannabis / THC (Shade Lighting)',
    kitId: 'duquenois_levine',
    expectedOutcome: 'POSITIVE',
    expectedSubstance: 'Cannabinoids / THC',
    ambientLighting: 'Natural overcast shade',
    sampleDescription: 'Lower chloroform layer exhibits distinct purple/violet extraction',
    rawSampleRgb: [55, 28, 92],
    rawReferenceRgb: [122, 126, 132],
  },
  {
    id: 'preset_inconclusive_low_light',
    title: 'Inconclusive: Poor Nighttime Illumination',
    kitId: 'marquis',
    expectedOutcome: 'INCONCLUSIVE',
    expectedSubstance: 'Inconclusive (Degraded Illumination)',
    ambientLighting: 'Dark alleyway / uncalibrated shadow (< 25 lx)',
    sampleDescription: 'Reaction color is obscured by deep darkness and uncalibrated shadow',
    rawSampleRgb: [22, 18, 20],
    rawReferenceRgb: [24, 23, 24], // Below 28 threshold
  },
];

export interface DualZoneExtractionResult {
  rawSampleRgb: [number, number, number] | null;
  rawReferenceRgb: [number, number, number] | null;
  reactionRgb: [number, number, number] | null;
  referenceRgb: [number, number, number] | null;
  source: 'html5_canvas' | 'jpeg_decoder' | 'optical_estimate';
  extractionMethod: 'dynamic_dual_zone_pixel_sampling' | 'failed';
  extractionDetails: string;
  isValid: boolean;
  refStdDev?: number;
  reactionStdDev?: number;
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Samples pixel telemetry from a bounding box and computes mean RGB and standard deviation.
 */
export function sampleBoxWithStats(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  box: { x1: number; y1: number; x2: number; y2: number }
): { meanRgb: [number, number, number]; stdDev: number; count: number } {
  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  const startX = Math.max(0, Math.floor(box.x1 * width));
  const endX = Math.min(width, Math.ceil(box.x2 * width));
  const startY = Math.max(0, Math.floor(box.y1 * height));
  const endY = Math.min(height, Math.ceil(box.y2 * height));

  const sampledLums: number[] = [];

  for (let y = startY; y < endY; y += 2) {
    const rowOffset = y * width * 4;
    for (let x = startX; x < endX; x += 2) {
      const idx = rowOffset + x * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      totalR += r;
      totalG += g;
      totalB += b;
      sampledLums.push(0.299 * r + 0.587 * g + 0.114 * b);
      count++;
    }
  }

  if (count === 0) return { meanRgb: [0, 0, 0], stdDev: 0, count: 0 };

  const meanR = Math.round(totalR / count);
  const meanG = Math.round(totalG / count);
  const meanB = Math.round(totalB / count);
  const meanLum = 0.299 * meanR + 0.587 * meanG + 0.114 * meanB;

  let varianceSum = 0;
  for (let i = 0; i < sampledLums.length; i++) {
    const diff = sampledLums[i] - meanLum;
    varianceSum += diff * diff;
  }
  const stdDev = Math.round(Math.sqrt(varianceSum / count) * 10) / 10;

  return {
    meanRgb: [meanR, meanG, meanB],
    stdDev,
    count,
  };
}

export function sampleAverageRgb(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  box: { x1: number; y1: number; x2: number; y2: number }
): [number, number, number] {
  return sampleBoxWithStats(data, width, height, box).meanRgb;
}

/**
 * Extracts average color telemetry from dual in-frame target zones:
 * - Reference Card Zone (upper/card reticle)
 * - Reaction Window Zone (lower/reaction reticle)
 */
export async function extractDualZoneColorsAsync(
  imageUri: string,
  base64Data?: string,
  fallbackKitId: string = 'scott'
): Promise<DualZoneExtractionResult> {
  // Center-weighted Region of Interest (ROI): samples inner 50% core to prevent border/background bleeding
  const refBox = { x1: 0.25, y1: 0.22, x2: 0.75, y2: 0.42 };
  const reactionBox = { x1: 0.25, y1: 0.58, x2: 0.75, y2: 0.78 };

  // 1. Web Execution via Canvas API
  if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof window !== 'undefined') {
    try {
      const src = imageUri.startsWith('data:') ? imageUri : (base64Data ? `data:image/jpeg;base64,${base64Data}` : imageUri);
      const measured = await new Promise<{
        rawSample: [number, number, number];
        rawRef: [number, number, number];
        refStdDev: number;
        reactionStdDev: number;
      } | null>((resolve) => {
        const img = new (window as any).Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const refStats = sampleBoxWithStats(imgData.data, canvas.width, canvas.height, refBox);
            const reactStats = sampleBoxWithStats(imgData.data, canvas.width, canvas.height, reactionBox);
            resolve({
              rawSample: reactStats.meanRgb,
              rawRef: refStats.meanRgb,
              refStdDev: refStats.stdDev,
              reactionStdDev: reactStats.stdDev,
            });
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });

      if (measured) {
        return {
          rawSampleRgb: measured.rawSample,
          rawReferenceRgb: measured.rawRef,
          reactionRgb: measured.rawSample,
          referenceRgb: measured.rawRef,
          source: 'html5_canvas',
          extractionMethod: 'dynamic_dual_zone_pixel_sampling',
          extractionDetails: 'Real-time pixel sampling via HTML5 Canvas dual-zone reticle.',
          isValid: true,
          refStdDev: measured.refStdDev,
          reactionStdDev: measured.reactionStdDev,
        };
      }
    } catch (e) {
      console.warn('Web pixel extraction fallback:', e);
    }
  }

  // 2. Native Execution via jpeg-js
  if (base64Data && base64Data.length > 50) {
    try {
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const bytes = base64ToUint8Array(cleanBase64);
      const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
      if (decoded && decoded.width && decoded.height && decoded.data) {
        const refStats = sampleBoxWithStats(decoded.data, decoded.width, decoded.height, refBox);
        const reactStats = sampleBoxWithStats(decoded.data, decoded.width, decoded.height, reactionBox);
        return {
          rawSampleRgb: reactStats.meanRgb,
          rawReferenceRgb: refStats.meanRgb,
          reactionRgb: reactStats.meanRgb,
          referenceRgb: refStats.meanRgb,
          source: 'jpeg_decoder',
          extractionMethod: 'dynamic_dual_zone_pixel_sampling',
          extractionDetails: `Decoded ${decoded.width}x${decoded.height} JPEG frame via jpeg-js dual-zone reticle.`,
          isValid: true,
          refStdDev: refStats.stdDev,
          reactionStdDev: reactStats.stdDev,
        };
      }
    } catch (decodeErr) {
      console.warn('Native jpeg-js decode error:', decodeErr);
    }
  }

  // 3. Explicit decode failure — NEVER substitute predefined positive reagent colors in live mode!
  return {
    rawSampleRgb: null,
    rawReferenceRgb: null,
    reactionRgb: null,
    referenceRgb: null,
    source: 'optical_estimate',
    extractionMethod: 'failed',
    extractionDetails: 'Image decoding failed: Pixel telemetry unavailable from captured frame.',
    isValid: false,
  };
}

