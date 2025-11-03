/**
 * API routes for calendar events management
 */

import express from 'express';
import {
  getEvents,
  getEventById,
  saveEvents,
  deleteEvent,
  deleteEventsBySource,
  getEventCount
} from '../db/events.js';

const router = express.Router();

/**
 * GET /api/events
 * Get calendar events with optional filtering
 *
 * Query parameters:
 * - sourceId: Filter by calendar source ID
 * - calendarId: Filter by calendar ID
 * - start: ISO date string for range start
 * - end: ISO date string for range end
 */
router.get('/', (req, res) => {
  try {
    const { sourceId, calendarId, start, end } = req.query;
    console.log('[API Events] GET / - Query params:', { sourceId, calendarId, start, end });

    const events = getEvents({
      sourceId,
      calendarId,
      start,
      end
    });

    console.log('[API Events] GET / - Returning', events.length, 'events');
    res.json(events);
  } catch (error) {
    console.error('[API Events] GET / - Failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve events',
      details: error.message
    });
  }
});

/**
 * GET /api/events/count
 * Get event count, optionally filtered by source
 */
router.get('/count', (req, res) => {
  try {
    const { sourceId } = req.query;
    const count = getEventCount(sourceId);

    res.json({ count });
  } catch (error) {
    console.error('[API] Failed to get event count:', error);
    res.status(500).json({
      error: 'Failed to get event count',
      details: error.message
    });
  }
});

/**
 * GET /api/events/:id
 * Get specific event by ID
 */
router.get('/:id', (req, res) => {
  try {
    const event = getEventById(req.params.id);

    if (!event) {
      return res.status(404).json({
        error: 'Event not found',
        details: `No event found with ID: ${req.params.id}`
      });
    }

    res.json(event);
  } catch (error) {
    console.error('[API] Failed to get event:', error);
    res.status(500).json({
      error: 'Failed to retrieve event',
      details: error.message
    });
  }
});

/**
 * POST /api/events
 * Save events (batch insert/update)
 */
router.post('/', (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'events must be an array'
      });
    }

    const count = saveEvents(events);

    res.status(201).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('[API] Failed to save events:', error);
    res.status(500).json({
      error: 'Failed to save events',
      details: error.message
    });
  }
});

/**
 * DELETE /api/events/:id
 * Delete specific event
 */
router.delete('/:id', (req, res) => {
  try {
    const existingEvent = getEventById(req.params.id);

    if (!existingEvent) {
      return res.status(404).json({
        error: 'Event not found',
        details: `No event found with ID: ${req.params.id}`
      });
    }

    deleteEvent(req.params.id);

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('[API] Failed to delete event:', error);
    res.status(500).json({
      error: 'Failed to delete event',
      details: error.message
    });
  }
});

/**
 * DELETE /api/events/source/:sourceId
 * Delete all events for a calendar source
 */
router.delete('/source/:sourceId', (req, res) => {
  try {
    const count = deleteEventsBySource(req.params.sourceId);

    res.json({
      success: true,
      message: 'Events deleted successfully',
      count
    });
  } catch (error) {
    console.error('[API] Failed to delete events by source:', error);
    res.status(500).json({
      error: 'Failed to delete events',
      details: error.message
    });
  }
});

export default router;
