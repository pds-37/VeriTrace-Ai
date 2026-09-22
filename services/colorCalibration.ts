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
  illuminantCorrectionApplied: boolean;
  notes: string;
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

  if (illuminance < 28) {
    quality = 'POOR';
    notes = 'Severe underexposure: Ambient lighting is too dark (< 28/255) for accurate colorimetry.';
  } else if (illuminance > 248) {
    quality = 'POOR';
    notes = 'Sensor saturation: Direct glare or intense overexposure detected (> 248/255).';
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
  referenceType: 'gray_18' | 'white_90' = 'gray_18'
): CalibrationReport {
  const { gains, lightingQuality, notes } = computeIlluminantGains(rawReferenceRgb, referenceType);

  // Apply gains with chromatic adaptation
  const calibratedR = Math.min(255, Math.max(0, rawSampleRgb[0] * gains.gainR));
  const calibratedG = Math.min(255, Math.max(0, rawSampleRgb[1] * gains.gainG));
  const calibratedB = Math.min(255, Math.max(0, rawSampleRgb[2] * gains.gainB));

  const calibratedRgb: [number, number, number] = clampRgb([calibratedR, calibratedG, calibratedB]);

  return {
    isCalibrated: true,
    lightingQuality,
    rawReferenceRgb,
    rawReferenceHex: rgbToHex(rawReferenceRgb),
    gainFactors: gains,
    rawSampleRgb,
    rawSampleHex: rgbToHex(rawSampleRgb),
    calibratedSampleRgb: calibratedRgb,
    calibratedSampleHex: rgbToHex(calibratedRgb),
    illuminantCorrectionApplied: true,
    notes,
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
