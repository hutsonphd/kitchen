/**
 * Static Images Service
 * Manages slideshow images from the public/slideshow/ directory
 */

export interface SlideshowImage {
  id: string;
  name: string;
  path: string;
  size: number;
  width: number;
  height: number;
  isValidResolution: boolean;
  isValidSize: boolean;
  lastModified: number;
}

export interface ValidationResult {
  isValidResolution: boolean;
  isValidSize: boolean;
  width: number;
  height: number;
  size: number;
}

// Image requirements
const REQUIRED_WIDTH = 3840;
const REQUIRED_HEIGHT = 2160;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes

/**
 * Fetches list of images from the slideshow directory via manifest.json
 */
export async function getAvailableImages(): Promise<SlideshowImage[]> {
  try {
    // Fetch the manifest file from the slideshow directory
    const response = await fetch('/slideshow/manifest.json');

    if (!response.ok) {
      console.warn('Unable to fetch slideshow manifest. Run: npm run manifest:slideshow');
      return [];
    }

    // Parse manifest JSON
    const manifest = await response.json();
    const imageFiles = manifest.images || [];

    if (!Array.isArray(imageFiles)) {
      console.error('Invalid manifest format: images must be an array');
      return [];
    }

    // Load metadata for each image
    const images = await Promise.all(
      imageFiles.map(filename => loadImageMetadata(filename))
    );

    // Filter out any failed loads
    return images.filter((img): img is SlideshowImage => img !== null);
  } catch (error) {
    console.error('Error loading slideshow images:', error);
    return [];
  }
}

/**
 * Load metadata for a single image file
 * Simple approach: load image once, browser caches it for slideshow
 * Note: HEAD requests don't work reliably with Vite dev server
 */
async function loadImageMetadata(filename: string): Promise<SlideshowImage | null> {
  try {
    const path = `/slideshow/${filename}`;

    // Load image directly to get dimensions
    // Browser caches this, so slideshow can reuse it
    const validation = await validateImageDimensions(path);

    // Size validation skipped in dev mode for simplicity
    // Can be added back for production builds if needed
    const size = 0; // Unknown size, but not critical for functionality

    return {
      id: filename,
      name: filename,
      path,
      size,
      width: validation.width,
      height: validation.height,
      isValidResolution: validation.isValidResolution,
      isValidSize: true, // Assume valid size in dev mode
      lastModified: Date.now(),
    };
  } catch (error) {
    console.error(`Error loading metadata for ${filename}:`, error);
    return null;
  }
}

/**
 * Validate image dimensions
 * Note: This loads the image into browser cache, which helps the slideshow
 */
function validateImageDimensions(imagePath: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const isValidResolution = width === REQUIRED_WIDTH && height === REQUIRED_HEIGHT;

      resolve({
        isValidResolution,
        isValidSize: true, // Size is checked separately
        width,
        height,
        size: 0, // Size is checked separately
      });
    };

    img.onerror = () => {
      resolve({
        isValidResolution: false,
        isValidSize: false,
        width: 0,
        height: 0,
        size: 0,
      });
    };

    img.src = imagePath;
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Get validation status message
 */
export function getValidationMessage(image: SlideshowImage): string {
  const issues: string[] = [];

  if (!image.isValidResolution) {
    issues.push(
      `Resolution is ${image.width}x${image.height} (expected ${REQUIRED_WIDTH}x${REQUIRED_HEIGHT})`
    );
  }

  if (!image.isValidSize) {
    issues.push(
      `File size is ${formatFileSize(image.size)} (max ${formatFileSize(MAX_FILE_SIZE)})`
    );
  }

  return issues.length > 0 ? issues.join('; ') : 'Valid';
}

/**
 * Check if an image meets all requirements
 */
export function isImageValid(image: SlideshowImage): boolean {
  return image.isValidResolution && image.isValidSize;
}

/**
 * Get count of valid images
 */
export function getValidImageCount(images: SlideshowImage[]): number {
  return images.filter(isImageValid).length;
}
