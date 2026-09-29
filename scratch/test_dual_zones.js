const jpeg = require('jpeg-js');

// Create test image generator
function createTestJpeg(refRgb, reactionRgb) {
  const width = 100;
  const height = 100;
  const frameData = Buffer.alloc(width * height * 4);

  // refBox: x1: 0.15, y1: 0.20, x2: 0.85, y2: 0.45
  // reactionBox: x1: 0.15, y1: 0.55, x2: 0.85, y2: 0.80
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (y >= 20 && y < 45 && x >= 15 && x < 85) {
        frameData[idx] = refRgb[0];
        frameData[idx + 1] = refRgb[1];
        frameData[idx + 2] = refRgb[2];
        frameData[idx + 3] = 255;
      } else if (y >= 55 && y < 80 && x >= 15 && x < 85) {
        frameData[idx] = reactionRgb[0];
        frameData[idx + 1] = reactionRgb[1];
        frameData[idx + 2] = reactionRgb[2];
        frameData[idx + 3] = 255;
      } else {
        frameData[idx] = 100;
        frameData[idx + 1] = 100;
        frameData[idx + 2] = 100;
        frameData[idx + 3] = 255;
      }
    }
  }

  const raw = { data: frameData, width, height };
  const encoded = jpeg.encode(raw, 90);
  return encoded.data.toString('base64');
}

function sampleBox(data, width, height, box) {
  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  const startX = Math.floor(box.x1 * width);
  const endX = Math.ceil(box.x2 * width);
  const startY = Math.floor(box.y1 * height);
  const endY = Math.ceil(box.y2 * height);

  for (let y = startY; y < endY; y += 2) {
    const rowOffset = y * width * 4;
    for (let x = startX; x < endX; x += 2) {
      const idx = rowOffset + x * 4;
      totalR += data[idx];
      totalG += data[idx + 1];
      totalB += data[idx + 2];
      count++;
    }
  }
  return [Math.round(totalR / count), Math.round(totalG / count), Math.round(totalB / count)];
}

const refBox = { x1: 0.15, y1: 0.20, x2: 0.85, y2: 0.45 };
const reactionBox = { x1: 0.15, y1: 0.55, x2: 0.85, y2: 0.80 };

// Image A: Warm lighting (warm ref [155, 126, 98]), Scott blue reaction [35, 62, 140]
const imgABase64 = createTestJpeg([155, 126, 98], [35, 62, 140]);
const decodedA = jpeg.decode(Buffer.from(imgABase64, 'base64'), { useTArray: true, formatAsRGBA: true });
const refA = sampleBox(decodedA.data, decodedA.width, decodedA.height, refBox);
const reactionA = sampleBox(decodedA.data, decodedA.width, decodedA.height, reactionBox);

// Image B: Cool fluorescent lighting (cool ref [120, 138, 134]), Marquis Meth orange [180, 85, 45]
const imgBBase64 = createTestJpeg([120, 138, 134], [180, 85, 45]);
const decodedB = jpeg.decode(Buffer.from(imgBBase64, 'base64'), { useTArray: true, formatAsRGBA: true });
const refB = sampleBox(decodedB.data, decodedB.width, decodedB.height, refBox);
const reactionB = sampleBox(decodedB.data, decodedB.width, decodedB.height, reactionBox);

console.log('--- TEST DUAL-ZONE PIXEL EXTRACTION ---');
console.log('Image A Sampled Reference RGB:', refA);
console.log('Image A Sampled Reaction RGB:', reactionA);
console.log('Image B Sampled Reference RGB:', refB);
console.log('Image B Sampled Reaction RGB:', reactionB);

// Assertions
if (refA[0] !== refB[0] && reactionA[2] !== reactionB[2]) {
  console.log('✓ VERIFIED: Changing the input image directly changes both sampled Reference and Reaction RGBs!');
} else {
  console.error('✗ ERROR: Sampled values did not change between distinct images.');
  process.exit(1);
}
