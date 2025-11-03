import React, { useEffect } from 'react';
import { useCalendar } from '../contexts/CalendarContext';
import {
  getValidationMessage,
  isImageValid,
  formatFileSize,
  getValidImageCount,
} from '../services/staticImages.service';

export const SlideshowAdmin: React.FC = () => {
  const {
    uiSettings,
    updateUISettings,
    slideshowImages,
    startSlideshow,
    refreshSlideshowImages,
  } = useCalendar();

  // Load images on mount only (not when refreshSlideshowImages changes)
  // Empty dependency array prevents infinite loop
  useEffect(() => {
    refreshSlideshowImages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleSlideshow = () => {
    updateUISettings({
      ...uiSettings,
      slideshowEnabled: !uiSettings.slideshowEnabled,
    });
  };

  const handleDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const seconds = parseInt(event.target.value, 10);
    updateUISettings({
      ...uiSettings,
      slideshowDuration: seconds * 1000,
    });
  };

  const handleTransitionSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const ms = parseInt(event.target.value, 10);
    updateUISettings({
      ...uiSettings,
      slideshowTransitionSpeed: ms,
    });
  };

  const handleIdleDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const seconds = parseInt(event.target.value, 10);
    updateUISettings({
      ...uiSettings,
      calendarIdleDuration: seconds * 1000,
    });
  };

  const handleTestSlideshow = () => {
    const validImages = slideshowImages.filter(isImageValid);
    if (validImages.length > 0) {
      startSlideshow();
    }
  };

  const handleRefresh = () => {
    refreshSlideshowImages();
  };

  const validImageCount = getValidImageCount(slideshowImages);

  return (
    <div className="slideshow-admin">
      <h3>Screensaver Settings</h3>

      <div className="slideshow-setting">
        <label className="slideshow-toggle">
          <input
            type="checkbox"
            checked={uiSettings.slideshowEnabled}
            onChange={handleToggleSlideshow}
          />
          <span>Enable Screensaver</span>
        </label>
      </div>

      <div className="slideshow-setting">
        <label>
          Duration (seconds)
          <input
            type="range"
            min="10"
            max="300"
            step="10"
            value={uiSettings.slideshowDuration / 1000}
            onChange={handleDurationChange}
          />
          <span className="slideshow-setting-value">
            {uiSettings.slideshowDuration / 1000}s
          </span>
        </label>
      </div>

      <div className="slideshow-setting">
        <label>
          Transition Speed (ms)
          <input
            type="range"
            min="500"
            max="3000"
            step="100"
            value={uiSettings.slideshowTransitionSpeed}
            onChange={handleTransitionSpeedChange}
          />
          <span className="slideshow-setting-value">
            {uiSettings.slideshowTransitionSpeed}ms
          </span>
        </label>
      </div>

      <div className="slideshow-setting">
        <label>
          Calendar Idle Time (seconds)
          <input
            type="range"
            min="10"
            max="600"
            step="10"
            value={uiSettings.calendarIdleDuration / 1000}
            onChange={handleIdleDurationChange}
          />
          <span className="slideshow-setting-value">
            {uiSettings.calendarIdleDuration / 1000}s
          </span>
        </label>
        <small style={{ display: 'block', marginTop: '0.25rem', opacity: 0.7 }}>
          Time to wait on calendar before starting screensaver
        </small>
      </div>

      <div className="slideshow-upload-section">
        <h4>
          Images ({validImageCount} valid / {slideshowImages.length} total)
        </h4>

        <div className="slideshow-instructions">
          <p>
            <strong>Image Requirements:</strong>
          </p>
          <ul>
            <li>Resolution: 3840×2160 (4K UHD)</li>
            <li>Maximum file size: 2 MB</li>
            <li>Supported formats: JPG, PNG, WebP, GIF</li>
          </ul>
          <p>
            <strong>To add images:</strong> Place image files in the{' '}
            <code>public/slideshow/</code> directory and click Refresh.
          </p>
        </div>

        <div className="slideshow-upload-controls">
          <button
            className="slideshow-refresh-button"
            onClick={handleRefresh}
          >
            Refresh Images
          </button>

          {validImageCount > 0 && (
            <button
              className="slideshow-test-button"
              onClick={handleTestSlideshow}
              disabled={!uiSettings.slideshowEnabled}
            >
              Test Slideshow
            </button>
          )}
        </div>
      </div>

      {slideshowImages.length > 0 && (
        <div className="slideshow-image-grid">
          {slideshowImages.map((image) => {
            const isValid = isImageValid(image);
            const validationMessage = getValidationMessage(image);

            return (
              <div
                key={image.id}
                className={`slideshow-image-item ${!isValid ? 'slideshow-image-invalid' : ''}`}
              >
                <img
                  src={image.path}
                  alt={image.name}
                  className="slideshow-thumbnail"
                />
                <div className="slideshow-image-info">
                  <span className="slideshow-image-name" title={image.name}>
                    {image.name}
                  </span>
                  <span className="slideshow-image-resolution">
                    {image.width}×{image.height}
                  </span>
                  <span className="slideshow-image-size">
                    {formatFileSize(image.size)}
                  </span>
                  {!isValid && (
                    <span className="slideshow-image-validation" title={validationMessage}>
                      ⚠ {validationMessage}
                    </span>
                  )}
                  {isValid && (
                    <span className="slideshow-image-validation-success">
                      ✓ Valid
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {slideshowImages.length === 0 && (
        <div className="slideshow-empty-state">
          No images found in <code>public/slideshow/</code> directory.
          <br />
          Add images to the directory and click Refresh.
        </div>
      )}
    </div>
  );
};
