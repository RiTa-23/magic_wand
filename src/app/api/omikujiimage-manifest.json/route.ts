import { readdir } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

/**
 * GET /api/omikujiimage-manifest.json
 * Returns a list of image files (.png, .jpg, .jpeg, .gif) in public/omikujiimage/
 */
export async function GET() {
  try {
    const omikujiimageDir = join(process.cwd(), "public", "omikujiimage");

    const files = await readdir(omikujiimageDir);
    const images = files
      .filter((file) => /\.(png|jpg|jpeg|gif)$/i.test(file))
      .sort();

    return NextResponse.json({
      images,
      count: images.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to read omikujiimage directory:", message);

    return NextResponse.json(
      {
        error: "Failed to read omikujiimage directory",
        details: message,
      },
      { status: 500 },
    );
  }
}
