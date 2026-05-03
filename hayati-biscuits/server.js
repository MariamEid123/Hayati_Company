require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const authRoutes      = require('./routes/auth');
const productRoutes   = require('./routes/products');
const orderRoutes     = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');
const contactRoutes   = require('./routes/contact');

const app  = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════════
// SECURITY MIDDLEWARE
// ══════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      // 'unsafe-inline' in scriptSrc covers <script> blocks
      scriptSrc:     ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      // 'unsafe-inline' in scriptSrcAttr covers onclick/onchange/etc. attributes
      // Without this, Helmet's default 'none' blocks ALL button onclick handlers
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc:       ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc:        ["'self'", "data:", "blob:"],
      // connectSrc covers fetch/XHR only. window.open (WhatsApp) is unrestricted.
      connectSrc:    ["'self'"],
      frameSrc:      ["'none'"],
      objectSrc:     ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Strict limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' },
  skipSuccessfulRequests: true,
});

// CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ══════════════════════════════════════════
// STATIC FILES
// ══════════════════════════════════════════
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
}));

// Admin HTML page – NO middleware here so the login form is reachable.
// Security is enforced at the API level: all /api admin routes use adminApiAuth.
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ══════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════
app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/contact',   contactRoutes);

// ══════════════════════════════════════════
// CATCH-ALL – serve index.html for SPA
// ══════════════════════════════════════════
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ══════════════════════════════════════════
app.use((err, req, res, _next) => {
  console.error('[Error]', err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`\n🍪 Hayati Biscuits server running on http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/admin`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;