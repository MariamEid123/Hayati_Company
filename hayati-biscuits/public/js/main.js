'use strict';

// ══════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════
const API = {
  async get(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  },
};

// ══════════════════════════════════════════
// ANALYTICS TRACKING (server-side + local fallback)
// ══════════════════════════════════════════
const Analytics = {
  sessionStart: Date.now(),

  async track(event, value) {
    try {
      await API.post('/api/analytics/event', { event, value });
    } catch {
      // Silently fail – analytics should never break UX
    }
  },

  endSession() {
    const elapsed = Math.round((Date.now() - this.sessionStart) / 1000);
    // Use sendBeacon for reliability on page unload
    const blob = new Blob(
      [JSON.stringify({ event: 'sessionEnd', value: elapsed })],
      { type: 'application/json' }
    );
    navigator.sendBeacon ? navigator.sendBeacon('/api/analytics/event', blob) : null;
  },
};

window.addEventListener('beforeunload', () => Analytics.endSession());

// ══════════════════════════════════════════
// PRODUCT DATA
// ══════════════════════════════════════════
let products = [];
let cart = {};
let currentLang = 'en';
let currentFilter = 'all';

async function loadProducts() {
  try {
    products = await API.get('/api/products');
  } catch {
    // Fallback to embedded defaults if server unreachable
    products = window.__DEFAULT_PRODUCTS__ || [];
  }
  renderAllProducts();
}

// ══════════════════════════════════════════
// TRACKING HELPERS
// ══════════════════════════════════════════
function trackOrderNow() { Analytics.track('orderNowClicks'); }
function trackContact()  { Analytics.track('contactClicks'); }

// ══════════════════════════════════════════
// RENDER PRODUCT CARD
// ══════════════════════════════════════════
function renderProductCard(p) {
  const isAr = currentLang === 'ar';
  const name = isAr ? p.nameAr : p.nameEn;
  const desc = isAr ? p.descAr : p.descEn;
  const catLabel = p.category === 'wafer'
    ? (isAr ? 'ويفر' : 'Wafer')
    : (isAr ? 'بسكويت' : 'Biscuit');
  const inCart = cart[p.id]?.qty > 0;
  const bestSellers = [3, 4, 10];

  const mediaContent = p.image
    ? `<img src="${p.image}" alt="${name}" loading="lazy" width="400" height="300" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.src='/images/logo.jpg';">`
    : `<span style="font-size:4.5rem;line-height:1;">${p.emoji}</span>`;

  return `
    <div class="product-card" data-cat="${p.category}" data-id="${p.id}">
      <div class="product-img">
        ${mediaContent}
        ${bestSellers.includes(p.id) ? `<div class="product-badge">${isAr ? 'الأكثر مبيعاً' : 'Best Seller'}</div>` : ''}
      </div>
      <div class="product-info">
        <div class="product-cat">${catLabel}</div>
        <div class="product-name">${name}</div>
        <div class="product-desc">${desc}</div>
        <div class="product-footer">
          <div class="product-price">${p.price} <span>${isAr ? 'جنيه' : 'EGP'}</span></div>
          <button class="add-btn${inCart ? ' added' : ''}" onclick="addToCart(${p.id})"
            title="${isAr ? 'أضف إلى السلة' : 'Add to cart'}" aria-label="Add to cart">
            <i class="fas ${inCart ? 'fa-check' : 'fa-plus'}"></i>
          </button>
        </div>
      </div>
    </div>`;
}

function renderAllProducts() {
  const homeEl = document.getElementById('home-products');
  if (homeEl) {
    homeEl.innerHTML = products
      .filter(p => [3, 4, 10].includes(p.id))
      .map(renderProductCard).join('');
  }
  const allEl = document.getElementById('all-products');
  if (allEl) {
    const filtered = currentFilter === 'all'
      ? products
      : products.filter(p => p.category === currentFilter);
    allEl.innerHTML = filtered.map(renderProductCard).join('');
  }
}

function filterProducts(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAllProducts();
}

// ══════════════════════════════════════════
// CART LOGIC
// ══════════════════════════════════════════
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (!cart[id]) cart[id] = { ...p, qty: 0 };
  cart[id].qty++;
  updateCartUI();
  renderAllProducts();
  const isAr = currentLang === 'ar';
  showToast(isAr ? `✓ تمت إضافة ${p.nameAr}` : `✓ Added ${p.nameEn}`);
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  updateCartUI();
  renderAllProducts();
}

function getCartTotal() {
  return Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0);
}

function updateCartUI() {
  const total = getCartTotal();
  const count = Object.values(cart).reduce((s, i) => s + i.qty, 0);
  const isAr = currentLang === 'ar';
  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-total-val').innerHTML =
    `${total} <span>${isAr ? 'جنيه' : 'EGP'}</span>`;
  renderCartItems();
  updateMinNote(total);
}

function renderCartItems() {
  const el = document.getElementById('cart-items-list');
  const isAr = currentLang === 'ar';
  const items = Object.values(cart);
  if (!items.length) {
    el.innerHTML = `<div class="empty-cart">
      <i class="fas fa-shopping-bag"></i>
      <p>${isAr ? 'سلتك فارغة' : 'Your cart is empty'}</p>
    </div>`;
    return;
  }
  el.innerHTML = items.map(item => `
    <div class="cart-item">
      <div class="cart-item-icon">${item.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${isAr ? item.nameAr : item.nameEn}</div>
        <div class="cart-item-price">${item.price * item.qty} ${isAr ? 'جنيه' : 'EGP'}</div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)" aria-label="Decrease">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id}, 1)" aria-label="Increase">+</button>
      </div>
    </div>`).join('');
}

function updateMinNote(total) {
  const note = document.getElementById('min-note');
  const btn  = document.getElementById('checkout-btn');
  const isAr = currentLang === 'ar';
  if (total === 0) {
    note.className = 'min-order-note';
    note.innerHTML = `<span>${isAr ? 'الحد الأدنى: 150 جنيه' : 'Minimum order: 150 EGP'}</span>`;
    btn.disabled = true; btn.style.opacity = '0.5';
  } else if (total < 150) {
    const rem = 150 - total;
    note.className = 'min-order-note error';
    note.textContent = isAr
      ? `أضف ${rem} جنيه للوصول للحد الأدنى`
      : `Add ${rem} EGP more to reach the minimum`;
    btn.disabled = true; btn.style.opacity = '0.5';
  } else {
    note.className = 'min-order-note ok';
    note.textContent = isAr ? '✓ يمكنك إتمام الطلب' : '✓ Ready to checkout!';
    btn.disabled = false; btn.style.opacity = '1';
  }
}

// ══════════════════════════════════════════
// CART DRAWER
// ══════════════════════════════════════════
function toggleCart() {
  document.getElementById('cart-drawer').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}

function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

// ══════════════════════════════════════════
// CHECKOUT
// ══════════════════════════════════════════
function openCheckout() {
  if (getCartTotal() < 150) return;
  closeCart();
  const isAr = currentLang === 'ar';
  const items = Object.values(cart);
  let rows = items.map(i =>
    `<div class="checkout-summary-row">
      <span>${isAr ? i.nameAr : i.nameEn} ×${i.qty}</span>
      <span>${i.price * i.qty} ${isAr ? 'جنيه' : 'EGP'}</span>
    </div>`).join('');
  rows += `<div class="checkout-summary-total">
    <span>${isAr ? 'الإجمالي' : 'Total'}</span>
    <span>${getCartTotal()} ${isAr ? 'جنيه' : 'EGP'}</span>
  </div>`;
  document.getElementById('checkout-summary').innerHTML = rows;
  document.getElementById('checkout-form-wrap').style.display = 'block';
  document.getElementById('success-msg').classList.remove('show');
  document.getElementById('checkout-modal').classList.add('open');
}

function closeCheckout() {
  document.getElementById('checkout-modal').classList.remove('open');
}

async function placeOrder() {
  const name    = document.getElementById('co-name').value.trim();
  const phone   = document.getElementById('co-phone').value.trim();
  const address = document.getElementById('co-address').value.trim();
  const isAr    = currentLang === 'ar';

  if (!name || !phone || !address) {
    showToast(isAr ? '⚠️ برجاء ملء الحقول المطلوبة' : '⚠️ Please fill in all required fields');
    return;
  }

  const paymentElem = document.getElementById('co-payment');
  const payment = paymentElem.options[paymentElem.selectedIndex].value;
  const notes = document.getElementById('co-notes').value.trim();

  const items = Object.values(cart).map(i => ({
    id: i.id, qty: i.qty, price: i.price, nameEn: i.nameEn,
  }));

  // Save order server-side
  const result = await API.post('/api/orders', {
    name, phone, address, payment, notes, items,
  });

  if (!result.ok) {
    showToast(isAr ? '⚠️ حدث خطأ في الطلب' : `⚠️ ${result.data?.error || 'Order error'}`);
    return;
  }

  // Also open WhatsApp for confirmation
  let orderText = isAr
    ? '*طلب جديد من حياتي بسكويت* 🍪\n\n'
    : '*New Order from Hayati Biscuits* 🍪\n\n';
  orderText += isAr ? `*الاسم:* ${name}\n` : `*Name:* ${name}\n`;
  orderText += isAr ? `*الهاتف:* ${phone}\n` : `*Phone:* ${phone}\n`;
  orderText += isAr ? `*العنوان:* ${address}\n` : `*Address:* ${address}\n`;
  orderText += isAr ? `*طريقة الدفع:* ${payment}\n` : `*Payment:* ${payment}\n`;
  if (notes) orderText += isAr ? `*ملاحظات:* ${notes}\n` : `*Notes:* ${notes}\n`;
  orderText += '\n*المنتجات / Products:*\n';
  Object.values(cart).forEach(item => {
    const n = isAr ? item.nameAr : item.nameEn;
    orderText += `- ${n} x${item.qty} (${item.price * item.qty} EGP)\n`;
  });
  orderText += `\n*الإجمالي / Total:* ${getCartTotal()} EGP`;
  orderText += `\n*Order ID:* ${result.data.orderId}`;

  const waNumber = '201227977347';
  window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(orderText)}`, '_blank');

  document.getElementById('checkout-form-wrap').style.display = 'none';
  document.getElementById('success-msg').classList.add('show');
  cart = {};
  updateCartUI();
  ['co-name', 'co-phone', 'co-address', 'co-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('co-payment').selectedIndex = 0;
}

// ══════════════════════════════════════════
// CONTACT FORM
// ══════════════════════════════════════════
async function sendContact() {
  const name  = document.getElementById('contact-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const msg   = document.getElementById('contact-msg').value.trim();
  const isAr  = currentLang === 'ar';

  if (!name || !msg) {
    showToast(isAr ? '⚠️ برجاء ملء الحقول المطلوبة' : '⚠️ Please fill required fields');
    return;
  }

  const result = await API.post('/api/contact', { name, phone, email, message: msg });

  if (result.ok) {
    trackContact();
    showToast(isAr ? '✓ تم إرسال رسالتك!' : '✓ Message sent!');
    ['contact-name', 'contact-phone', 'contact-email', 'contact-msg'].forEach(id => {
      document.getElementById(id).value = '';
    });
  } else {
    showToast(isAr ? '⚠️ حدث خطأ، حاول مجدداً' : '⚠️ Error, please try again');
  }
}

// ══════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'products') renderAllProducts();
}

// ══════════════════════════════════════════
// HELP BOX
// ══════════════════════════════════════════
function toggleHelp() {
  const panel = document.getElementById('help-panel');
  const fab   = document.getElementById('help-fab');
  const isOpen = panel.classList.toggle('open');
  fab.innerHTML = isOpen
    ? '<i class="fas fa-times"></i>'
    : '<i class="fas fa-question"></i>';
}

// ══════════════════════════════════════════
// THEME
// ══════════════════════════════════════════
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-icon').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
  localStorage.setItem('hb_theme', isDark ? 'light' : 'dark');
}

// ══════════════════════════════════════════
// LANGUAGE
// ══════════════════════════════════════════
function toggleLang() {
  const html = document.documentElement;
  if (currentLang === 'en') {
    currentLang = 'ar';
    html.setAttribute('data-lang', 'ar');
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
  } else {
    currentLang = 'en';
    html.setAttribute('data-lang', 'en');
    html.setAttribute('dir', 'ltr');
    html.setAttribute('lang', 'en');
  }
  renderAllProducts();
  updateCartUI();
}

// ══════════════════════════════════════════
// MOBILE MENU
// ══════════════════════════════════════════
function toggleMobile() {
  document.getElementById('mobile-menu').classList.toggle('open');
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ══════════════════════════════════════════
// SCROLL TO TOP
// ══════════════════════════════════════════
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', () => {
  const btn = document.getElementById('scroll-top-btn');
  btn.classList.toggle('visible', window.scrollY > 2000);
}, { passive: true });

// ══════════════════════════════════════════
// SCROLL REVEAL
// ══════════════════════════════════════════
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      entry.target.style.transitionDelay = `${i * 0.08}s`;
      entry.target.classList.add('revealed');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
(function init() {
  const savedTheme = localStorage.getItem('hb_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-icon').className =
      savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
  loadProducts();
  updateCartUI();
})();
