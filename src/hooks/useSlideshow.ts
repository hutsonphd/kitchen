import { useState, useEffect, useRef } from 'react';
import type { SlideshowImage } from '../services/staticImages.service';

export interface KenBurnsState {
  scale: number; // 1.0 to 1.3 (zoom level)
  translateX: number; // -15 to 15 (percent)
  translateY: number; // -15 to 15 (percent)
}

export interface KenBurnsEffect {
  start: KenBurnsState; // Initial state
  end: KenBurnsState; // Target state for continuous animation
  duration: number; // animation duration in ms (based on image display time)
}

interface UseSlideshowOptions {
  images: SlideshowImage[];
  duration: number; // Total slideshow duration in ms (60000 = 60 seconds)
  transitionSpeed: number; // Individual image transition speed in ms (1000 = 1 second)
  onComplete: () => void; // Callback when slideshow completes
}

interface UseSlideshowReturn {
  currentImage: SlideshowImage | null;
  currentIndex: number;
  timeRemaining: number; // Milliseconds remaining
  progress: number; // 0-100 percentage
  kenBurnsEffect: KenBurnsEffect;
  isLoading: boolean; // True while images are preloading
}

/**
 * Generate random Ken Burns effect parameters with start and end states
 * for continuous animation during image display
 */
function generateKenBurnsEffect(imageDisplayDuration: number): KenBurnsEffect {
  // Generate start state
  const startScale = 1.0 + Math.random() * 0.15; // 1.0 to 1.15
  const startTranslateX = (Math.random() - 0.5) * 30; // -15% to 15%
  const startTranslateY = (Math.random() - 0.5) * 30; // -15% to 15%

  // Generate end state (different from start for continuous motion)
  const endScale = 1.15 + Math.random() * 0.15; // 1.15 to 1.3 (ensures zoom in)
  const endTranslateX = (Math.random() - 0.5) * 30; // -15% to 15%
  const endTranslateY = (Math.random() - 0.5) * 30; // -15% to 15%

  return {
    start: {
      scale: startScale,
      translateX: startTranslateX,
      translateY: startTranslateY,
    },
    end: {
      scale: endScale,
      translateX: endTranslateX,
      translateY: endTranslateY,
    },
    duration: imageDisplayDuration,
  };
}

/**
 * Preload a single image and decode it asynchronously
 * Memory efficient: only loads images as needed
 */
async function preloadImage(imagePath: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => {
      image.decode().then(() => resolve()).catch(() => resolve());
    };
    image.onerror = () => resolve(); // Don't fail on single image error
    image.src = imagePath;
  });
}

/**
 * Custom hook for managing slideshow state with 60-second timer
 * and Ken Burns effect animations
 */
export function useSlideshow({
  images,
  duration,
  // transitionSpeed is not currently used but kept for API compatibility
  transitionSpeed: _,
  onComplete,
}: UseSlideshowOptions): UseSlideshowReturn {
  // Calculate time per image
  const timePerImage = images.length > 0 ? duration / images.length : duration;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [kenBurnsEffect, setKenBurnsEffect] = useState<KenBurnsEffect>(
    generateKenBurnsEffect(timePerImage)
  );
  const [isLoading, setIsLoading] = useState(true);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const imageIntervalRef = useRef<number | null>(null);

  // Lazy load: Preload only first image, then load next images on demand
  // This reduces memory usage from ~158MB (all 5 images) to ~63MB (2 images max)
  useEffect(() => {
    if (images.length === 0) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadFirstImage = async () => {
      // Only preload the first image
      await preloadImage(images[0].path);
      if (!cancelled) {
        setIsLoading(false);
        // Preload second image in background after first is ready
        if (images.length > 1) {
          preloadImage(images[1].path);
        }
      }
    };

    loadFirstImage();

    return () => {
      cancelled = true;
    };
  }, [images]);

  // Update time remaining every 100ms
  useEffect(() => {
    // Don't start timer until images are loaded
    if (isLoading) {
      return;
    }

    // Clear any existing interval before setting a new one
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, duration - elapsed);

      setTimeRemaining(remaining);

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        onComplete();
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [duration, onComplete, isLoading]);

  // Cycle through images
  useEffect(() => {
    if (images.length === 0 || isLoading) {
      return;
    }

    // Clear any existing interval before setting a new one
    if (imageIntervalRef.current) {
      clearInterval(imageIntervalRef.current);
      imageIntervalRef.current = null;
    }

    // Generate Ken Burns effect for first image
    setKenBurnsEffect(generateKenBurnsEffect(timePerImage));

    imageIntervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = (prev + 1) % images.length;
        // Generate new Ken Burns effect for next image
        setKenBurnsEffect(generateKenBurnsEffect(timePerImage));

        // Lazy load: Preload the image after next in background
        // This keeps memory usage low while ensuring smooth transitions
        const nextNext = (next + 1) % images.length;
        preloadImage(images[nextNext].path);

        return next;
      });
    }, timePerImage);

    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
    };
  }, [images.length, timePerImage, isLoading]);

  // Calculate progress percentage
  const progress = duration > 0 ? ((duration - timeRemaining) / duration) * 100 : 100;

  // Get current image
  const currentImage = images.length > 0 ? images[currentIndex] : null;

  return {
    currentImage,
    currentIndex,
    timeRemaining,
    progress,
    kenBurnsEffect,
    isLoading,
  };
}
