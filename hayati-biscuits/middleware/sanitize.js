/**
 * middleware/sanitize.js
 * Strips dangerous characters from string inputs to prevent XSS/injection.
 */

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    .trim();
}

function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === 'string' ? sanitizeString(value) : sanitizeObject(value);
  }
  return result;
}

/**
 * Express middleware: sanitizes req.body in place.
 */
function sanitizeBody(req, _res, next) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = { sanitizeBody, sanitizeString };
