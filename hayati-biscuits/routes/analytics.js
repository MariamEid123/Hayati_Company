/**
 * routes/analytics.js
 * Track events from the frontend; admin can view/reset.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { readAnalytics, writeAnalytics, defaultAnalytics } = require('../data/db');
const { adminApiAuth } = require('../middleware/adminAuth');

const router = express.Router();

const ALLOWED_EVENTS = ['orderNowClicks', 'contactClicks', 'sessionEnd'];

// ──────────────────────────────────────────
// POST /api/analytics/event – record an event (public, but rate-limited by global limiter)
// ──────────────────────────────────────────
router.post(
  '/event',
  [
    body('event').isIn(ALLOWED_EVENTS).withMessage('Unknown event type'),
    body('value').optional().isNumeric().withMessage('Value must be a number'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const analytics = readAnalytics();
    const { event, value } = req.body;

    if (event === 'sessionEnd') {
      const duration = parseFloat(value);
      if (!isNaN(duration) && duration > 0 && duration < 86400) { // max 24h
        analytics.sessions = analytics.sessions || [];
        analytics.sessions.push(Math.round(duration));
        // Keep only last 1000 sessions
        if (analytics.sessions.length > 1000) {
          analytics.sessions = analytics.sessions.slice(-1000);
        }
      }
    } else if (analytics[event] !== undefined) {
      analytics[event] = (analytics[event] || 0) + 1;
    } else {
      analytics[event] = 1;
    }

    writeAnalytics(analytics);
    return res.json({ ok: true });
  }
);

// ──────────────────────────────────────────
// GET /api/analytics – fetch analytics (admin)
// ──────────────────────────────────────────
router.get('/', adminApiAuth, (req, res) => {
  const analytics = readAnalytics();
  return res.json(analytics);
});

// ──────────────────────────────────────────
// DELETE /api/analytics – reset all analytics (admin)
// ──────────────────────────────────────────
router.delete('/', adminApiAuth, (req, res) => {
  const fresh = defaultAnalytics();
  fresh.lastReset = new Date().toISOString();
  writeAnalytics(fresh);
  return res.json({ ok: true, message: 'Analytics reset' });
});

module.exports = router;
