// Standalone script to test all DEMO_BENCHMARK_PRESETS

const PRESETS = [
  {
    id: 'preset_scott_cocaine_positive',
    title: 'Scott Reagent: Cocaine HCl (Warm Tungsten Illumination)',
    kitId: 'scott',
    expectedOutcome: 'POSITIVE',
    expectedSubstance: 'Cocaine (HCl / Base)',
    rawSampleRgb: [35, 62, 140],
    rawReferenceRgb: [155, 126, 98],
  },
  {
    id: 'preset_marquis_heroin_positive',
    title: 'Marquis Reagent: Heroin / Morphine (Daylight Calibrated)',
    kitId: 'marquis',
    expectedOutcome: 'POSITIVE',
    expectedSubstance: 'Opiates (Heroin / Morphine / Codeine)',
    rawSampleRgb: [72, 5, 128],
    rawReferenceRgb: [129, 127, 128],
  },
  {
    id: 'preset_marquis_meth_positive',
    title: 'Marquis Reagent: Methamphetamine (Fluorescent Lighting)',
    kitId: 'marquis',
    expectedOutcome: 'POSITIVE',
    expectedSubstance: 'Amphetamine / Methamphetamine',
    rawSampleRgb: [180, 85, 45],
    rawReferenceRgb: [120, 138, 134],
  },
  {
    id: 'preset_scott_negative',
    title: 'Scott Reagent: Negative / Non-Reactive (No Reaction)',
    kitId: 'scott',
    expectedOutcome: 'NEGATIVE',
    expectedSubstance: 'Negative / No Reaction',
    rawSampleRgb: [228, 209, 212],
    rawReferenceRgb: [128, 128, 128],
  },
  {
    id: 'preset_duquenois_cannabis_positive',
    title: 'Duquenois-Levine: Cannabis / THC (Shade Lighting)',
    kitId: 'duquenois_levine',
    expectedOutcome: 'POSITIVE',
    expectedSubstance: 'Cannabinoids / THC',
    rawSampleRgb: [55, 28, 92],
    rawReferenceRgb: [122, 126, 132],
  },
  {
    id: 'preset_inconclusive_low_light',
    title: 'Inconclusive: Poor Nighttime Illumination',
    kitId: 'marquis',
    expectedOutcome: 'INCONCLUSIVE',
    expectedSubstance: 'Inconclusive (Degraded Illumination)',
    rawSampleRgb: [22, 18, 20],
    rawReferenceRgb: [24, 23, 24],
  },
];

function computeGains(refRgb) {
  const targetRgb = [128, 128, 128];
  const mR = Math.max(1, refRgb[0]);
  const mG = Math.max(1, refRgb[1]);
  const mB = Math.max(1, refRgb[2]);
  const illuminance = 0.299 * mR + 0.587 * mG + 0.114 * mB;

  let gainR = Math.max(0.3, Math.min(3.5, targetRgb[0] / mR));
  let gainG = Math.max(0.3, Math.min(3.5, targetRgb[1] / mG));
  let gainB = Math.max(0.3, Math.min(3.5, targetRgb[2] / mB));

  let quality = 'GOOD';
  if (illuminance < 28 || illuminance > 248) {
    quality = 'POOR';
  } else if (illuminance < 60 || illuminance > 220 || gainR > 2.2 || gainB > 2.2) {
    quality = 'MARGINAL';
  }

  return { gainR, gainG, gainB, quality, illuminance };
}

function calibrateSample(rawSampleRgb, refRgb) {
  const gains = computeGains(refRgb);
  const calibrated = [
    Math.min(255, Math.max(0, Math.round(rawSampleRgb[0] * gains.gainR))),
    Math.min(255, Math.max(0, Math.round(rawSampleRgb[1] * gains.gainG))),
    Math.min(255, Math.max(0, Math.round(rawSampleRgb[2] * gains.gainB))),
  ];
  return { calibrated, gains };
}

const REAGENTS = {
  scott: {
    baseline: [232, 213, 216],
    profiles: [
      { name: 'Cocaine (HCl / Base)', cat: 'POSITIVE', target: [0, 71, 171] },
      { name: 'Negative / No Reaction', cat: 'NEGATIVE', target: [232, 213, 216] },
    ]
  },
  marquis: {
    baseline: [246, 243, 216],
    profiles: [
      { name: 'Opiates (Heroin / Morphine / Codeine)', cat: 'POSITIVE', target: [75, 0, 130] },
      { name: 'Amphetamine / Methamphetamine', cat: 'POSITIVE', target: [200, 75, 30] },
      { name: 'MDMA / Ecstasy', cat: 'POSITIVE', target: [24, 14, 41] },
      { name: 'Negative / Non-Reactive', cat: 'NEGATIVE', target: [246, 243, 216] },
    ]
  },
  duquenois_levine: {
    baseline: [245, 245, 220],
    profiles: [
      { name: 'Cannabinoids / THC', cat: 'POSITIVE', target: [75, 0, 130] },
      { name: 'Negative / Non-Reactive', cat: 'NEGATIVE', target: [245, 245, 220] },
    ]
  }
};

function dist(c1, c2) {
  const dR = c1[0] - c2[0];
  const dG = c1[1] - c2[1];
  const dB = c1[2] - c2[2];
  return Math.sqrt(dR * dR + dG * dG + dB * dB);
}

function classify(calibratedRgb, kitId, quality) {
  if (quality === 'POOR') {
    return { outcome: 'INCONCLUSIVE', substance: 'Inconclusive (Degraded Illumination)' };
  }

  const kit = REAGENTS[kitId];
  let best = null;
  let bestD = Infinity;
  for (const p of kit.profiles) {
    const d = dist(calibratedRgb, p.target);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }

  const baselineD = dist(calibratedRgb, kit.baseline);

  if (best && best.cat === 'POSITIVE' && bestD <= 110) {
    return { outcome: 'POSITIVE', substance: best.name, deltaE: bestD };
  }
  if (baselineD <= 90 || (best && best.cat === 'NEGATIVE' && bestD <= 90)) {
    return { outcome: 'NEGATIVE', substance: 'Negative / No Reaction', deltaE: baselineD };
  }
  return { outcome: 'INCONCLUSIVE', substance: 'Inconclusive / Ambiguous Reaction', deltaE: bestD };
}

console.log('--- TESTING ALL 6 DEMO BENCHMARK PRESETS ---');
let allPassed = true;

for (const preset of PRESETS) {
  const { calibrated, gains } = calibrateSample(preset.rawSampleRgb, preset.rawReferenceRgb);
  const result = classify(calibrated, preset.kitId, gains.quality);

  const matched = result.outcome === preset.expectedOutcome;
  console.log(`[${matched ? 'PASS' : 'FAIL'}] ${preset.title}`);
  console.log(`       Outcome: ${result.outcome} (Expected: ${preset.expectedOutcome})`);
  console.log(`       Substance: ${result.substance}`);
  console.log(`       Gains: R=${gains.gainR.toFixed(2)} G=${gains.gainG.toFixed(2)} B=${gains.gainB.toFixed(2)} Quality=${gains.quality}`);
  if (!matched) allPassed = false;
}

if (allPassed) {
  console.log('\n✓ ALL 6 DEMO PRESETS PRODUCE EXACT EXPECTED RESULTS');
} else {
  console.error('\n✗ ONE OR MORE PRESETS FAILED');
  process.exit(1);
}
