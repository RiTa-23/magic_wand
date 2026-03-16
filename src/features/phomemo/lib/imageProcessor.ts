export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface RenderCanvasOptions {
  width: number;
  height: number;
  text?: string;
  image?: CanvasImageSource;
  font?: string;
  textColor?: string;
  backgroundColor?: string;
  padding?: number;
}

export interface BinarizeOptions {
  threshold?: number;
  invert?: boolean;
}

export interface BinaryImageData {
  width: number;
  height: number;
  pixels: Uint8Array;
}

/**
 * Draw text/image content onto an off-screen canvas and returns ImageData.
 * Browser-only utility (requires document + Canvas API).
 */
export function renderCanvasImage(options: RenderCanvasOptions): ImageData {
  if (typeof document === "undefined") {
    throw new Error("renderCanvasImage can only run in a browser environment");
  }

  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create 2D canvas context");
  }

  const {
    backgroundColor = "#ffffff",
    textColor = "#000000",
    font = "bold 32px sans-serif",
    padding = 16,
    text,
    image,
  } = options;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (image) {
    const drawableWidth = Math.max(1, canvas.width - padding * 2);
    const drawableHeight = Math.max(1, canvas.height - padding * 2);
    ctx.drawImage(image, padding, padding, drawableWidth, drawableHeight);
  }

  if (text) {
    ctx.fillStyle = textColor;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines = text.split("\n");
    const lineHeight = Math.max(20, Math.floor(canvas.height / (lines.length + 2)));
    const startY = Math.floor((canvas.height - lineHeight * (lines.length - 1)) / 2);

    lines.forEach((line, index) => {
      ctx.fillText(line, Math.floor(canvas.width / 2), startY + lineHeight * index);
    });
  }

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Convert RGBA image data to a 1-bit monochrome pixel map.
 * pixels: 1 = black(dot), 0 = white(no dot)
 */
export function binarizeImageData(
  imageData: ImageDataLike,
  options: BinarizeOptions = {},
): BinaryImageData {
  const { width, height, data } = imageData;
  const { threshold = 160, invert = false } = options;

  if (width <= 0 || height <= 0) {
    throw new Error("width and height must be positive");
  }

  if (data.length !== width * height * 4) {
    throw new Error("imageData length does not match width * height * 4");
  }

  const pixels = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3] / 255;

    // Blend with white background before thresholding transparent pixels.
    const blendedR = 255 * (1 - a) + r * a;
    const blendedG = 255 * (1 - a) + g * a;
    const blendedB = 255 * (1 - a) + b * a;

    const luminance = 0.299 * blendedR + 0.587 * blendedG + 0.114 * blendedB;
    const black = invert ? luminance > threshold : luminance < threshold;
    pixels[i] = black ? 1 : 0;
  }

  return {
    width,
    height,
    pixels,
  };
}

/**
 * Pack 1-bit pixels into bytes (MSB first), row by row.
 */
export function packBinaryPixels(binary: BinaryImageData): Uint8Array {
  const { width, height, pixels } = binary;
  const bytesPerRow = Math.ceil(width / 8);
  const packed = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = pixels[y * width + x];
      if (pixel !== 1) {
        continue;
      }

      const byteIndex = y * bytesPerRow + (x >> 3);
      const bitIndex = 7 - (x & 0b111);
      packed[byteIndex] |= 1 << bitIndex;
    }
  }

  return packed;
}
