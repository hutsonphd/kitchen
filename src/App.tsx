import { useState, useEffect } from 'react'
import './App.css'
import { CalendarProvider, useCalendar } from './contexts/CalendarContext'
import { Calendar } from './components/Calendar'
import { AdminPanel } from './components/AdminPanel'
import { Slideshow } from './components/Slideshow'
import type { ViewMode } from './types'

const SYNC_CHECK_INTERVAL = 300 * 1000; // Check every 5 minutes

function AppContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('kiosk');
  const {
    fetchAllEvents,
    slideshowActive,
    startSlideshow,
    uiSettings,
    slideshowImages
  } = useCalendar();

  // Smart sync: Check every 5 minutes, but only sync if cache is stale
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('Checking if sync needed...');
      fetchAllEvents(false); // Will only sync if cache is stale
    }, SYNC_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchAllEvents]);

  // Keyboard shortcut to toggle admin mode (Ctrl+Shift+A)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setViewMode(prev => prev === 'kiosk' ? 'admin' : 'kiosk');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Independent kiosk slideshow cycle
  // When in kiosk mode and slideshow is not active:
  //   - Wait calendarIdleDuration (default: 300s)
  //   - Start slideshow
  // Slideshow automatically stops after slideshowDuration (default: 60s) via useSlideshow hook
  // Then cycle repeats
  useEffect(() => {
    // Only run timer when:
    // - In kiosk mode
    // - Slideshow is enabled
    // - Has images to show
    // - Slideshow is not currently active
    if (
      viewMode !== 'kiosk' ||
      !uiSettings.slideshowEnabled ||
      slideshowImages.length === 0 ||
      slideshowActive
    ) {
      return;
    }

    // Start timer to trigger slideshow after idle duration
    const timerId = setTimeout(() => {
      console.log('Calendar idle timer expired - starting slideshow');
      startSlideshow();
    }, uiSettings.calendarIdleDuration);

    return () => clearTimeout(timerId);
  }, [
    viewMode,
    slideshowActive,
    uiSettings.slideshowEnabled,
    uiSettings.calendarIdleDuration,
    slideshowImages.length,
    startSlideshow
  ]);

  return (
    <div className="app">
      {slideshowActive && <Slideshow />}
      {viewMode === 'kiosk' ? (
        <Calendar onAdminClick={() => setViewMode('admin')} />
      ) : (
        <AdminPanel onClose={() => setViewMode('kiosk')} />
      )}
    </div>
  );
}

function App() {
  return (
    <CalendarProvider>
      <AppContent />
    </CalendarProvider>
  );
}

export default App
