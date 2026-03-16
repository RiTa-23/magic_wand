import {
  BinaryImageData,
  BinarizeOptions,
  ImageDataLike,
  binarizeImageData,
  packBinaryPixels,
} from "./imageProcessor";

const ESC = 0x1b;
const GS = 0x1d;
const US = 0x1f;

const DEFAULT_STRIPE_HEIGHT = 255;
const DEFAULT_FEED_LINES = 3;
const DEFAULT_ALIGNMENT = 1;
const DEFAULT_CONCENTRATION_COEFFICIENT = 0x96;
const DEFAULT_CONCENTRATION = 0x01;

export interface PhomemoEncodeOptions {
  stripeHeight?: number;
  feedLines?: number;
  alignment?: 0 | 1 | 2;
  concentrationCoefficient?: number;
  concentration?: number;
}

function toUint16LE(value: number): [number, number] {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`value out of range for uint16: ${value}`);
  }
  return [value & 0xff, (value >> 8) & 0xff];
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function buildStripeCommand(
  raster: Uint8Array,
  bytesPerRow: number,
  height: number,
): Uint8Array {
  const [widthL, widthH] = toUint16LE(bytesPerRow);
  const [heightL, heightH] = toUint16LE(height);

  return concatUint8Arrays([
    new Uint8Array([GS, 0x76, 0x30, 0x00, widthL, widthH, heightL, heightH]),
    raster,
  ]);
}

/**
 * Encode binary raster data using the ESC/POS-like image commands used by M02S examples.
 */
export function encodeBinaryImageToPhomemo(
  binary: BinaryImageData,
  options: PhomemoEncodeOptions = {},
): Uint8Array {
  const { width, height, pixels } = binary;
  if (pixels.length !== width * height) {
    throw new Error("binary pixel length does not match width * height");
  }

  const stripeHeight = options.stripeHeight ?? DEFAULT_STRIPE_HEIGHT;
  const feedLines = options.feedLines ?? DEFAULT_FEED_LINES;
  const alignment = options.alignment ?? DEFAULT_ALIGNMENT;
  const concentrationCoefficient =
    options.concentrationCoefficient ?? DEFAULT_CONCENTRATION_COEFFICIENT;
  const concentration = options.concentration ?? DEFAULT_CONCENTRATION;

  if (
    !Number.isInteger(stripeHeight) ||
    stripeHeight <= 0 ||
    stripeHeight > 0xffff
  ) {
    throw new Error("stripeHeight must be a positive integer");
  }

  const bytesPerRow = Math.ceil(width / 8);
  const commands: Uint8Array[] = [
    new Uint8Array([ESC, 0x40, 0x02]),
    new Uint8Array([ESC, 0x40]),
    new Uint8Array([ESC, 0x61, alignment]),
    new Uint8Array([US, 0x11, 0x37, concentrationCoefficient]),
    new Uint8Array([US, 0x11, 0x02, concentration]),
  ];

  for (let startRow = 0; startRow < height; startRow += stripeHeight) {
    const chunkHeight = Math.min(stripeHeight, height - startRow);
    const stripePixels = pixels.slice(
      startRow * width,
      (startRow + chunkHeight) * width,
    );
    const stripeRaster = packBinaryPixels({
      width,
      height: chunkHeight,
      pixels: stripePixels,
    });

    commands.push(buildStripeCommand(stripeRaster, bytesPerRow, chunkHeight));
  }

  commands.push(new Uint8Array([ESC, 0x64, feedLines]));
  commands.push(new Uint8Array([ESC, 0x40, 0x02]));

  return concatUint8Arrays(commands);
}

/**
 * End-to-end helper for ImageData -> monochrome -> Phomemo command bytes.
 */
export function encodeImageDataToPhomemo(
  imageData: ImageDataLike,
  binarizeOptions: BinarizeOptions = {},
  encodeOptions: PhomemoEncodeOptions = {},
): Uint8Array {
  const binary = binarizeImageData(imageData, binarizeOptions);
  return encodeBinaryImageToPhomemo(binary, encodeOptions);
}
