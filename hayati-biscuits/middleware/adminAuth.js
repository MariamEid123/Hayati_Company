/**
 * middleware/adminAuth.js
 * Verifies JWT from cookie or Authorization header for admin routes.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production';

/**
 * Middleware: protect admin HTML page.
 * Reads token from cookie; redirects to /admin-login on failure.
 */
function adminAuth(req, res, next) {
  const token = req.cookies?.adminToken;

  if (!token) {
    // Redirect to the admin login page (served as part of admin.html)
    return res.redirect('/?adminLogin=1');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    res.clearCookie('adminToken');
    return res.redirect('/?adminLogin=1');
  }
}

/**
 * Middleware: protect API routes.
 * Reads token from cookie OR Authorization: Bearer <token> header.
 */
function adminApiAuth(req, res, next) {
  let token = req.cookies?.adminToken;

  // Also accept Bearer token for API clients
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = { adminAuth, adminApiAuth };
