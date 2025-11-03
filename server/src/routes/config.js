/**
 * API routes for calendar configuration management
 */

import express from 'express';
import {
  getAllSources,
  getSourceById,
  createSource,
  updateSource,
  deleteSource
} from '../db/calendar-sources.js';

const router = express.Router();

/**
 * GET /api/config/sources
 * Get all calendar sources
 */
router.get('/sources', (req, res) => {
  try {
    const sources = getAllSources();
    res.json(sources);
  } catch (error) {
    console.error('[API] Failed to get sources:', error);
    res.status(500).json({
      error: 'Failed to retrieve calendar sources',
      details: error.message
    });
  }
});

/**
 * GET /api/config/sources/:id
 * Get specific calendar source by ID
 */
router.get('/sources/:id', (req, res) => {
  try {
    const source = getSourceById(req.params.id);

    if (!source) {
      return res.status(404).json({
        error: 'Calendar source not found',
        details: `No source found with ID: ${req.params.id}`
      });
    }

    res.json(source);
  } catch (error) {
    console.error('[API] Failed to get source:', error);
    res.status(500).json({
      error: 'Failed to retrieve calendar source',
      details: error.message
    });
  }
});

/**
 * POST /api/config/sources
 * Create new calendar source
 */
router.post('/sources', (req, res) => {
  try {
    const { name, url, serverUrl, username, password, calendars, sourceType, requiresAuth, isPublic, enabled } = req.body;
    console.log('[API Config] POST /sources - Creating source:', name);

    // Validation - accept either url or serverUrl
    const actualUrl = url || serverUrl;

    if (!name || !actualUrl || !username) {
      console.error('[API Config] POST /sources - Missing required fields');
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'name, url (or serverUrl), and username are required'
      });
    }

    // Validate calendars array if provided
    if (calendars && (!Array.isArray(calendars) || calendars.length === 0)) {
      console.error('[API Config] POST /sources - Invalid calendars array');
      return res.status(400).json({
        error: 'Invalid calendars',
        details: 'calendars must be a non-empty array'
      });
    }

    console.log('[API Config] POST /sources - Creating with', calendars?.length || 0, 'calendars');
    const source = createSource({
      name,
      url: actualUrl,
      username,
      password: password || '',
      calendars: calendars || [],
      sourceType: sourceType || 'caldav',
      requiresAuth: requiresAuth !== false,
      isPublic: isPublic || false,
      enabled: enabled !== false
    });

    console.log('[API Config] POST /sources - Source created successfully:', source.id);
    res.status(201).json(source);
  } catch (error) {
    console.error('[API Config] POST /sources - Failed:', error);
    res.status(500).json({
      error: 'Failed to create calendar source',
      details: error.message
    });
  }
});

/**
 * PUT /api/config/sources/:id
 * Update calendar source
 */
router.put('/sources/:id', (req, res) => {
  try {
    const existingSource = getSourceById(req.params.id);

    if (!existingSource) {
      return res.status(404).json({
        error: 'Calendar source not found',
        details: `No source found with ID: ${req.params.id}`
      });
    }

    const source = updateSource(req.params.id, req.body);
    res.json(source);
  } catch (error) {
    console.error('[API] Failed to update source:', error);
    res.status(500).json({
      error: 'Failed to update calendar source',
      details: error.message
    });
  }
});

/**
 * DELETE /api/config/sources/:id
 * Delete calendar source (soft delete)
 */
router.delete('/sources/:id', (req, res) => {
  try {
    const existingSource = getSourceById(req.params.id);

    if (!existingSource) {
      return res.status(404).json({
        error: 'Calendar source not found',
        details: `No source found with ID: ${req.params.id}`
      });
    }

    deleteSource(req.params.id);

    res.json({
      success: true,
      message: 'Calendar source deleted successfully'
    });
  } catch (error) {
    console.error('[API] Failed to delete source:', error);
    res.status(500).json({
      error: 'Failed to delete calendar source',
      details: error.message
    });
  }
});

/**
 * POST /api/config/sources/batch
 * Batch create/update calendar sources (for migration)
 */
router.post('/sources/batch', (req, res) => {
  try {
    const { sources } = req.body;

    if (!Array.isArray(sources)) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'sources must be an array'
      });
    }

    const results = sources.map(sourceData => {
      try {
        // Check if source already exists
        const existing = sourceData.id ? getSourceById(sourceData.id) : null;

        if (existing) {
          return updateSource(sourceData.id, sourceData);
        } else {
          return createSource(sourceData);
        }
      } catch (error) {
        console.error('[API] Failed to process source:', sourceData, error);
        return { error: error.message };
      }
    });

    res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('[API] Failed to process batch:', error);
    res.status(500).json({
      error: 'Failed to process batch update',
      details: error.message
    });
  }
});

export default router;
