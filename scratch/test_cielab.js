/**
 * CIELAB Colorimetry Mathematical Verification Test
 */

const fs = require('fs');
const path = require('path');

// Reference constants
const D65_XN = 0.95047;
const D65_YN = 1.00000;
const D65_ZN = 1.08883;

function srgbChannelToLinear(c255) {
  const c = Math.max(0, Math.min(255, c255)) / 255.0;
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

function srgbToXyz(rgb) {
  const rLin = srgbChannelToLinear(rgb[0]);
  const gLin = srgbChannelToLinear(rgb[1]);
  const bLin = srgbChannelToLinear(rgb[2]);

  const x = 0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin;
  const y = 0.2126729 * rLin + 0.7151522 * gLin + 0.0721750 * bLin;
  const z = 0.0193339 * rLin + 0.1191920 * gLin + 0.9503041 * bLin;

  return [x, y, z];
}

function fXyz(t) {
  const CIE_EPSILON = 216 / 24389;
  const CIE_KAPPA = 24389 / 27;
  if (t > CIE_EPSILON) {
    return Math.cbrt(t);
  }
  return (CIE_KAPPA * t + 16) / 116;
}

function rgbToCielab(rgb) {
  const [x, y, z] = srgbToXyz(rgb);
  const xr = x / D65_XN;
  const yr = y / D65_YN;
  const zr = z / D65_ZN;

  const fx = fXyz(xr);
  const fy = fXyz(yr);
  const fz = fXyz(zr);

  const L = Math.max(0, Math.min(100, 116 * fy - 16));
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return {
    L: Math.round(L * 100) / 100,
    a: Math.round(a * 100) / 100,
    b: Math.round(b * 100) / 100,
  };
}

function calculateDeltaE76(lab1, lab2) {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.round(Math.sqrt(dL * dL + da * da + db * db) * 100) / 100;
}

console.log('=== CIELAB MATHEMATICAL VERIFICATION ===');

// 1. Black
const blackLab = rgbToCielab([0, 0, 0]);
console.log('Black RGB [0, 0, 0] -> Lab:', blackLab);
if (blackLab.L !== 0 || blackLab.a !== 0 || blackLab.b !== 0) {
  console.error('FAIL: Black Lab expected L=0, a=0, b=0');
  process.exit(1);
}

// 2. White
const whiteLab = rgbToCielab([255, 255, 255]);
console.log('White RGB [255, 255, 255] -> Lab:', whiteLab);
if (Math.abs(whiteLab.L - 100) > 0.1 || Math.abs(whiteLab.a) > 0.1 || Math.abs(whiteLab.b) > 0.1) {
  console.error('FAIL: White Lab expected L=100, a~0, b~0');
  process.exit(1);
}

// 3. 18% Neutral Gray Card [128, 128, 128]
const grayLab = rgbToCielab([128, 128, 128]);
console.log('Neutral Gray RGB [128, 128, 128] -> Lab:', grayLab);
// Standard reference: sRGB 128 has L* ≈ 53.59, a* = 0, b* = 0
if (Math.abs(grayLab.L - 53.59) > 0.2 || Math.abs(grayLab.a) > 0.05 || Math.abs(grayLab.b) > 0.05) {
  console.error('FAIL: Neutral Gray expected L* ≈ 53.6, a*=0, b*=0');
  process.exit(1);
}

// 4. Pure Red [255, 0, 0]
const redLab = rgbToCielab([255, 0, 0]);
console.log('Pure Red RGB [255, 0, 0] -> Lab:', redLab);
if (redLab.a <= 50 || redLab.L < 50) {
  console.error('FAIL: Red expected strong positive a*');
  process.exit(1);
}

// 5. DeltaE between identical colors
const dZero = calculateDeltaE76(grayLab, grayLab);
if (dZero !== 0) {
  console.error('FAIL: Self deltaE expected 0, got:', dZero);
  process.exit(1);
}

// 6. DeltaE between Scott Cocaine Positive and Reference White
const cocaineLab = rgbToCielab([0, 71, 171]);
const deltaECocaine = calculateDeltaE76(cocaineLab, whiteLab);
console.log('Scott Cocaine Target RGB [0, 71, 171] -> Lab:', cocaineLab);
console.log('ΔE*ab (Cocaine to White):', deltaECocaine);

console.log('✓ ALL CIELAB MATHEMATICAL TESTS PASSED SUCCESSFULLY');
