import {
  BinaryImageData,
  BinarizeOptions,
  ImageDataLike,
  binarizeImageData,
  packBinaryPixels,
} from "./imageProcessor";

const FRAME_HEADER_0 = 0x51;
const FRAME_HEADER_1 = 0x78;
const FRAME_TAIL = 0xff;

const CMD_INIT = 0xa0;
const CMD_START_PAGE = 0xa1;
const CMD_IMAGE_DATA = 0xa2;
const CMD_END_PAGE = 0xaf;

const DEFAULT_DATA_CHUNK_SIZE = 240;

export interface PhomemoEncodeOptions {
  dataChunkSize?: number;
}

function toUint16LE(value: number): [number, number] {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`value out of range for uint16: ${value}`);
  }
  return [value & 0xff, (value >> 8) & 0xff];
}

function calculateChecksum(command: number, payload: Uint8Array): number {
  const [lenL, lenH] = toUint16LE(payload.length);
  let sum = (command + lenL + lenH) & 0xff;
  for (let i = 0; i < payload.length; i++) {
    sum = (sum + payload[i]) & 0xff;
  }
  return sum;
}

function buildFrame(command: number, payload: Uint8Array = new Uint8Array()): Uint8Array {
  const [lenL, lenH] = toUint16LE(payload.length);
  const checksum = calculateChecksum(command, payload);
  const frame = new Uint8Array(7 + payload.length);

  frame[0] = FRAME_HEADER_0;
  frame[1] = FRAME_HEADER_1;
  frame[2] = command;
  frame[3] = lenL;
  frame[4] = lenH;
  frame.set(payload, 5);
  frame[5 + payload.length] = checksum;
  frame[6 + payload.length] = FRAME_TAIL;

  return frame;
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

/**
 * Encode packed monochrome raster data into a framed command stream.
 */
export function encodeBinaryImageToPhomemo(
  binary: BinaryImageData,
  options: PhomemoEncodeOptions = {},
): Uint8Array {
  const { width, height, pixels } = binary;
  if (pixels.length !== width * height) {
    throw new Error("binary pixel length does not match width * height");
  }

  const packed = packBinaryPixels(binary);
  const bytesPerRow = Math.ceil(width / 8);
  const dataChunkSize = options.dataChunkSize ?? DEFAULT_DATA_CHUNK_SIZE;

  if (!Number.isInteger(dataChunkSize) || dataChunkSize <= 0) {
    throw new Error("dataChunkSize must be a positive integer");
  }

  const [widthL, widthH] = toUint16LE(width);
  const [heightL, heightH] = toUint16LE(height);
  const [rowBytesL, rowBytesH] = toUint16LE(bytesPerRow);

  const pageHeaderPayload = new Uint8Array([
    widthL,
    widthH,
    heightL,
    heightH,
    rowBytesL,
    rowBytesH,
  ]);

  const frames: Uint8Array[] = [
    buildFrame(CMD_INIT),
    buildFrame(CMD_START_PAGE, pageHeaderPayload),
  ];

  for (let offset = 0; offset < packed.length; offset += dataChunkSize) {
    const chunk = packed.slice(offset, Math.min(offset + dataChunkSize, packed.length));
    frames.push(buildFrame(CMD_IMAGE_DATA, chunk));
  }

  frames.push(buildFrame(CMD_END_PAGE));

  return concatUint8Arrays(frames);
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
