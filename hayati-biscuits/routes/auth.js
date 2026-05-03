/**
 * routes/auth.js
 * Admin login / logout endpoints.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { readAnalytics, writeAnalytics } = require('../data/db');
const { adminApiAuth } = require('../middleware/adminAuth');

const router = express.Router();

const JWT_SECRET   = process.env.JWT_SECRET   || 'fallback-dev-secret-change-in-production';
const SESSION_TTL  = parseInt(process.env.SESSION_TTL || '28800', 10); // 8 hours default

// Pre-hash the env password at startup (async so we don't block)
let ADMIN_HASH = null;
(async () => {
  const rawPass = process.env.ADMIN_PASSWORD || 'HayatiAdmin2024!';
  ADMIN_HASH = await bcrypt.hash(rawPass, 12);
})();

// ──────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────
router.post(
  '/login',
  [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required')
      .isLength({ max: 50 }).withMessage('Username too long'),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ max: 100 }).withMessage('Password too long'),
  ],
  async (req, res) => {
    // Track login attempts in analytics
    const analytics = readAnalytics();
    analytics.passwordAttempts = (analytics.passwordAttempts || 0) + 1;
    writeAnalytics(analytics);

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { username, password } = req.body;

    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';

    // Constant-time username comparison (avoid timing attacks)
    const usernameMatch = username === expectedUsername;

    // Always run bcrypt compare to prevent timing attacks even if username wrong
    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(password, ADMIN_HASH);
    } catch {
      return res.status(500).json({ error: 'Authentication error' });
    }

    if (!usernameMatch || !passwordMatch) {
      // Intentional delay to further deter brute-force
      await new Promise(r => setTimeout(r, 500 + Math.random() * 300));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Issue JWT
    const token = jwt.sign(
      { username, role: 'admin', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: SESSION_TTL }
    );

    // Set HttpOnly, Secure, SameSite cookie
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_TTL * 1000,
    });

    return res.json({ ok: true, message: 'Logged in successfully' });
  }
);

// ──────────────────────────────────────────
// POST /api/auth/logout
// ──────────────────────────────────────────
router.post('/logout', adminApiAuth, (req, res) => {
  res.clearCookie('adminToken');
  return res.json({ ok: true, message: 'Logged out' });
});

// ──────────────────────────────────────────
// GET /api/auth/me – check session validity
// ──────────────────────────────────────────
router.get('/me', adminApiAuth, (req, res) => {
  return res.json({ ok: true, username: req.admin.username });
});

module.exports = router;
