/**
 * db.js – Simple JSON file-based data store
 * Provides atomic read/write with in-memory caching.
 * In production, swap this layer for a real database (PostgreSQL, MongoDB…).
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const files = {
  products:  path.join(DATA_DIR, 'products.json'),
  orders:    path.join(DATA_DIR, 'orders.json'),
  analytics: path.join(DATA_DIR, 'analytics.json'),
  contacts:  path.join(DATA_DIR, 'contacts.json'),
};

// In-memory cache
const cache = {};

function read(collection) {
  if (cache[collection]) return JSON.parse(JSON.stringify(cache[collection]));
  const file = files[collection];
  if (!file) throw new Error(`Unknown collection: ${collection}`);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    cache[collection] = data;
    return JSON.parse(JSON.stringify(data));
  } catch {
    return [];
  }
}

function write(collection, data) {
  const file = files[collection];
  if (!file) throw new Error(`Unknown collection: ${collection}`);
  cache[collection] = data;
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Analytics uses a single object, not an array
function readAnalytics() {
  const file = files.analytics;
  if (!fs.existsSync(file)) return defaultAnalytics();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    cache.analytics = data;
    return data;
  } catch {
    return defaultAnalytics();
  }
}

function writeAnalytics(data) {
  cache.analytics = data;
  fs.writeFileSync(files.analytics, JSON.stringify(data, null, 2), 'utf8');
}

function defaultAnalytics() {
  return {
    passwordAttempts: 0,
    orderNowClicks: 0,
    checkoutCount: 0,
    contactClicks: 0,
    sessions: [],
    lastReset: new Date().toISOString(),
  };
}

module.exports = { read, write, readAnalytics, writeAnalytics, defaultAnalytics };
