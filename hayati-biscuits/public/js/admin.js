'use strict';

// ══════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════
const API = {
  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  },
  get:    (path)        => API.request('GET', path),
  post:   (path, body)  => API.request('POST', path, body),
  patch:  (path, body)  => API.request('PATCH', path, body),
  delete: (path)        => API.request('DELETE', path),
};

// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════
async function doLogin() {
  const username = document.getElementById('l-user').value.trim();
  const password = document.getElementById('l-pass').value;
  const errEl    = document.getElementById('login-error');

  errEl.classList.remove('show');

  const result = await API.post('/api/auth/login', { username, password });

  if (result.ok) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display    = 'flex';
    switchTab('analytics');
  } else {
    errEl.textContent = result.data?.error || 'Invalid credentials';
    errEl.classList.add('show');
    document.getElementById('l-pass').value = '';
  }
}

async function doLogout() {
  await API.post('/api/auth/logout');
  document.getElementById('dashboard').style.display    = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('l-user').value = '';
  document.getElementById('l-pass').value = '';
}

// Check if already logged in on page load
(async function checkSession() {
  try {
    const res = await API.get('/api/auth/me');
    if (res.ok) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('dashboard').style.display    = 'flex';
      switchTab('analytics');
    }
  } catch { /* not logged in */ }
})();

// Enter key on password field
document.getElementById('l-user').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('l-pass').focus();
});
document.getElementById('l-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
  const sideEl = document.querySelector(`[data-tab="${tab}"]`);
  const panelEl = document.getElementById('tab-' + tab);
  if (sideEl)  sideEl.classList.add('active');
  if (panelEl) panelEl.classList.add('active');

  if (tab === 'analytics') refreshAnalytics();
  if (tab === 'products')  renderProductTable();
  if (tab === 'orders')    loadOrders();
  if (tab === 'messages')  loadMessages();
}

// ══════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function refreshAnalytics() {
  try {
    const res = await API.get('/api/analytics');
    if (!res.ok) return;
    const a = res.data;

    document.getElementById('m-pw').textContent       = a.passwordAttempts || 0;
    document.getElementById('m-order').textContent    = a.orderNowClicks   || 0;
    document.getElementById('m-checkout').textContent = a.checkoutCount    || 0;
    document.getElementById('m-contact').textContent  = a.contactClicks    || 0;

    const sessions = a.sessions || [];
    document.getElementById('m-sessions').textContent = sessions.length;

    if (sessions.length > 0) {
      const max = Math.max(...sessions);
      const min = Math.min(...sessions);
      const avg = sessions.reduce((a, b) => a + b, 0) / sessions.length;
      document.getElementById('t-max').textContent = formatTime(max);
      document.getElementById('t-min').textContent = formatTime(min);
      document.getElementById('t-avg').textContent = formatTime(avg);
    } else {
      ['t-max', 't-min', 't-avg'].forEach(id => {
        document.getElementById(id).textContent = 'No data';
      });
    }
    updateLastUpdated();
  } catch (err) {
    console.error('Analytics load failed', err);
  }
}

function updateLastUpdated() {
  const now = new Date();
  document.getElementById('last-updated').textContent = `Updated ${now.toLocaleTimeString()}`;
}

let liveSeconds = 0;
setInterval(() => {
  liveSeconds++;
  const el = document.getElementById('live-timer');
  if (el) el.textContent = formatTime(liveSeconds);
}, 1000);

function confirmResetAnalytics() {
  openModal(
    '⚠️',
    'Reset All Analytics?',
    'This will permanently clear all tracked data including password attempts, clicks, checkouts, and session history.',
    async () => {
      const res = await API.delete('/api/analytics');
      if (res.ok) {
        refreshAnalytics();
        showToast('Analytics data has been reset.', 'success');
      }
      closeModal();
    }
  );
}

// ══════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════
async function renderProductTable() {
  const tbody = document.getElementById('product-tbody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">Loading…</td></tr>`;
  try {
    const res = await API.get('/api/products/all');
    if (!res.ok) throw new Error('Failed to load products');
    const prods = res.data.filter(p => p.active !== false);

    if (!prods.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">No products found.</td></tr>`;
      return;
    }

    tbody.innerHTML = prods.map(p => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="prod-emoji">${p.emoji}</span>
            <div>
              <div style="font-weight:700;color:var(--brown-dark);">${p.nameEn}</div>
              <div style="font-size:0.78rem;color:var(--text-muted);">${p.descEn ? p.descEn.substring(0, 50) + '…' : ''}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-${p.category}">${p.category === 'wafer' ? 'Wafer' : 'Biscuit'}</span></td>
        <td style="font-weight:700;color:var(--brown);">${p.price} EGP</td>
        <td style="color:var(--text-muted);">${p.nameAr}</td>
        <td>
          <div class="action-btns">
            <button class="icon-action del" onclick="confirmDeleteProduct(${p.id})" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--red);">Error loading products.</td></tr>`;
  }
}

function toggleAddPanel() {
  const panel = document.getElementById('add-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    document.getElementById('np-name-en').focus();
  }
}

async function addProduct() {
  const nameEn  = document.getElementById('np-name-en').value.trim();
  const nameAr  = document.getElementById('np-name-ar').value.trim();
  const descEn  = document.getElementById('np-desc-en').value.trim();
  const descAr  = document.getElementById('np-desc-ar').value.trim();
  const cat     = document.getElementById('np-cat').value;
  const price   = parseInt(document.getElementById('np-price').value, 10);
  const image   = document.getElementById('np-image').value.trim();
  const emoji   = document.getElementById('np-emoji').value.trim() || '🍪';

  if (!nameEn || !nameAr || !price || isNaN(price)) {
    showToast('Please fill all required fields.', 'danger');
    return;
  }

  const result = await API.post('/api/products', {
    nameEn, nameAr, descEn, descAr, category: cat, price, image, emoji,
  });

  if (result.ok) {
    renderProductTable();
    toggleAddPanel();
    showToast(`"${nameEn}" added successfully!`, 'success');
    ['np-name-en', 'np-name-ar', 'np-desc-en', 'np-desc-ar', 'np-price', 'np-image', 'np-emoji'].forEach(id => {
      document.getElementById(id).value = '';
    });
  } else {
    showToast(result.data?.error || 'Failed to add product.', 'danger');
  }
}

function confirmDeleteProduct(id) {
  openModal(
    '🗑️',
    'Delete Product?',
    'This product will be removed from the website. This cannot be undone.',
    async () => {
      const res = await API.delete(`/api/products/${id}`);
      if (res.ok) {
        renderProductTable();
        showToast('Product deleted.', 'danger');
      } else {
        showToast('Failed to delete product.', 'danger');
      }
      closeModal();
    }
  );
}

// ══════════════════════════════════════════
// ORDERS
// ══════════════════════════════════════════
async function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">Loading…</td></tr>`;

  try {
    const res = await API.get('/api/orders');
    if (!res.ok) throw new Error();
    const orders = res.data;

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">No orders yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td style="font-size:0.78rem;color:var(--text-muted);">${o.id.slice(0,8)}…</td>
        <td><strong>${o.name}</strong><br><span style="font-size:0.8rem;color:var(--text-muted);">${o.phone}</span></td>
        <td style="font-size:0.85rem;">${o.items.map(i => `${i.nameEn} ×${i.qty}`).join(', ')}</td>
        <td style="font-weight:700;color:var(--brown);">${o.total} EGP</td>
        <td>
          <select onchange="updateOrderStatus('${o.id}', this.value)" style="padding:4px 8px;border-radius:6px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:0.85rem;cursor:pointer;">
            ${['pending','confirmed','delivered','cancelled'].map(s =>
              `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </td>
        <td style="font-size:0.78rem;color:var(--text-muted);">${new Date(o.createdAt).toLocaleString()}</td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--red);">Error loading orders.</td></tr>`;
  }
}

async function updateOrderStatus(id, status) {
  const res = await API.patch(`/api/orders/${id}/status`, { status });
  if (res.ok) {
    showToast(`Order status updated to "${status}".`, 'success');
  } else {
    showToast('Failed to update order status.', 'danger');
  }
}

// ══════════════════════════════════════════
// MESSAGES
// ══════════════════════════════════════════
async function loadMessages() {
  const container = document.getElementById('messages-list');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);">Loading…</div>`;

  try {
    const res = await API.get('/api/contact');
    if (!res.ok) throw new Error();
    const msgs = res.data;

    if (!msgs.length) {
      container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);">No messages yet.</div>`;
      return;
    }

    container.innerHTML = msgs.map(m => `
      <div class="message-card${m.read ? '' : ' unread'}" id="msg-${m.id}">
        <div class="message-header">
          <div>
            <strong>${m.name}</strong>
            ${m.phone ? `<span style="font-size:0.82rem;color:var(--text-muted);margin-left:8px;">${m.phone}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:0.75rem;color:var(--text-muted);">${new Date(m.createdAt).toLocaleString()}</span>
            ${!m.read ? `<button class="icon-action" onclick="markRead('${m.id}')" title="Mark as read" style="width:28px;height:28px;font-size:0.75rem;"><i class="fas fa-check"></i></button>` : '<span style="font-size:0.75rem;color:var(--blue);">✓ Read</span>'}
          </div>
        </div>
        <div style="margin-top:8px;font-size:0.9rem;color:var(--text-muted);">${m.message}</div>
      </div>`).join('');
  } catch {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--red);">Error loading messages.</div>`;
  }
}

async function markRead(id) {
  const res = await API.patch(`/api/contact/${id}/read`);
  if (res.ok) {
    const card = document.getElementById('msg-' + id);
    if (card) { card.classList.remove('unread'); }
    showToast('Marked as read.', 'success');
  }
}

// ══════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════
let modalCallback = null;

function openModal(icon, title, desc, onConfirm) {
  document.getElementById('modal-icon').textContent  = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-desc').textContent  = desc;
  modalCallback = onConfirm;
  document.getElementById('confirm-modal').classList.add('open');
  document.getElementById('modal-confirm-btn').onclick = () => {
    if (modalCallback) modalCallback();
  };
}

function closeModal() {
  document.getElementById('confirm-modal').classList.remove('open');
  modalCallback = null;
}

document.getElementById('confirm-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('confirm-modal')) closeModal();
});

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
function showToast(msg, type = '') {
  const t = document.getElementById('admin-toast');
  t.textContent = msg;
  t.className = 'admin-toast' + (type ? ' ' + type : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
