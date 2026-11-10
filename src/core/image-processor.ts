import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export interface WebpOptions {
  /**
   * Whether WebP conversion is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * WebP compression quality from 1 to 100.
   * @default 80
   */
  quality?: number;

  /**
   * Whether to preserve original image files alongside converted .webp files.
   * When false (default), non-webp images are never copied or retained in the output directory.
   * @default false
   */
  keepOriginal?: boolean;

  /**
   * CPU effort level between 0 (fastest) and 6 (slowest).
   * @default 4
   */
  effort?: number;

  /**
   * Custom file extensions to convert.
   * @default ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp']
   */
  extensions?: string[];
}

export interface ConvertedImage {
  sourcePath: string;
  outputPath: string;
  originalSize: number;
  webpSize: number;
  savedBytes: number;
  savedPercentage: number;
}

export const DEFAULT_RASTER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp'];

/**
 * Recursively scans directory for raster images matching specified extensions.
 */
async function findImagesRecursively(dir: string, extensions: string[]): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findImagesRecursively(fullPath, extensions)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Converts raster images in target directory to WebP format.
 * If destDir is provided, converts images from targetDir into destDir.
 */
export async function convertImagesToWebp(
  targetDir: string,
  options: WebpOptions = {},
  destDir?: string
): Promise<ConvertedImage[]> {
  if (options.enabled === false) {
    return [];
  }

  try {
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const quality = typeof options.quality === 'number' ? Math.max(1, Math.min(100, options.quality)) : 80;
  const effort = typeof options.effort === 'number' ? Math.max(0, Math.min(6, options.effort)) : 4;
  const keepOriginal = options.keepOriginal ?? false;
  const targetExtensions = (options.extensions || DEFAULT_RASTER_EXTENSIONS).map(ext =>
    ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
  );

  const imageFiles = await findImagesRecursively(targetDir, targetExtensions);
  const results: ConvertedImage[] = [];

  for (const imagePath of imageFiles) {
    const parsed = path.parse(imagePath);
    // If file is already .webp, skip conversion
    if (parsed.ext.toLowerCase() === '.webp') {
      continue;
    }

    let outputPath: string;
    if (destDir) {
      const relPath = path.relative(targetDir, imagePath);
      const parsedRel = path.parse(relPath);
      outputPath = path.join(destDir, parsedRel.dir, `${parsedRel.name}.webp`);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
    } else {
      outputPath = path.join(parsed.dir, `${parsed.name}.webp`);
    }

    try {
      const originalStat = await fs.stat(imagePath);
      const originalSize = originalStat.size;

      // Convert using sharp
      await sharp(imagePath)
        .webp({ quality, effort })
        .toFile(outputPath);

      const webpStat = await fs.stat(outputPath);
      const webpSize = webpStat.size;
      const savedBytes = Math.max(0, originalSize - webpSize);
      const savedPercentage = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0;

      // If converting in-place and keepOriginal is false, delete source
      if (!destDir && !keepOriginal && imagePath !== outputPath) {
        await fs.unlink(imagePath);
      }

      results.push({
        sourcePath: imagePath,
        outputPath,
        originalSize,
        webpSize,
        savedBytes,
        savedPercentage
      });
    } catch (err: any) {
      console.warn(`[react-html] Warning: Failed to convert image to WebP "${imagePath}":`, err?.message || err);
    }
  }

  return results;
}
