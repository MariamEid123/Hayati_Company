/**
 * routes/products.js
 * Public GET, Admin POST/DELETE for products.
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { read, write } = require('../data/db');
const { adminApiAuth } = require('../middleware/adminAuth');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();

// ──────────────────────────────────────────
// GET /api/products – list all active products (public)
// ──────────────────────────────────────────
router.get('/', (req, res) => {
  const products = read('products').filter(p => p.active !== false);
  return res.json(products);
});

// ──────────────────────────────────────────
// GET /api/products/all – list ALL products including inactive (admin)
// ──────────────────────────────────────────
router.get('/all', adminApiAuth, (req, res) => {
  const products = read('products');
  return res.json(products);
});

// ──────────────────────────────────────────
// POST /api/products – add new product (admin)
// ──────────────────────────────────────────
router.post(
  '/',
  adminApiAuth,
  sanitizeBody,
  [
    body('nameEn').trim().notEmpty().withMessage('English name required').isLength({ max: 100 }),
    body('nameAr').trim().notEmpty().withMessage('Arabic name required').isLength({ max: 100 }),
    body('price')
      .isInt({ min: 1, max: 100000 }).withMessage('Price must be a positive integer'),
    body('category')
      .isIn(['wafer', 'biscuit']).withMessage('Category must be wafer or biscuit'),
    body('emoji').optional().isLength({ max: 8 }),
    body('image').optional().isLength({ max: 500 }),
    body('descEn').optional().isLength({ max: 500 }),
    body('descAr').optional().isLength({ max: 500 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const products = read('products');
    const maxId = products.reduce((m, p) => Math.max(m, p.id), 0);

    const newProduct = {
      id: maxId + 1,
      nameEn: req.body.nameEn,
      nameAr: req.body.nameAr,
      category: req.body.category,
      price: parseInt(req.body.price, 10),
      emoji: req.body.emoji || '🍪',
      image: req.body.image || '',
      descEn: req.body.descEn || '',
      descAr: req.body.descAr || '',
      active: true,
      createdAt: new Date().toISOString(),
    };

    products.push(newProduct);
    write('products', products);

    return res.status(201).json(newProduct);
  }
);

// ──────────────────────────────────────────
// PATCH /api/products/:id – update product (admin)
// ──────────────────────────────────────────
router.patch(
  '/:id',
  adminApiAuth,
  sanitizeBody,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid product id'),
    body('nameEn').optional().trim().isLength({ min: 1, max: 100 }),
    body('nameAr').optional().trim().isLength({ min: 1, max: 100 }),
    body('price').optional().isInt({ min: 1, max: 100000 }),
    body('category').optional().isIn(['wafer', 'biscuit']),
    body('active').optional().isBoolean(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const id = parseInt(req.params.id, 10);
    const products = read('products');
    const idx = products.findIndex(p => p.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const allowed = ['nameEn', 'nameAr', 'descEn', 'descAr', 'category', 'price', 'emoji', 'image', 'active'];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        products[idx][field] = req.body[field];
      }
    }
    products[idx].updatedAt = new Date().toISOString();

    write('products', products);
    return res.json(products[idx]);
  }
);

// ──────────────────────────────────────────
// DELETE /api/products/:id – soft-delete (admin)
// ──────────────────────────────────────────
router.delete(
  '/:id',
  adminApiAuth,
  [param('id').isInt({ min: 1 }).withMessage('Invalid product id')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const id = parseInt(req.params.id, 10);
    const products = read('products');
    const idx = products.findIndex(p => p.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Soft delete – keeps the record, just marks inactive
    products[idx].active = false;
    products[idx].deletedAt = new Date().toISOString();
    write('products', products);

    return res.json({ ok: true, message: 'Product deleted' });
  }
);

module.exports = router;
