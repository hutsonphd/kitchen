import { useState, useEffect } from 'react'
import './App.css'
import { CalendarProvider, useCalendar } from './contexts/CalendarContext'
import { Calendar } from './components/Calendar'
import { AdminPanel } from './components/AdminPanel'
import type { ViewMode } from './types'

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

function AppContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('kiosk');
  const { fetchAllEvents } = useCalendar();

  // Auto-refresh calendar events
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('Auto-refreshing calendar data...');
      fetchAllEvents();
    }, REFRESH_INTERVAL);

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

  return (
    <div className="app">
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
