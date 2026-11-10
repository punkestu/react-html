import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { convertImagesToWebp } from '../dist/index.js';

describe('Image Processor Unit Tests', () => {
  const testDir = path.resolve(process.cwd(), '.test-image-processor');

  before(async () => {
    await fs.mkdir(testDir, { recursive: true });

    // Generate test PNG
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 100, b: 50, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(testDir, 'test-image.png'));

    // Generate test JPEG in nested subfolder
    const subDir = path.join(testDir, 'nested');
    await fs.mkdir(subDir, { recursive: true });
    await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: { r: 0, g: 120, b: 200 }
      }
    })
      .jpeg()
      .toFile(path.join(subDir, 'nested-image.jpg'));

    // Create a non-image file and an SVG file to ensure they are ignored
    await fs.writeFile(path.join(testDir, 'note.txt'), 'Not an image');
    await fs.writeFile(path.join(testDir, 'icon.svg'), '<svg></svg>');
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('converts png and jpg images recursively into webp and removes originals by default', async () => {
    const results = await convertImagesToWebp(testDir);

    assert.equal(results.length, 2);

    const pngResult = results.find(r => r.sourcePath.endsWith('test-image.png'));
    assert.ok(pngResult, 'PNG conversion result should exist');
    assert.ok(pngResult.outputPath.endsWith('test-image.webp'));
    assert.ok(pngResult.webpSize > 0);

    const webpExists = await fs.stat(pngResult.outputPath).then(() => true).catch(() => false);
    assert.ok(webpExists, 'test-image.webp file should exist on disk');

    // Verify original is removed by default
    const origExists = await fs.stat(pngResult.sourcePath).then(() => true).catch(() => false);
    assert.equal(origExists, false, 'Original PNG should be removed by default');

    // Verify nested JPEG was also converted and original removed
    const jpgResult = results.find(r => r.sourcePath.endsWith('nested-image.jpg'));
    assert.ok(jpgResult, 'Nested JPEG conversion result should exist');
    assert.ok(jpgResult.outputPath.endsWith('nested-image.webp'));

    // Verify SVG and TXT were NOT converted
    const svgWebpExists = await fs.stat(path.join(testDir, 'icon.webp')).then(() => true).catch(() => false);
    assert.equal(svgWebpExists, false, 'SVG should not be converted to webp');
  });

  test('converts images from source dir to dest dir without altering source dir', async () => {
    const srcDir = path.resolve(process.cwd(), '.test-image-src');
    const destDir = path.resolve(process.cwd(), '.test-image-dest');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(destDir, { recursive: true });

    const srcImg = path.join(srcDir, 'source.png');
    await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 4,
        background: { r: 50, g: 150, b: 250, alpha: 1 }
      }
    })
      .png()
      .toFile(srcImg);

    const results = await convertImagesToWebp(srcDir, {}, destDir);
    assert.equal(results.length, 1);

    // Source image in srcDir should remain intact
    const srcExists = await fs.stat(srcImg).then(() => true).catch(() => false);
    assert.ok(srcExists, 'Source image in srcDir should remain untouched');

    // Converted WebP should exist in destDir
    const destWebp = path.join(destDir, 'source.webp');
    const destExists = await fs.stat(destWebp).then(() => true).catch(() => false);
    assert.ok(destExists, 'Converted WebP should exist in destDir');

    await fs.rm(srcDir, { recursive: true, force: true });
    await fs.rm(destDir, { recursive: true, force: true });
  });

  test('preserves original image when keepOriginal is explicitly true', async () => {
    const keepDir = path.resolve(process.cwd(), '.test-image-keep');
    await fs.mkdir(keepDir, { recursive: true });
    const imgPath = path.join(keepDir, 'keep-me.png');
    await sharp({
      create: {
        width: 60,
        height: 60,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 1 }
      }
    })
      .png()
      .toFile(imgPath);

    const results = await convertImagesToWebp(keepDir, { keepOriginal: true });
    assert.equal(results.length, 1);

    const origExists = await fs.stat(imgPath).then(() => true).catch(() => false);
    assert.ok(origExists, 'Original image should still exist when keepOriginal: true');

    const webpExists = await fs.stat(results[0].outputPath).then(() => true).catch(() => false);
    assert.ok(webpExists, 'Converted WebP should exist');

    await fs.rm(keepDir, { recursive: true, force: true });
  });

  test('skips conversion when enabled is false', async () => {
    const disabledDir = path.resolve(process.cwd(), '.test-image-disabled');
    await fs.mkdir(disabledDir, { recursive: true });
    await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(disabledDir, 'skip.png'));

    const results = await convertImagesToWebp(disabledDir, { enabled: false });
    assert.equal(results.length, 0);

    const webpExists = await fs.stat(path.join(disabledDir, 'skip.webp')).then(() => true).catch(() => false);
    assert.equal(webpExists, false, 'WebP file should not be created when enabled is false');

    await fs.rm(disabledDir, { recursive: true, force: true });
  });
});
