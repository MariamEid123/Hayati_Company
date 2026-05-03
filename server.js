require('dotenv').config();
const express     = require('express');
const serverless  = require('serverless-http');
const helmet      = require('helmet');
const cors        = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// ── Middleware ──────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── Mount your real routes here ─────────────────────────
// app.use('/api/auth',     require('../routes/auth'));
// app.use('/api/orders',   require('../routes/orders'));

// ── Quick products stub (replace with your DB logic) ────
const PRODUCTS = [
  { id: 1, name: 'Classic Butter Biscuit', price: 25,  image: 'butter.jpg' },
  { id: 2, name: 'Chocolate Chip Cookie',  price: 30,  image: 'choco.jpg'  },
  { id: 3, name: 'Sesame Crunch',          price: 20,  image: 'sesame.jpg' },
];

app.get('/api/products', (req, res) => {
  res.json({ success: true, products: PRODUCTS });
});

// ── 404 for unknown API routes ───────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ── Error handler ────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Error]', err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
});
app.listen(PORT,() => {
    console.log(`\n Hayati Biscuits server running on http://localhost:${PORT}/api/products`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports.handler =app;