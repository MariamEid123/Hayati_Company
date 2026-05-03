/**
 * routes/orders.js
 * Save orders server-side; admin can list/update status.
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { read, write, readAnalytics, writeAnalytics } = require('../data/db');
const { adminApiAuth } = require('../middleware/adminAuth');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();

const MIN_ORDER_EGP = 150;

// ──────────────────────────────────────────
// POST /api/orders – place a new order (public)
// ──────────────────────────────────────────
router.post(
  '/',
  sanitizeBody,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone is required')
      .matches(/^[+\d\s()-]{7,20}$/).withMessage('Invalid phone number'),
    body('address').trim().notEmpty().withMessage('Address is required').isLength({ max: 300 }),
    body('payment')
      .isIn(['Cash on Delivery', 'Bank Transfer', 'Instapay']).withMessage('Invalid payment method'),
    body('notes').optional().isLength({ max: 500 }),
    body('items')
      .isArray({ min: 1 }).withMessage('Cart must have at least one item'),
    body('items.*.id').isInt({ min: 1 }),
    body('items.*.qty').isInt({ min: 1, max: 100 }),
    body('items.*.price').isInt({ min: 1, max: 100000 }),
    body('items.*.nameEn').trim().isLength({ min: 1, max: 100 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    // Recalculate total server-side – never trust client totals
    const products = read('products');
    let total = 0;
    const validatedItems = [];

    for (const item of req.body.items) {
      const product = products.find(p => p.id === item.id && p.active !== false);
      if (!product) {
        return res.status(400).json({ error: `Product with id ${item.id} not found` });
      }
      const lineTotal = product.price * item.qty;
      total += lineTotal;
      validatedItems.push({
        id: product.id,
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        price: product.price, // use server price, not client price
        qty: item.qty,
        lineTotal,
      });
    }

    if (total < MIN_ORDER_EGP) {
      return res.status(400).json({
        error: `Minimum order is ${MIN_ORDER_EGP} EGP. Current total: ${total} EGP`,
      });
    }

    const order = {
      id: uuidv4(),
      name: req.body.name,
      phone: req.body.phone,
      address: req.body.address,
      payment: req.body.payment,
      notes: req.body.notes || '',
      items: validatedItems,
      total,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const orders = read('orders');
    orders.push(order);
    write('orders', orders);

    // Update analytics
    const analytics = readAnalytics();
    analytics.checkoutCount = (analytics.checkoutCount || 0) + 1;
    writeAnalytics(analytics);

    return res.status(201).json({
      ok: true,
      orderId: order.id,
      total: order.total,
      message: 'Order placed successfully',
    });
  }
);

// ──────────────────────────────────────────
// GET /api/orders – list all orders (admin)
// ──────────────────────────────────────────
router.get('/', adminApiAuth, (req, res) => {
  const orders = read('orders');
  // Sort newest first
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json(orders);
});

// ──────────────────────────────────────────
// PATCH /api/orders/:id/status – update order status (admin)
// ──────────────────────────────────────────
router.patch(
  '/:id/status',
  adminApiAuth,
  [
    param('id').isUUID().withMessage('Invalid order id'),
    body('status')
      .isIn(['pending', 'confirmed', 'delivered', 'cancelled'])
      .withMessage('Invalid status'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const orders = read('orders');
    const idx = orders.findIndex(o => o.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }

    orders[idx].status = req.body.status;
    orders[idx].updatedAt = new Date().toISOString();
    write('orders', orders);

    return res.json({ ok: true, order: orders[idx] });
  }
);

module.exports = router;
