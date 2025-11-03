#!/usr/bin/env node

/**
 * Optimize Slideshow Images
 *
 * Processes all images in public/slideshow/ to meet these requirements:
 * - Resolution: 3840x2160 (4K UHD, 16:9 aspect ratio)
 * - Maximum file size: 2MB
 * - Format: JPEG (optimized for web)
 *
 * Processing:
 * - Center crops images to 16:9 aspect ratio
 * - Resizes to exactly 3840x2160
 * - Optimizes quality to stay under 2MB
 * - Backs up originals to public/slideshow/originals/
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const TARGET_WIDTH = 3840;
const TARGET_HEIGHT = 2160;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
const SLIDESHOW_DIR = path.join(__dirname, '../public/slideshow');
const ORIGINALS_DIR = path.join(SLIDESHOW_DIR, 'originals');
const TARGET_ASPECT_RATIO = TARGET_WIDTH / TARGET_HEIGHT;

// Image extensions to process
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/**
 * Ensure the originals directory exists
 */
function ensureOriginalsDir() {
  if (!fs.existsSync(ORIGINALS_DIR)) {
    fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
    console.log('Created originals directory:', ORIGINALS_DIR);
  }
}

/**
 * Get all image files in the slideshow directory
 */
function getImageFiles() {
  if (!fs.existsSync(SLIDESHOW_DIR)) {
    console.error('Slideshow directory not found:', SLIDESHOW_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(SLIDESHOW_DIR);
  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext) && file !== '.gitkeep';
  });
}

/**
 * Calculate center crop dimensions
 */
function calculateCenterCrop(width, height) {
  const sourceAspect = width / height;

  if (Math.abs(sourceAspect - TARGET_ASPECT_RATIO) < 0.01) {
    // Already correct aspect ratio
    return { width, height, left: 0, top: 0 };
  }

  let cropWidth, cropHeight, left, top;

  if (sourceAspect > TARGET_ASPECT_RATIO) {
    // Image is wider than target - crop sides
    cropHeight = height;
    cropWidth = Math.round(height * TARGET_ASPECT_RATIO);
    left = Math.round((width - cropWidth) / 2);
    top = 0;
  } else {
    // Image is taller than target - crop top/bottom
    cropWidth = width;
    cropHeight = Math.round(width / TARGET_ASPECT_RATIO);
    left = 0;
    top = Math.round((height - cropHeight) / 2);
  }

  return { width: cropWidth, height: cropHeight, left, top };
}

/**
 * Process a single image
 */
async function processImage(filename) {
  const inputPath = path.join(SLIDESHOW_DIR, filename);
  const outputPath = inputPath;
  const backupPath = path.join(ORIGINALS_DIR, filename);

  console.log(`\nProcessing: ${filename}`);

  try {
    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    const { width, height, format, size } = metadata;

    console.log(`  Original: ${width}x${height}, ${(size / 1024).toFixed(1)}KB, format: ${format}`);

    // Check if already compliant
    if (
      width === TARGET_WIDTH &&
      height === TARGET_HEIGHT &&
      size <= MAX_FILE_SIZE
    ) {
      console.log(`  ✓ Already compliant - skipping`);
      return { filename, status: 'skipped', reason: 'already compliant' };
    }

    // Backup original
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(inputPath, backupPath);
      console.log(`  → Backed up to originals/`);
    }

    // Calculate center crop
    const crop = calculateCenterCrop(width, height);
    console.log(`  → Center crop: ${crop.width}x${crop.height} at (${crop.left}, ${crop.top})`);

    // Start with high quality
    let quality = 90;
    let processedBuffer;
    let outputSize;

    // Process image with progressive quality reduction
    while (quality >= 50) {
      processedBuffer = await sharp(inputPath)
        .extract({
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height,
        })
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality, progressive: true })
        .toBuffer();

      outputSize = processedBuffer.length;

      if (outputSize <= MAX_FILE_SIZE) {
        break;
      }

      quality -= 5;
    }

    // Write processed image
    fs.writeFileSync(outputPath, processedBuffer);

    console.log(`  ✓ Processed: ${TARGET_WIDTH}x${TARGET_HEIGHT}, ${(outputSize / 1024).toFixed(1)}KB, quality: ${quality}`);

    if (outputSize > MAX_FILE_SIZE) {
      console.log(`  ⚠ Warning: Could not reduce size below 2MB (${(outputSize / 1024 / 1024).toFixed(2)}MB)`);
      return {
        filename,
        status: 'warning',
        reason: 'size still exceeds 2MB',
        size: outputSize,
        quality,
      };
    }

    return {
      filename,
      status: 'success',
      originalSize: size,
      newSize: outputSize,
      quality,
    };
  } catch (error) {
    console.error(`  ✗ Error:`, error.message);
    return { filename, status: 'error', error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Slideshow Image Optimizer');
  console.log('='.repeat(60));
  console.log(`Target: ${TARGET_WIDTH}x${TARGET_HEIGHT} @ max ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`);
  console.log(`Directory: ${SLIDESHOW_DIR}`);
  console.log('='.repeat(60));

  // Ensure originals directory exists
  ensureOriginalsDir();

  // Get all image files
  const imageFiles = getImageFiles();

  if (imageFiles.length === 0) {
    console.log('\nNo images found in slideshow directory.');
    return;
  }

  console.log(`\nFound ${imageFiles.length} image(s) to process\n`);

  // Process each image
  const results = [];
  for (const file of imageFiles) {
    const result = await processImage(file);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.status === 'success');
  const skipped = results.filter(r => r.status === 'skipped');
  const warnings = results.filter(r => r.status === 'warning');
  const errors = results.filter(r => r.status === 'error');

  console.log(`Total images: ${results.length}`);
  console.log(`✓ Successfully processed: ${successful.length}`);
  console.log(`→ Skipped (already compliant): ${skipped.length}`);
  if (warnings.length > 0) {
    console.log(`⚠ Warnings: ${warnings.length}`);
  }
  if (errors.length > 0) {
    console.log(`✗ Errors: ${errors.length}`);
  }

  if (successful.length > 0) {
    const totalSaved = successful.reduce((sum, r) => sum + (r.originalSize - r.newSize), 0);
    console.log(`\nTotal space saved: ${(totalSaved / 1024 / 1024).toFixed(2)}MB`);
  }

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    warnings.forEach(w => {
      console.log(`  - ${w.filename}: ${w.reason}`);
    });
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => {
      console.log(`  - ${e.filename}: ${e.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done! Original images backed up to public/slideshow/originals/');
  console.log('='.repeat(60));
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
