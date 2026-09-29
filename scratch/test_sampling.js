const jpeg = require('jpeg-js');

// Create a minimal 100x100 RGB JPEG buffer to test jpeg-js decoding
const width = 100;
const height = 100;
const frameData = Buffer.alloc(width * height * 4);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    if (x < 50 && y < 50) {
      // Reference zone: 18% neutral gray (approx 128, 128, 128)
      frameData[idx] = 128;
      frameData[idx + 1] = 128;
      frameData[idx + 2] = 128;
      frameData[idx + 3] = 255;
    } else {
      // Reaction zone: Cobalt Thiocyanate blue (0, 71, 171)
      frameData[idx] = 0;
      frameData[idx + 1] = 71;
      frameData[idx + 2] = 171;
      frameData[idx + 3] = 255;
    }
  }
}

const rawImageData = {
  data: frameData,
  width: width,
  height: height,
};
const jpegImageData = jpeg.encode(rawImageData, 80);
const base64Data = jpegImageData.data.toString('base64');

console.log('Generated test JPEG byte stream, length:', base64Data.length);

// Decode back using jpeg.decode
const decoded = jpeg.decode(Buffer.from(base64Data, 'base64'), { useTArray: true });
console.log('Decoded dimensions:', decoded.width, 'x', decoded.height);

// Test zone sampling logic
function sampleRect(data, imgWidth, imgHeight, rx, ry, rw, rh) {
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let y = ry; y < ry + rh && y < imgHeight; y++) {
    for (let x = rx; x < rx + rw && x < imgWidth; x++) {
      const idx = (y * imgWidth + x) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }
  }
  return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
}

const refSample = sampleRect(decoded.data, decoded.width, decoded.height, 10, 10, 20, 20);
const reactSample = sampleRect(decoded.data, decoded.width, decoded.height, 60, 60, 20, 20);

console.log('Sampled Reference Card RGB:', refSample);
console.log('Sampled Reaction Window RGB:', reactSample);

if (Math.abs(refSample[0] - 128) < 15 && Math.abs(reactSample[2] - 171) < 15) {
  console.log('✓ DUAL-ZONE PIXEL EXTRACTION TEST PASSED WITH REAL JPEG BYTE DECODING');
} else {
  console.error('✗ Sampling values out of expected bounds');
  process.exit(1);
}
