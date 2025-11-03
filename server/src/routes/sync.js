/**
 * API routes for sync operations and status
 */

import express from 'express';
import {
  getSyncMetadata,
  getAllSyncMetadata,
  resetRetryCount
} from '../db/sync-metadata.js';

const router = express.Router();

/**
 * GET /api/sync/status
 * Get sync status for all sources or specific source
 */
router.get('/status', (req, res) => {
  try {
    const { sourceId } = req.query;

    if (sourceId) {
      const metadata = getSyncMetadata(sourceId);

      if (!metadata) {
        return res.status(404).json({
          error: 'Sync metadata not found',
          details: `No metadata found for source: ${sourceId}`
        });
      }

      res.json(metadata);
    } else {
      const allMetadata = getAllSyncMetadata();
      res.json(allMetadata);
    }
  } catch (error) {
    console.error('[API] Failed to get sync status:', error);
    res.status(500).json({
      error: 'Failed to retrieve sync status',
      details: error.message
    });
  }
});

/**
 * POST /api/sync/trigger
 * Trigger manual sync for specific source or all sources
 */
router.post('/trigger', async (req, res) => {
  try {
    const { sourceId } = req.body;
    console.log('[API Sync] POST /trigger - Source ID:', sourceId || 'all sources');

    // Import sync service
    const { syncSource, syncAllSources } = await import('../services/sync.service.js');

    let result;

    if (sourceId) {
      console.log('[API Sync] Syncing single source:', sourceId);
      result = await syncSource(sourceId);
    } else {
      console.log('[API Sync] Syncing all sources');
      result = await syncAllSources();
    }

    console.log('[API Sync] Sync completed successfully:', result);
    res.json({
      success: result.success,
      message: 'Sync completed',
      ...result
    });
  } catch (error) {
    console.error('[API Sync] POST /trigger - Failed:', error);
    res.status(500).json({
      error: 'Failed to trigger sync',
      details: error.message
    });
  }
});

/**
 * POST /api/sync/reset-retry/:sourceId
 * Reset retry counter for a source
 */
router.post('/reset-retry/:sourceId', (req, res) => {
  try {
    const metadata = resetRetryCount(req.params.sourceId);

    res.json({
      success: true,
      message: 'Retry counter reset successfully',
      metadata
    });
  } catch (error) {
    console.error('[API] Failed to reset retry counter:', error);
    res.status(500).json({
      error: 'Failed to reset retry counter',
      details: error.message
    });
  }
});

export default router;
