# 🍪 Hayati Biscuits – Full-Stack Web Application

Premium Egyptian biscuit shop with a Node.js backend, server-side data persistence, admin dashboard, and production-grade security.

---

## 📁 Project Structure

```
hayati-biscuits/
├── server.js                  # Express app entry point
├── package.json
├── .env.example               # Environment variable template
├── .gitignore
│
├── routes/
│   ├── auth.js                # POST /api/auth/login|logout, GET /api/auth/me
│   ├── products.js            # GET|POST|PATCH|DELETE /api/products
│   ├── orders.js              # POST /api/orders, GET (admin), PATCH status
│   ├── analytics.js           # POST /api/analytics/event, GET|DELETE (admin)
│   └── contact.js             # POST /api/contact, GET|PATCH (admin)
│
├── middleware/
│   ├── adminAuth.js           # JWT cookie auth for admin routes
│   └── sanitize.js            # XSS input sanitisation
│
├── data/
│   ├── db.js                  # JSON file-based data layer
│   ├── products.json          # Seed product data (committed)
│   ├── orders.json            # Created at runtime (gitignored)
│   ├── contacts.json          # Created at runtime (gitignored)
│   └── analytics.json        # Created at runtime (gitignored)
│
├── scripts/
│   └── setup.js               # One-time setup script
│
└── public/                    # Static files served by Express
    ├── index.html             # Customer-facing website
    ├── admin.html             # Admin dashboard (JWT protected)
    ├── css/
    │   ├── main.css           # Customer site styles
    │   └── admin.css          # Admin dashboard styles
    ├── js/
    │   ├── main.js            # Customer site logic (API calls)
    │   └── admin.js           # Admin dashboard logic
    └── images/                # Product images
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run setup (creates .env with auto-generated secrets)
```bash
npm run setup
```

### 3. Edit `.env` – set your credentials
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongPassword123!
```

### 4. Start the server
```bash
npm run dev     # Development (auto-restart with nodemon)
npm start       # Production
```

### 5. Open in browser
- **Website:** http://localhost:3000
- **Admin panel:** http://localhost:3000/admin

---

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| Helmet.js | Sets 12 security HTTP headers (CSP, HSTS, X-Frame-Options…) |
| Rate limiting | 200 req/15min globally; 10 req/15min on auth endpoints |
| JWT auth | HttpOnly + Secure + SameSite=Strict cookie; 8-hour TTL |
| bcrypt | Password hashed at 12 rounds; constant-time comparison |
| Input validation | express-validator on all API routes |
| XSS sanitisation | Custom middleware strips `<>'"` from all body fields |
| Server-side totals | Order totals recalculated server-side; client prices ignored |
| Soft delete | Products are marked inactive, never hard-deleted |
| CORS | Restricted to `ALLOWED_ORIGIN` in production |
| CSP | Whitelist-only script/style/font/connect sources |
| `noindex` | Admin HTML has `<meta name="robots" content="noindex">` |

---

## 📡 API Reference

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | ❌ | Login, sets `adminToken` cookie |
| POST | `/api/auth/logout` | ✅ | Clears cookie |
| GET  | `/api/auth/me` | ✅ | Check session |

### Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET    | `/api/products` | ❌ | List active products (public) |
| GET    | `/api/products/all` | ✅ | List all including inactive |
| POST   | `/api/products` | ✅ | Add new product |
| PATCH  | `/api/products/:id` | ✅ | Update product |
| DELETE | `/api/products/:id` | ✅ | Soft-delete product |

### Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| POST  | `/api/orders` | ❌ | Place order (server validates total) |
| GET   | `/api/orders` | ✅ | List all orders |
| PATCH | `/api/orders/:id/status` | ✅ | Update order status |

### Analytics
| Method | Path | Auth | Description |
|---|---|---|---|
| POST   | `/api/analytics/event` | ❌ | Track event (orderNowClicks, contactClicks, sessionEnd) |
| GET    | `/api/analytics` | ✅ | View all analytics |
| DELETE | `/api/analytics` | ✅ | Reset analytics |

### Contact
| Method | Path | Auth | Description |
|---|---|---|---|
| POST  | `/api/contact` | ❌ | Submit contact form |
| GET   | `/api/contact` | ✅ | List all messages |
| PATCH | `/api/contact/:id/read` | ✅ | Mark message as read |

---

## 🛠️ Upgrading to a Real Database

The `data/db.js` module is a simple JSON file store. To use PostgreSQL or MongoDB:

1. Install the driver: `npm install pg` or `npm install mongoose`
2. Replace `read()` and `write()` in `data/db.js` with DB queries
3. No other files need to change — all routes use `db.js` as the only data access layer

---

## 🌍 Deployment

1. Set `NODE_ENV=production` in `.env`
2. Set `ALLOWED_ORIGIN=https://yourdomain.com`
3. Use a process manager: `pm2 start server.js --name hayati`
4. Put Nginx in front as a reverse proxy
5. Enable HTTPS (Let's Encrypt / Certbot)
