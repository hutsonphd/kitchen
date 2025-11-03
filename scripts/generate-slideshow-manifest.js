#!/usr/bin/env node

/**
 * Generate manifest.json for slideshow images
 *
 * Scans the public/slideshow directory and creates a manifest file
 * listing all valid image files for the slideshow feature.
 *
 * Usage: node scripts/generate-slideshow-manifest.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SLIDESHOW_DIR = path.join(__dirname, '../public/slideshow');
const MANIFEST_PATH = path.join(SLIDESHOW_DIR, 'manifest.json');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function generateManifest() {
  try {
    // Check if slideshow directory exists
    if (!fs.existsSync(SLIDESHOW_DIR)) {
      console.error(`Error: Slideshow directory not found at ${SLIDESHOW_DIR}`);
      process.exit(1);
    }

    // Read all files in the directory
    const files = fs.readdirSync(SLIDESHOW_DIR);

    // Filter for image files only
    const imageFiles = files
      .filter(isImageFile)
      .sort(); // Sort alphabetically for consistent ordering

    // Create manifest object
    const manifest = {
      version: '1.0',
      generated: new Date().toISOString(),
      images: imageFiles
    };

    // Write manifest to file
    fs.writeFileSync(
      MANIFEST_PATH,
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    console.log('Slideshow manifest generated successfully!');
    console.log(`Location: ${MANIFEST_PATH}`);
    console.log(`Images found: ${imageFiles.length}`);

    if (imageFiles.length > 0) {
      console.log('\nImages:');
      imageFiles.forEach((img, idx) => {
        console.log(`  ${idx + 1}. ${img}`);
      });
    } else {
      console.warn('\nWarning: No image files found in slideshow directory');
    }

  } catch (error) {
    console.error('Error generating manifest:', error.message);
    process.exit(1);
  }
}

// Run the generator
generateManifest();
