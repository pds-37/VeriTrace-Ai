/**
 * Reagent Library and Outcome Classification Engine
 * 
 * Defines standard colorimetric profiles for common presumptive drug-testing reagents
 * (Marquis, Scott Reagent, Duquenois-Levine, Mecke, Mandelin, Fentanyl Test Strips).
 * 
 * Provides automated classification against defined outcome categories:
 * - PRESUMPTIVE POSITIVE
 * - PRESUMPTIVE NEGATIVE
 * - INCONCLUSIVE
 * 
 * DISCLAIMER:
 * Field drug test outcomes are presumptive only. They provide mathematical colorimetric
 * comparison and evidentiary documentation; they do not replace confirmatory laboratory testing.
 */

import {
  rgbToCielab,
  calculateDeltaE76,
  formatCielab,
  type CielabColor,
} from './cielabColor';

export type OutcomeCategory =
  | 'PRESUMPTIVE POSITIVE'
  | 'PRESUMPTIVE NEGATIVE'
  | 'INCONCLUSIVE'
  | 'POSITIVE'
  | 'NEGATIVE';

export type PresumptiveOutcomeLabel =
  | 'PRESUMPTIVE POSITIVE'
  | 'PRESUMPTIVE NEGATIVE'
  | 'INCONCLUSIVE';

export function toPresumptiveOutcome(category: string | undefined | null): PresumptiveOutcomeLabel {
  if (!category) return 'INCONCLUSIVE';
  const upper = category.toUpperCase().trim();
  if (upper === 'POSITIVE' || upper === 'PRESUMPTIVE POSITIVE') {
    return 'PRESUMPTIVE POSITIVE';
  }
  if (upper === 'NEGATIVE' || upper === 'PRESUMPTIVE NEGATIVE') {
    return 'PRESUMPTIVE NEGATIVE';
  }
  return 'INCONCLUSIVE';
}

export interface ReagentReactionProfile {
  id: string;
  substanceName: string;
  category: OutcomeCategory;
  targetHex: string;
  targetRgb: [number, number, number];
  normalizedRgb: [number, number, number];
  calibrationStatus?: 'CALIBRATED' | 'CALIBRATION_REQUIRED';
  description: string;
  typicalTimeSeconds?: number;
}

export interface ReagentKitDefinition {
  id: string;
  name: string;
  shortName: string;
  targetSubstances: string[];
  baselineReagentHex: string;
  baselineReagentRgb: [number, number, number];
  baselineDescription: string;
  instructions: string;
  profiles: ReagentReactionProfile[];
}

export interface ReagentClassificationResult {
  kitId: string;
  kitName: string;
  outcomeCategory: PresumptiveOutcomeLabel;
  presumptiveSubstance: string;
  matchedProfileId?: string;
  confidenceScore: number; // Stored numeric score for database/HMAC signature compatibility
  colorDeltaE: number; // Euclidean color distance in calibrated RGB space (baseline classifier)
  deltaE76: number; // Standardized CIE76 ΔE*ab in CIELAB space (analytical telemetry)
  matchStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'; // Transparent forensic match concordance
  decisionMargin: number; // Distance separation between best profile and baseline in CIELAB units
  cielab: CielabColor; // Calibrated reaction CIELAB (L*, a*, b*)
  cielabFormatted: string; // Formatted "L*=..., a*=..., b*=..."
  rawCielab: CielabColor;
  calibratedRgb: [number, number, number];
  calibratedHex: string;
  rawRgb: [number, number, number];
  lightingQuality: 'GOOD' | 'MARGINAL' | 'POOR';
  calibrationStatus: 'CALIBRATED' | 'CALIBRATION_REQUIRED';
  notes: string;
  disclaimer: string;
}

/**
 * Standard Reagent Kits supported by field operations
 */
export const REAGENT_KITS: ReagentKitDefinition[] = [
  {
    id: 'scott',
    name: 'Scott Reagent (Cobalt Thiocyanate)',
    shortName: 'Scott (Cocaine)',
    targetSubstances: ['Cocaine HCl', 'Cocaine Base / Crack'],
    baselineReagentHex: '#E8D5D8', // Pale pink / faint rose
    baselineReagentRgb: [232, 213, 216],
    baselineDescription: 'Clear / pale pinkish solution (no blue precipitate)',
    instructions: 'Add sample to reagent ampoule. Shake. Positive reaction produces rapid cobalt/brilliant blue precipitate.',
    profiles: [
      {
        id: 'scott_cocaine_positive',
        substanceName: 'Cocaine (HCl / Base)',
        category: 'POSITIVE',
        targetHex: '#0047AB', // Cobalt Blue
        targetRgb: [0, 71, 171],
        normalizedRgb: [0.0, 0.2934, 0.7066],
        description: 'Intense cobalt blue precipitate in 2-phase reaction',
      },
      {
        id: 'scott_cocaine_bright_blue',
        substanceName: 'Cocaine (Freebase / High Purity)',
        category: 'POSITIVE',
        targetHex: '#1E3F8B', // Royal/Navy Cobalt Blue
        targetRgb: [30, 63, 139],
        normalizedRgb: [0.1293, 0.2716, 0.5991],
        description: 'Vivid royal blue precipitate',
      },
      {
        id: 'scott_negative_clear',
        substanceName: 'Negative / Non-Reactive',
        category: 'NEGATIVE',
        targetHex: '#E8D5D8',
        targetRgb: [232, 213, 216],
        normalizedRgb: [0.351, 0.3222, 0.3268],
        description: 'Reagent remains pink/clear without blue precipitate',
      },
    ],
  },
  {
    id: 'marquis',
    name: 'Marquis Reagent',
    shortName: 'Marquis (Opiates / Amphetamines / MDMA)',
    targetSubstances: ['Morphine', 'Heroin', 'Codeine', 'Amphetamine', 'Methamphetamine', 'MDMA'],
    baselineReagentHex: '#F6F3D8', // Pale straw yellow / clear
    baselineReagentRgb: [246, 243, 216],
    baselineDescription: 'Clear / pale straw-yellow liquid',
    instructions: 'Drop reagent onto dry sample. Observe immediate color transition within 10-30 seconds.',
    profiles: [
      {
        id: 'marquis_opiate_purple',
        substanceName: 'Opiates (Heroin / Morphine / Codeine)',
        category: 'POSITIVE',
        targetHex: '#4B0082', // Deep Purple / Violet
        targetRgb: [75, 0, 130],
        normalizedRgb: [0.3659, 0.0, 0.6341],
        description: 'Immediate deep violet/purple coloration',
      },
      {
        id: 'marquis_amphetamines_orange',
        substanceName: 'Amphetamine / Methamphetamine',
        category: 'POSITIVE',
        targetHex: '#C84B1E', // Orange / Reddish-Brown
        targetRgb: [200, 75, 30],
        normalizedRgb: [0.6557, 0.2459, 0.0984],
        description: 'Rapid orange to deep reddish-brown coloration',
      },
      {
        id: 'marquis_mdma_black',
        substanceName: 'MDMA / Ecstasy',
        category: 'POSITIVE',
        targetHex: '#180E29', // Dark Purple to Black
        targetRgb: [24, 14, 41],
        normalizedRgb: [0.3038, 0.1772, 0.519],
        description: 'Instant purple flashing rapidly to pitch black',
      },
      {
        id: 'marquis_negative_yellow',
        substanceName: 'Negative / Non-Reactive',
        category: 'NEGATIVE',
        targetHex: '#F6F3D8',
        targetRgb: [246, 243, 216],
        normalizedRgb: [0.3489, 0.3447, 0.3064],
        description: 'No color change; baseline pale reagent tone remains',
      },
    ],
  },
  {
    id: 'duquenois_levine',
    name: 'Duquenois-Levine Reagent',
    shortName: 'Duquenois-Levine (Cannabis)',
    targetSubstances: ['THC / Cannabis / Hashish / Concentrates'],
    baselineReagentHex: '#F5F5DC', // Beige / clear
    baselineReagentRgb: [245, 245, 220],
    baselineDescription: 'Clear / light straw liquid',
    instructions: 'Add Duquenois reagent, then HCl, then chloroform. Observe color transfer into lower chloroform layer.',
    profiles: [
      {
        id: 'duquenois_thc_positive',
        substanceName: 'Cannabinoids / THC (Marijuana / Hashish)',
        category: 'POSITIVE',
        targetHex: '#3B1F5E', // Deep Violet / Indigo
        targetRgb: [59, 31, 94],
        normalizedRgb: [0.3207, 0.1685, 0.5109],
        description: 'Deep violet/purple color extracted into lower chloroform layer',
      },
      {
        id: 'duquenois_negative',
        substanceName: 'Negative / Non-Reactive',
        category: 'NEGATIVE',
        targetHex: '#F5F5DC',
        targetRgb: [245, 245, 220],
        normalizedRgb: [0.3451, 0.3451, 0.3099],
        description: 'Lower layer remains clear or yellow without violet extraction',
      },
    ],
  },
  {
    id: 'mecke',
    name: 'Mecke Reagent',
    shortName: 'Mecke (Opiates / Heroin)',
    targetSubstances: ['Heroin', 'Morphine', 'Oxycodone'],
    baselineReagentHex: '#FFF8DC', // Cornsilk clear
    baselineReagentRgb: [255, 248, 220],
    baselineDescription: 'Clear liquid',
    instructions: 'Apply 1 drop to dry sample. Observe green-to-blue transition.',
    profiles: [
      {
        id: 'mecke_heroin_positive',
        substanceName: 'Heroin / Morphine',
        category: 'POSITIVE',
        targetHex: '#006A6B', // Deep Blue-Green / Teal
        targetRgb: [0, 106, 107],
        normalizedRgb: [0.0, 0.4977, 0.5023],
        description: 'Rapid deep green shifting to dark blue-green / teal',
      },
      {
        id: 'mecke_negative',
        substanceName: 'Negative / Non-Reactive',
        category: 'NEGATIVE',
        targetHex: '#FFF8DC',
        targetRgb: [255, 248, 220],
        normalizedRgb: [0.3527, 0.343, 0.3043],
        description: 'No color change observed',
      },
    ],
  },
  {
    id: 'fentanyl_strip',
    name: 'Fentanyl Test Strip (Lateral Flow Immunoassay)',
    shortName: 'Fentanyl Strip',
    targetSubstances: ['Fentanyl and Analogues'],
    baselineReagentHex: '#FFFFFF', // White nitrocellulose membrane
    baselineReagentRgb: [250, 250, 250],
    baselineDescription: 'White test membrane with control line indicator',
    instructions: 'Dip strip into prepared liquid for 15 seconds. Wait 2-5 minutes. 1 line (Control only) = POSITIVE; 2 lines (Control + Test) = NEGATIVE.',
    profiles: [
      {
        id: 'fentanyl_positive_single_line',
        substanceName: 'Fentanyl (Presumptive Positive — 1 Line)',
        category: 'POSITIVE',
        targetHex: '#B22222', // Crimson Control line present, test line absent
        targetRgb: [178, 34, 34],
        normalizedRgb: [0.7236, 0.1382, 0.1382],
        description: 'Single Control line visible; Test line absent (indicates fentanyl above detection cutoff)',
      },
      {
        id: 'fentanyl_negative_dual_line',
        substanceName: 'Negative / Non-Reactive (2 Lines)',
        category: 'NEGATIVE',
        targetHex: '#C71585', // Both Control and Test lines visible (pink/red bands)
        targetRgb: [199, 21, 133],
        normalizedRgb: [0.5637, 0.0595, 0.3768],
        description: 'Both Control (C) and Test (T) lines visible (fentanyl below detection cutoff)',
      },
    ],
  },
];

/**
 * Calculates Euclidean color distance between two RGB colors in normalized chromaticity and RGB space.
 */
export function calculateColorDistance(
  c1: [number, number, number],
  c2: [number, number, number]
): { euclidean: number; normalizedDistance: number } {
  const dR = c1[0] - c2[0];
  const dG = c1[1] - c2[1];
  const dB = c1[2] - c2[2];
  const euclidean = Math.sqrt(dR * dR + dG * dG + dB * dB);

  // Normalized chromaticity calculation
  const sum1 = c1[0] + c1[1] + c1[2] || 1;
  const sum2 = c2[0] + c2[1] + c2[2] || 1;
  const nR1 = c1[0] / sum1;
  const nG1 = c1[1] / sum1;
  const nB1 = c1[2] / sum1;
  const nR2 = c2[0] / sum2;
  const nG2 = c2[1] / sum2;
  const nB2 = c2[2] / sum2;

  const dNorm = Math.sqrt(
    (nR1 - nR2) * (nR1 - nR2) +
    (nG1 - nG2) * (nG1 - nG2) +
    (nB1 - nB2) * (nB1 - nB2)
  );

  return {
    euclidean: Math.round(euclidean * 10) / 10,
    normalizedDistance: Math.round(dNorm * 1000) / 1000,
  };
}

/**
 * Automatically classifies a calibrated reaction color against defined outcome categories.
 * 
 * Outcome Rules:
 * 1. POOR lighting quality or extreme underexposure/overexposure -> INCONCLUSIVE.
 * 2. If calibrated color is close to a defined POSITIVE reaction profile -> POSITIVE (with substance name).
 * 3. If calibrated color matches baseline unreacted reagent -> NEGATIVE.
 * 4. If color does not match any known positive or negative profile within allowable tolerance -> INCONCLUSIVE.
 */
export function classifyReagentReaction(
  calibratedRgb: [number, number, number] | null,
  rawRgb: [number, number, number] | null,
  kitId: string = 'scott',
  lightingQuality: 'GOOD' | 'MARGINAL' | 'POOR' = 'GOOD',
  isCalibrated: boolean = true
): ReagentClassificationResult {
  const kit = REAGENT_KITS.find(k => k.id === kitId) || REAGENT_KITS[0];
  const disclaimer = 'Presumptive field test result only. Does not replace laboratory confirmatory testing (GC-MS / HPLC).';

  const safeCalRgb: [number, number, number] = calibratedRgb || [0, 0, 0];
  const safeRawRgb: [number, number, number] = rawRgb || [0, 0, 0];

  const calLab = rgbToCielab(safeCalRgb);
  const rawLab = rgbToCielab(safeRawRgb);
  const hex = `#${safeCalRgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  const cielabFormatted = formatCielab(calLab);

  // 1. Critical Integrity Guardrail: Reference card must be verified and illumination valid
  if (!isCalibrated || lightingQuality === 'POOR' || !calibratedRgb || !rawRgb) {
    return {
      kitId: kit.id,
      kitName: kit.name,
      outcomeCategory: 'INCONCLUSIVE',
      presumptiveSubstance: !isCalibrated
        ? 'Inconclusive (Reference Card Calibration Required)'
        : 'Inconclusive (Degraded Illumination)',
      confidenceScore: 0,
      colorDeltaE: 99.9,
      deltaE76: 99.9,
      matchStrength: 'NONE',
      decisionMargin: 0,
      cielab: calLab,
      cielabFormatted,
      rawCielab: rawLab,
      calibratedRgb: safeCalRgb,
      calibratedHex: hex,
      rawRgb: safeRawRgb,
      lightingQuality: isCalibrated ? lightingQuality : 'POOR',
      calibrationStatus: 'CALIBRATION_REQUIRED',
      notes: !isCalibrated
        ? 'Reference card calibration is invalid or unverified. Presumptive substance classification cannot be performed without a valid in-frame reference card.'
        : 'Ambient illumination was outside valid operational limits. Recalibrate with reference card under steady lighting.',
      disclaimer,
    };
  }

  // 2. Evaluate distance to all defined profiles for the chosen kit
  let bestProfile: ReagentReactionProfile | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestNormDistance = Number.POSITIVE_INFINITY;
  let bestLabDeltaE = Number.POSITIVE_INFINITY;

  for (const profile of kit.profiles) {
    const dist = calculateColorDistance(safeCalRgb, profile.targetRgb);
    const profileLab = rgbToCielab(profile.targetRgb);
    const labDeltaE = calculateDeltaE76(calLab, profileLab);

    if (labDeltaE < bestLabDeltaE) {
      bestDistance = dist.euclidean;
      bestNormDistance = dist.normalizedDistance;
      bestProfile = profile;
      bestLabDeltaE = labDeltaE;
    }
  }

  // Also check baseline unreacted reagent distance
  const baselineDist = calculateColorDistance(safeCalRgb, kit.baselineReagentRgb);
  const baselineLab = rgbToCielab(kit.baselineReagentRgb);
  const baselineLabDeltaE = calculateDeltaE76(calLab, baselineLab);

  // Decision margin: separation between baseline and best target in CIELAB units
  const decisionMargin = Math.round(Math.abs(baselineLabDeltaE - bestLabDeltaE) * 10) / 10;

  // Standard forensic match strength thresholds (CIELAB ΔE*ab):
  // ΔE*ab <= 12: Strong colorimetric concordance
  // ΔE*ab <= 22: Moderate colorimetric concordance
  // ΔE*ab <= 35: Weak concordance
  // ΔE*ab > 35: Non-concordant / Ambiguous
  const matchStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE' =
    bestLabDeltaE <= 12 ? 'STRONG' : bestLabDeltaE <= 22 ? 'MODERATE' : bestLabDeltaE <= 35 ? 'WEAK' : 'NONE';

  // Strict Decision Thresholds:
  // In CIELAB space, ΔE*ab <= 22 indicates a genuine chemical reaction color match.
  // In RGB space, require ΔE_rgb <= 60 to prevent arbitrary dark surfaces/shadows from matching.
  // Also require decision margin >= 8 to ensure reaction is clearly distinct from unreacted reagent.
  const POSITIVE_LAB_THRESHOLD = 22;
  const POSITIVE_RGB_THRESHOLD = 60;
  const NEGATIVE_LAB_THRESHOLD = 18;
  const NEGATIVE_RGB_THRESHOLD = 50;

  if (
    bestProfile &&
    (bestProfile.category === 'POSITIVE' || bestProfile.category === 'PRESUMPTIVE POSITIVE') &&
    bestLabDeltaE <= POSITIVE_LAB_THRESHOLD &&
    bestDistance <= POSITIVE_RGB_THRESHOLD &&
    decisionMargin >= 8
  ) {
    const calStatus: 'CALIBRATED' | 'CALIBRATION_REQUIRED' = bestProfile.calibrationStatus || 'CALIBRATED';
    const confidence = matchStrength === 'STRONG' ? 0.95 : 0.80;

    return {
      kitId: kit.id,
      kitName: kit.name,
      outcomeCategory: 'PRESUMPTIVE POSITIVE',
      presumptiveSubstance: `${bestProfile.substanceName} (Presumptive)`,
      matchedProfileId: bestProfile.id,
      confidenceScore: confidence,
      colorDeltaE: bestDistance,
      deltaE76: bestLabDeltaE,
      matchStrength,
      decisionMargin,
      cielab: calLab,
      cielabFormatted,
      rawCielab: rawLab,
      calibratedRgb: safeCalRgb,
      calibratedHex: hex,
      rawRgb: safeRawRgb,
      lightingQuality,
      calibrationStatus: calStatus,
      notes: `Distinct colorimetric match for ${bestProfile.substanceName}. Calibrated reaction color ${hex} closely aligns with reference spectrum (ΔE*ab = ${bestLabDeltaE.toFixed(1)}, Match: ${matchStrength}, Decision Margin: ${decisionMargin.toFixed(1)} ΔE units).`,
      disclaimer,
    };
  }

  if (
    (baselineLabDeltaE <= NEGATIVE_LAB_THRESHOLD && baselineDist.euclidean <= NEGATIVE_RGB_THRESHOLD) ||
    (bestProfile &&
      (bestProfile.category === 'NEGATIVE' || bestProfile.category === 'PRESUMPTIVE NEGATIVE') &&
      bestLabDeltaE <= NEGATIVE_LAB_THRESHOLD)
  ) {
    return {
      kitId: kit.id,
      kitName: kit.name,
      outcomeCategory: 'PRESUMPTIVE NEGATIVE',
      presumptiveSubstance: 'Negative / No Reaction',
      matchedProfileId:
        bestProfile?.category === 'NEGATIVE' || bestProfile?.category === 'PRESUMPTIVE NEGATIVE'
          ? bestProfile.id
          : undefined,
      confidenceScore: 0.95,
      colorDeltaE: baselineDist.euclidean,
      deltaE76: baselineLabDeltaE,
      matchStrength: 'STRONG',
      decisionMargin,
      cielab: calLab,
      cielabFormatted,
      rawCielab: rawLab,
      calibratedRgb: safeCalRgb,
      calibratedHex: hex,
      rawRgb: safeRawRgb,
      lightingQuality,
      calibrationStatus: 'CALIBRATED',
      notes: `No diagnostic colorimetric shift detected. Calibrated color ${hex} matches unreacted reagent baseline (${kit.baselineDescription}, ΔE*ab = ${baselineLabDeltaE.toFixed(1)}).`,
      disclaimer,
    };
  }

  // 3. Ambiguous Reaction / Outside Tolerance
  return {
    kitId: kit.id,
    kitName: kit.name,
    outcomeCategory: 'INCONCLUSIVE',
    presumptiveSubstance: 'Inconclusive / Ambiguous Reaction',
    matchedProfileId: bestProfile?.id,
    confidenceScore: 0,
    colorDeltaE: bestDistance,
    deltaE76: bestLabDeltaE,
    matchStrength: 'NONE',
    decisionMargin,
    cielab: calLab,
    cielabFormatted,
    rawCielab: rawLab,
    calibratedRgb: safeCalRgb,
    calibratedHex: hex,
    rawRgb: safeRawRgb,
    lightingQuality,
    calibrationStatus: 'CALIBRATION_REQUIRED',
    notes: `Measured colorimetric profile ${hex} is outside valid match tolerance for ${kit.name} (ΔE*ab = ${bestLabDeltaE.toFixed(1)}, ΔE_rgb = ${bestDistance.toFixed(1)}). Reaction is ambiguous or adulterated. Confirmatory lab testing required.`,
    disclaimer,
  };
}
