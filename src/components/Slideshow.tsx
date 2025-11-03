import React, { useEffect, useState } from 'react';
import { useCalendar } from '../contexts/CalendarContext';
import { useSlideshow } from '../hooks/useSlideshow';
import type { KenBurnsState } from '../hooks/useSlideshow';

export const Slideshow: React.FC = React.memo(() => {
  const {
    slideshowImages,
    uiSettings,
    stopSlideshow
  } = useCalendar();

  const {
    currentImage,
    currentIndex,
    timeRemaining,
    progress,
    kenBurnsEffect,
    isLoading
  } = useSlideshow({
    images: slideshowImages,
    duration: uiSettings.slideshowDuration,
    transitionSpeed: uiSettings.slideshowTransitionSpeed,
    onComplete: stopSlideshow,
  });

  // Track current transform state for smooth transition
  const [currentTransform, setCurrentTransform] = useState<KenBurnsState>(kenBurnsEffect.start);

  // Format time remaining as MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle Ken Burns effect transition from start to end state
  useEffect(() => {
    // Skip animation during loading
    if (isLoading || !currentImage) {
      return;
    }

    // Apply start state immediately when image changes
    setCurrentTransform(kenBurnsEffect.start);

    // Use requestAnimationFrame for smooth transition start
    // Double RAF ensures the start state is painted before transition begins
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCurrentTransform(kenBurnsEffect.end);
      });
    });
  }, [currentIndex, kenBurnsEffect, isLoading, currentImage]);

  // Prevent scrolling when slideshow is active
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Show loading indicator while images are preloading
  if (isLoading) {
    return (
      <div className="slideshow-overlay">
        <div className="slideshow-loading">
          <div className="slideshow-loading-text">Loading images...</div>
        </div>
      </div>
    );
  }

  if (!currentImage) {
    return null;
  }

  return (
    <div className="slideshow-overlay">
      <div
        className="slideshow-image-container"
        style={{
          transform: `scale(${currentTransform.scale}) translate(${currentTransform.translateX}%, ${currentTransform.translateY}%)`,
          transition: `transform ${kenBurnsEffect.duration}ms ease-in-out`,
        }}
      >
        <img
          src={currentImage.path}
          alt={currentImage.name}
          className="slideshow-image"
        />
      </div>

      <div className="slideshow-info">
        <div className="slideshow-counter">
          {currentIndex + 1} / {slideshowImages.length}
        </div>
        <div className="slideshow-timer">
          {formatTime(timeRemaining)}
        </div>
        <div className="slideshow-progress-bar">
          <div
            className="slideshow-progress-fill"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      </div>
    </div>
  );
});
