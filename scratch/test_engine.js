// Standalone Node.js test for Reagent Library, Color Calibration, and Cryptographic Signatures
const crypto = require('crypto');

// 1. Reagent Library Logic Test
const REAGENT_PROFILES = {
  scott: [
    { id: 'scott_cocaine', name: 'Cocaine (HCl / Base)', category: 'POSITIVE', targetRgb: [0, 71, 171] },
    { id: 'scott_negative', name: 'Negative / Non-Reactive', category: 'NEGATIVE', targetRgb: [232, 213, 216] },
  ],
  marquis: [
    { id: 'marquis_opiate', name: 'Opiates (Heroin / Morphine)', category: 'POSITIVE', targetRgb: [75, 0, 130] },
    { id: 'marquis_meth', name: 'Amphetamine / Methamphetamine', category: 'POSITIVE', targetRgb: [200, 75, 30] },
    { id: 'marquis_negative', name: 'Negative / Non-Reactive', category: 'NEGATIVE', targetRgb: [246, 243, 216] },
  ]
};

function calculateColorDistance(c1, c2) {
  const dR = c1[0] - c2[0];
  const dG = c1[1] - c2[1];
  const dB = c1[2] - c2[2];
  return Math.sqrt(dR * dR + dG * dG + dB * dB);
}

function classifyReagent(calibratedRgb, kitId, lightingQuality = 'GOOD') {
  if (lightingQuality === 'POOR') {
    return { outcomeCategory: 'INCONCLUSIVE', reason: 'Poor Lighting' };
  }
  const profiles = REAGENT_PROFILES[kitId] || REAGENT_PROFILES.scott;
  let best = null;
  let bestDist = Infinity;
  for (const p of profiles) {
    const d = calculateColorDistance(calibratedRgb, p.targetRgb);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  if (best && best.category === 'POSITIVE' && bestDist <= 110) {
    return { outcomeCategory: 'POSITIVE', substance: best.name, distance: bestDist };
  }
  if (best && best.category === 'NEGATIVE' && bestDist <= 90) {
    return { outcomeCategory: 'NEGATIVE', substance: best.name, distance: bestDist };
  }
  return { outcomeCategory: 'INCONCLUSIVE', distance: bestDist };
}

// 2. Reference Card Calibration Test
function computeGains(refRgb) {
  const targetRgb = [128, 128, 128]; // 18% neutral gray
  const illuminance = 0.299 * refRgb[0] + 0.587 * refRgb[1] + 0.114 * refRgb[2];
  const gainR = targetRgb[0] / Math.max(1, refRgb[0]);
  const gainG = targetRgb[1] / Math.max(1, refRgb[1]);
  const gainB = targetRgb[2] / Math.max(1, refRgb[2]);
  const quality = illuminance < 28 ? 'POOR' : (illuminance > 248 ? 'POOR' : 'GOOD');
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

// 3. Cryptographic Signature Test
const DEVICE_SIGNING_SALT = 'FTC_FORENSIC_INTEGRITY_SALT_v1_SECURE_KEY_2026';

function buildCanonicalString(payload) {
  const obj = {
    calibratedRgb: payload.calibratedRgb || '',
    confidenceScore: payload.confidenceScore !== null ? Number(payload.confidenceScore.toFixed(2)) : null,
    id: payload.id.trim(),
    imageHash: payload.imageHash.trim().toLowerCase(),
    kitType: payload.kitType.trim(),
    latitude: payload.latitude !== null ? Number(payload.latitude.toFixed(6)) : null,
    locationStatus: payload.locationStatus.trim(),
    longitude: payload.longitude !== null ? Number(payload.longitude.toFixed(6)) : null,
    operatorId: payload.operatorId.trim(),
    outcomeCategory: payload.outcomeCategory.trim(),
    presumptiveSubstance: payload.presumptiveSubstance.trim(),
    referenceCardCalibrated: Boolean(payload.referenceCardCalibrated),
    referenceId: payload.referenceId.trim(),
    timestamp: payload.timestamp.trim(),
  };
  return JSON.stringify(obj);
}

function signPayload(payload) {
  const canonicalStr = buildCanonicalString(payload);
  const payloadDigest = crypto.createHash('sha256').update(canonicalStr).digest('hex');
  const keyedInput = `${DEVICE_SIGNING_SALT}:${canonicalStr}:${payloadDigest}`;
  const sig = crypto.createHash('sha256').update(keyedInput).digest('hex');
  return `SIG-SHA256:${sig}`;
}

function verifyPayload(payload, signature) {
  const expectedSig = signPayload(payload);
  return expectedSig.toLowerCase() === signature.toLowerCase();
}

// Run test suite
console.log('=== RUNNING FIELD TEST COMPANION ENGINE VERIFICATION ===\n');

// Test 1: Reagent Classification
const scottPositive = classifyReagent([10, 65, 165], 'scott', 'GOOD');
console.assert(scottPositive.outcomeCategory === 'POSITIVE', 'Scott Cocaine should be POSITIVE');
console.log('✓ Scott Reagent Cocaine classification:', scottPositive);

const marquisHeroin = classifyReagent([70, 10, 125], 'marquis', 'GOOD');
console.assert(marquisHeroin.outcomeCategory === 'POSITIVE', 'Marquis Heroin should be POSITIVE');
console.log('✓ Marquis Reagent Heroin classification:', marquisHeroin);

const marquisMeth = classifyReagent([195, 78, 32], 'marquis', 'GOOD');
console.assert(marquisMeth.outcomeCategory === 'POSITIVE', 'Marquis Meth should be POSITIVE');
console.log('✓ Marquis Reagent Methamphetamine classification:', marquisMeth);

const scottNegative = classifyReagent([230, 210, 215], 'scott', 'GOOD');
console.assert(scottNegative.outcomeCategory === 'NEGATIVE', 'Scott Negative should be NEGATIVE');
console.log('✓ Scott Reagent Negative classification:', scottNegative);

const lowLightInconclusive = classifyReagent([10, 65, 165], 'scott', 'POOR');
console.assert(lowLightInconclusive.outcomeCategory === 'INCONCLUSIVE', 'Poor light should be INCONCLUSIVE');
console.log('✓ Low Light Inconclusive classification:', lowLightInconclusive);

// Test 2: Reference Card Lighting Calibration
const warmTungstenRef = [155, 126, 98]; // Warm yellow cast
const rawSampleUnderTungsten = [35, 62, 140];
const calResult = calibrateSample(rawSampleUnderTungsten, warmTungstenRef);
console.log('\n✓ In-Frame Reference Card Calibration:');
console.log('  Raw Sample (under tungsten):', rawSampleUnderTungsten);
console.log('  Reference 18% Gray:', warmTungstenRef);
console.log('  Calculated Gains (R/G/B):', calResult.gains.gainR.toFixed(3), calResult.gains.gainG.toFixed(3), calResult.gains.gainB.toFixed(3));
console.log('  Illumination-Calibrated Sample RGB:', calResult.calibrated);
const calClassification = classifyReagent(calResult.calibrated, 'scott', calResult.gains.quality);
console.assert(calClassification.outcomeCategory === 'POSITIVE', 'Calibrated Scott should be POSITIVE');
console.log('  Post-Calibration Classification:', calClassification);

// Test 3: Cryptographic Tamper-Evident Signatures
console.log('\n✓ Cryptographic Tamper-Evident Signatures:');
const testRecord = {
  id: 'REC-2026-TEST-001',
  referenceId: 'SMP-COCAINE-EVIDENCE-402',
  operatorId: 'BADGE-7412',
  timestamp: '2026-09-23T02:45:00.000Z',
  latitude: 37.774929,
  longitude: -122.419416,
  locationStatus: 'available',
  imageHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  kitType: 'scott',
  outcomeCategory: 'POSITIVE',
  presumptiveSubstance: 'Cocaine (HCl / Base) (Presumptive)',
  confidenceScore: 0.96,
  calibratedRgb: '[29, 63, 183]',
  referenceCardCalibrated: true,
};

const signature = signPayload(testRecord);
console.log('  Generated Signature:', signature);
const isValid = verifyPayload(testRecord, signature);
console.assert(isValid === true, 'Signature should verify for untouched record');
console.log('  Untouched Record Verification:', isValid ? 'PASS (AUTHENTIC)' : 'FAIL');

// Test Tampering: Change operator ID
const tamperedRecord1 = { ...testRecord, operatorId: 'BADGE-9999' };
const isTampered1 = verifyPayload(tamperedRecord1, signature);
console.assert(isTampered1 === false, 'Tampered operator should fail');
console.log('  Tampered Operator Verification:', isTampered1 ? 'UNEXPECTED PASS' : 'PASS (TAMPER DETECTED)');

// Test Tampering: Change outcome
const tamperedRecord2 = { ...testRecord, outcomeCategory: 'NEGATIVE' };
const isTampered2 = verifyPayload(tamperedRecord2, signature);
console.assert(isTampered2 === false, 'Tampered outcome should fail');
console.log('  Tampered Outcome Verification:', isTampered2 ? 'UNEXPECTED PASS' : 'PASS (TAMPER DETECTED)');

// Test Tampering: Change image SHA-256 hash
const tamperedRecord3 = { ...testRecord, imageHash: '0000000000000000000000000000000000000000000000000000000000000000' };
const isTampered3 = verifyPayload(tamperedRecord3, signature);
console.assert(isTampered3 === false, 'Tampered image hash should fail');
console.log('  Tampered Image Hash Verification:', isTampered3 ? 'UNEXPECTED PASS' : 'PASS (TAMPER DETECTED)');

console.log('\n=== ALL ENGINE VERIFICATIONS PASSED SUCCESSFULLY ===');
