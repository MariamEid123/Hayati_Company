#!/usr/bin/env node
/**
 * scripts/setup.js
 * One-time setup: creates .env from .env.example and generates a strong JWT secret.
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT       = path.join(__dirname, '..');
const envExample = path.join(ROOT, '.env.example');
const envFile    = path.join(ROOT, '.env');
const dataDir    = path.join(ROOT, 'data');

console.log('\n🍪 Hayati Biscuits – Setup\n');

// 1. Create data directory
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Created data/ directory');
} else {
  console.log('✓  data/ directory already exists');
}

// 2. Create .env if it doesn't exist
if (fs.existsSync(envFile)) {
  console.log('✓  .env already exists – skipping');
} else {
  let template = fs.readFileSync(envExample, 'utf8');

  // Generate strong secrets
  const jwtSecret    = crypto.randomBytes(64).toString('hex');
  const cookieSecret = crypto.randomBytes(32).toString('hex');

  template = template
    .replace('CHANGE_ME_generate_a_long_random_secret_here', jwtSecret)
    .replace('CHANGE_ME_another_random_secret', cookieSecret);

  fs.writeFileSync(envFile, template, 'utf8');
  console.log('✅ Created .env with generated secrets');
}

// 3. Seed products.json if missing
const productsFile = path.join(dataDir, 'products.json');
if (!fs.existsSync(productsFile)) {
  const seed = path.join(ROOT, 'data', 'products.json');
  if (fs.existsSync(seed)) {
    console.log('✓  products.json already seeded');
  } else {
    console.log('⚠️  products.json missing – run server once to auto-seed');
  }
} else {
  console.log('✓  products.json exists');
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Setup complete!

Next steps:
  1. Edit .env and set ADMIN_USERNAME and ADMIN_PASSWORD
  2. Run: npm install
  3. Run: npm run dev   (development)
       or npm start     (production)
  4. Open: http://localhost:3000
  5. Admin: http://localhost:3000/admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
