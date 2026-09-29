/**
 * CIELAB (CIE L*a*b*) Mathematical Colorimetry Module
 * 
 * Provides deterministic, dependency-free transformation from standard sRGB
 * to CIE XYZ (under Standard Illuminant D65, 2° standard observer) and CIELAB,
 * as well as ΔE*ab (CIE76) color difference measurement.
 * 
 * STANDARD REFERENCE CONSTANTS (CIE 15:2004 / ASTM E308):
 * - Standard Illuminant D65 reference white: Xn = 0.95047, Yn = 1.00000, Zn = 1.08883
 * - sRGB chromaticity coordinates (ITU-R BT.709)
 * - CIE transfer threshold: δ = 6/29 ≈ 0.20689655 (δ³ ≈ 0.00885645)
 */

export interface CielabColor {
  /** Lightness: 0 (black) to 100 (diffuse white) */
  L: number;
  /** Green-to-Red axis: negative is green, positive is red */
  a: number;
  /** Blue-to-Yellow axis: negative is blue, positive is yellow */
  b: number;
}

export interface ColorimetricMeasurement {
  srgb: [number, number, number];
  hex: string;
  cielab: CielabColor;
}

// Reference white D65 (normalized to Yn = 1.0)
const D65_XN = 0.95047;
const D65_YN = 1.00000;
const D65_ZN = 1.08883;

// CIE standard constants
const CIE_EPSILON = 216 / 24389; // ≈ 0.008856
const CIE_KAPPA = 24389 / 27;     // ≈ 903.3

/**
 * Converts an sRGB component (0-255) to linear light RGB (0.0 - 1.0)
 * applying the standard sRGB inverse companding function.
 */
export function srgbChannelToLinear(c255: number): number {
  const c = Math.max(0, Math.min(255, c255)) / 255.0;
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Converts an sRGB [R, G, B] tuple (0-255) to CIE 1931 XYZ (D65 illuminant).
 */
export function srgbToXyz(rgb: [number, number, number]): [number, number, number] {
  const rLin = srgbChannelToLinear(rgb[0]);
  const gLin = srgbChannelToLinear(rgb[1]);
  const bLin = srgbChannelToLinear(rgb[2]);

  // sRGB to XYZ matrix (D65)
  const x = 0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin;
  const y = 0.2126729 * rLin + 0.7151522 * gLin + 0.0721750 * bLin;
  const z = 0.0193339 * rLin + 0.1191920 * gLin + 0.9503041 * bLin;

  return [x, y, z];
}

/**
 * Non-linear transformation function f(t) for CIE XYZ to CIELAB conversion.
 */
function fXyz(t: number): number {
  if (t > CIE_EPSILON) {
    return Math.cbrt(t);
  }
  return (CIE_KAPPA * t + 16) / 116;
}

/**
 * Converts an sRGB [R, G, B] tuple (0-255) to CIELAB (CIE L*a*b*).
 * 
 * Properties:
 * - L* ∈ [0, 100]
 * - a* ∈ [-128, +127] typically
 * - b* ∈ [-128, +127] typically
 */
export function rgbToCielab(rgb: [number, number, number]): CielabColor {
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

/**
 * Calculates the standard Euclidean color difference ΔE*ab (CIE 1976 / CIE76)
 * between two CIELAB colors:
 * 
 * ΔE*ab = √((ΔL*)² + (Δa*)² + (Δb*)²)
 */
export function calculateDeltaE76(lab1: CielabColor, lab2: CielabColor): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  const deltaE = Math.sqrt(dL * dL + da * da + db * db);
  return Math.round(deltaE * 100) / 100;
}

/**
 * Convenience helper to calculate ΔE*ab directly from two sRGB tuples.
 */
export function calculateDeltaE76FromRgb(
  rgb1: [number, number, number],
  rgb2: [number, number, number]
): number {
  const lab1 = rgbToCielab(rgb1);
  const lab2 = rgbToCielab(rgb2);
  return calculateDeltaE76(lab1, lab2);
}

/**
 * Formats a CIELAB color into a concise human-readable telemetry string.
 */
export function formatCielab(lab: CielabColor): string {
  return `L*=${lab.L.toFixed(1)}, a*=${lab.a >= 0 ? '+' : ''}${lab.a.toFixed(1)}, b*=${lab.b >= 0 ? '+' : ''}${lab.b.toFixed(1)}`;
}
