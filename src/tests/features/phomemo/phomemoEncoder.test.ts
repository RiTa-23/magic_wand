import { describe, it, expect } from "vitest";
import {
  binarizeImageData,
  packBinaryPixels,
} from "@/features/phomemo/lib/imageProcessor";
import {
  encodeBinaryImageToPhomemo,
  encodeImageDataToPhomemo,
} from "@/features/phomemo/lib/phomemoEncoder";

describe("Phomemo Image Processor", () => {
  it("converts RGBA pixels to binary black/white pixels", () => {
    const imageData = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        255,
        255,
        255,
        255, // white
        0,
        0,
        0,
        255, // black
      ]),
    };

    const binary = binarizeImageData(imageData, { threshold: 128 });
    expect(Array.from(binary.pixels)).toEqual([0, 1]);
  });

  it("packs binary pixels into MSB-first bytes", () => {
    const packed = packBinaryPixels({
      width: 10,
      height: 1,
      pixels: new Uint8Array([
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
      ]),
    });

    expect(packed.length).toBe(2);
    expect(packed[0]).toBe(0b10000000);
    expect(packed[1]).toBe(0b10000000);
  });
});

describe("Phomemo Encoder", () => {
  it("encodes binary image into framed Uint8Array command stream", () => {
    const binary = {
      width: 8,
      height: 1,
      pixels: new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]),
    };

    const encoded = encodeBinaryImageToPhomemo(binary, { dataChunkSize: 16 });
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.length).toBeGreaterThan(0);

    // First frame: header + CMD_INIT + payload length 0 + checksum + tail
    expect(Array.from(encoded.slice(0, 7))).toEqual([0x51, 0x78, 0xa0, 0x00, 0x00, 0xa0, 0xff]);

    // Ensure image data frame command is present in the stream.
    expect(Array.from(encoded)).toContain(0xa2);
  });

  it("supports end-to-end conversion from image data to command bytes", () => {
    const imageData = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([
        // row 0: black, white, black, white
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        // row 1: white, black, white, black
        255,
        255,
        255,
        255,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        0,
        0,
        0,
        255,
      ]),
    };

    const encoded = encodeImageDataToPhomemo(imageData, { threshold: 128 });
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.length).toBeGreaterThan(10);
  });
});
