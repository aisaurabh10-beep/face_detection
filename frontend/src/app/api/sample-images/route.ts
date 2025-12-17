import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const sampleImagesDir = join(process.cwd(), "public", "sample-images");
    const files = await readdir(sampleImagesDir);
    
    // Filter for image files
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const imageFiles = files
      .filter((file) => {
        const ext = file.toLowerCase().substring(file.lastIndexOf("."));
        return imageExtensions.includes(ext);
      })
      .map((file) => `/sample-images/${file}`);

    return NextResponse.json({ images: imageFiles });
  } catch (error) {
    // If directory doesn't exist or can't be read, return empty array
    console.error("Failed to read sample-images directory:", error);
    return NextResponse.json({ images: [] });
  }
}

