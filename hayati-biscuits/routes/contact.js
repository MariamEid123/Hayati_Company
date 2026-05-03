/**
 * routes/contact.js
 * Saves contact form submissions server-side.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { read, write, readAnalytics, writeAnalytics } = require('../data/db');
const { adminApiAuth } = require('../middleware/adminAuth');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();

// ──────────────────────────────────────────
// POST /api/contact – submit contact form (public)
// ──────────────────────────────────────────
router.post(
  '/',
  sanitizeBody,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('phone').optional().trim().isLength({ max: 30 }),
    body('email').optional().trim().isEmail().withMessage('Invalid email').isLength({ max: 200 }),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const contacts = read('contacts');
    contacts.push({
      id: uuidv4(),
      name: req.body.name,
      phone: req.body.phone || '',
      email: req.body.email || '',
      message: req.body.message,
      read: false,
      createdAt: new Date().toISOString(),
    });
    write('contacts', contacts);

    // Track in analytics
    const analytics = readAnalytics();
    analytics.contactClicks = (analytics.contactClicks || 0) + 1;
    writeAnalytics(analytics);

    return res.json({ ok: true, message: 'Message received!' });
  }
);

// ──────────────────────────────────────────
// GET /api/contact – list all messages (admin)
// ──────────────────────────────────────────
router.get('/', adminApiAuth, (req, res) => {
  const contacts = read('contacts');
  contacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json(contacts);
});

// ──────────────────────────────────────────
// PATCH /api/contact/:id/read – mark as read (admin)
// ──────────────────────────────────────────
router.patch('/:id/read', adminApiAuth, (req, res) => {
  const contacts = read('contacts');
  const idx = contacts.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Message not found' });
  contacts[idx].read = true;
  write('contacts', contacts);
  return res.json({ ok: true });
});

module.exports = router;
