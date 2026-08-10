/**
 * admin.js — Admin dashboard logic.
 *
 * On load: verify the JWT is present and the user is an admin.
 * Then fetch overview, users, and judgments data from the API.
 */

'use strict';

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function checkAdminAccess() {
  const token = Storage.get('token');
  if (!token) {
    showGuard(); return;
  }
  try {
    const res  = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) { showGuard(); return; }
    const data = await res.json();
    if (!data.user?.is_admin) { showGuard(); return; }
    showAdmin();
    loadOverview();
  } catch {
    showGuard();
  }
}

function showGuard() {
  document.getElementById('admin-guard').classList.remove('hidden');
  document.getElementById('admin-content').classList.add('hidden');
}

function showAdmin() {
  document.getElementById('admin-guard').classList.add('hidden');
  document.getElementById('admin-content').classList.remove('hidden');
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

    if (btn.dataset.tab === 'users')     loadUsers(1);
    if (btn.dataset.tab === 'judgments') loadJudgments(1);
  });
});

// ─── Refresh ──────────────────────────────────────────────────────────────────

document.getElementById('refresh-btn')?.addEventListener('click', () => {
  loadOverview();
  showToast('Data refreshed', 'info', 2000);
});

// ─── Logout ───────────────────────────────────────────────────────────────────

document.getElementById('logout-btn')?.addEventListener('click', () => {
  Storage.remove('token');
  Storage.remove('user');
  location.href = 'login.html';
});

// ─── Overview ─────────────────────────────────────────────────────────────────

let langChart = null;

async function loadOverview() {
  try {
    const data = await authedGet('/api/admin/overview');
    el('ov-users').textContent     = data.total_users     ?? '—';
    el('ov-judgments').textContent = data.total_judgments ?? '—';
    el('ov-commits').textContent   = data.total_commits   ?? '—';
    el('ov-avg').textContent       = data.average_score != null ? `${data.average_score}` : '—';

    renderLangChart(data.languages || {});
    renderActivity(data.recent_activity || []);
  } catch (err) {
    showToast('Failed to load overview: ' + err.message, 'error');
  }
}

function renderLangChart(langs) {
  const canvas = document.getElementById('lang-chart');
  if (!canvas) return;

  const entries = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels  = entries.map(([l]) => l);
  const values  = entries.map(([, c]) => c);
  const colors  = LANG_COLORS.slice(0, labels.length);

  if (langChart) langChart.destroy();
  langChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#1a1a24' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#8888aa', font: { size: 12 } } }
      }
    }
  });
}

function renderActivity(items) {
  const feed = el('activity-feed');
  if (!feed) return;
  if (!items.length) {
    feed.innerHTML = '<p class="text-muted" style="font-size:.85rem;">No recent activity.</p>';
    return;
  }
  feed.innerHTML = '';
  items.forEach(j => {
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.innerHTML = `
      <span>${langIcon(j.language)}</span>
      <span class="ai-meta">${escHtml(j.language)} — user #${j.user_id ?? 'anon'}</span>
      <span class="ai-score" style="color:${scoreColor(j.score)}">${j.score}</span>
      <span class="ai-time">${timeAgo(j.created_at)}</span>
    `;
    feed.appendChild(div);
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

let usersPage = 1;

document.getElementById('user-search-btn')?.addEventListener('click', () => loadUsers(1));
document.getElementById('user-search')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') loadUsers(1);
});

async function loadUsers(page = 1) {
  usersPage = page;
  const q   = el('user-search')?.value.trim() || '';
  try {
    const data = await authedGet(`/api/admin/users?page=${page}&per_page=20&q=${encodeURIComponent(q)}`);
    el('user-count').textContent = `${data.total} user${data.total !== 1 ? 's' : ''}`;

    const tbody = el('users-tbody');
    tbody.innerHTML = '';
    el('users-empty').classList.toggle('hidden', data.items.length > 0);

    data.items.forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono" style="color:var(--text-muted)">#${user.id}</td>
        <td><strong>${escHtml(user.username)}</strong></td>
        <td style="color:var(--text-secondary)">${escHtml(user.email)}</td>
        <td class="mono">${user.judgment_count ?? 0}</td>
        <td>${user.is_admin ? '<span class="badge badge-purple">Admin</span>' : '<span class="badge" style="background:var(--bg-input);color:var(--text-muted);">User</span>'}</td>
        <td style="color:var(--text-muted);font-size:.8rem;">${formatDate(user.created_at)}</td>
        <td>
          <div style="display:flex;gap:6px;">
            ${!user.is_admin ? `<button class="btn btn-ghost btn-sm make-admin-btn" data-id="${user.id}" title="Make admin">⬆ Admin</button>` : ''}
            <button class="btn btn-danger btn-sm delete-user-btn" data-id="${user.id}" data-name="${escHtml(user.username)}" title="Delete user">🗑</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderPagination('users-pagination', data.page, data.pages, loadUsers);
  } catch (err) {
    showToast('Failed to load users: ' + err.message, 'error');
  }
}

// User table actions
el('users-tbody')?.addEventListener('click', async e => {
  const delBtn   = e.target.closest('.delete-user-btn');
  const adminBtn = e.target.closest('.make-admin-btn');

  if (delBtn) {
    const id   = parseInt(delBtn.dataset.id);
    const name = delBtn.dataset.name;
    confirmAction(
      `Delete ${name}?`,
      `This will permanently delete the account and all their data.`,
      async () => {
        try {
          await authedDelete(`/api/admin/users/${id}`);
          showToast(`${name} deleted.`, 'success');
          loadUsers(usersPage);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    );
  }

  if (adminBtn) {
    const id = parseInt(adminBtn.dataset.id);
    try {
      await authedPost(`/api/admin/users/${id}/make-admin`, {});
      showToast('User promoted to admin.', 'success');
      loadUsers(usersPage);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// ─── Judgments ────────────────────────────────────────────────────────────────

let judgementsPage = 1;

async function loadJudgments(page = 1) {
  judgementsPage = page;
  try {
    const data = await authedGet(`/api/admin/judgments?page=${page}&per_page=25`);
    el('judgment-count').textContent = `${data.total} judgment${data.total !== 1 ? 's' : ''}`;

    const tbody = el('judgments-tbody');
    tbody.innerHTML = '';
    el('judgments-empty').classList.toggle('hidden', data.items.length > 0);

    data.items.forEach(j => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono" style="color:var(--text-muted)">#${j.id}</td>
        <td style="color:var(--text-secondary)">${j.user_id ? `#${j.user_id}` : 'anon'}</td>
        <td><span class="badge badge-purple">${j.language}</span></td>
        <td><span class="mono" style="color:${scoreColor(j.score)};font-weight:700;">${j.score}</span></td>
        <td style="color:var(--text-muted);font-size:.8rem;">${j.personality}</td>
        <td style="color:var(--text-muted);font-size:.8rem;">${formatDate(j.created_at)}</td>
      `;
      tbody.appendChild(tr);
    });

    renderPagination('judgments-pagination', data.page, data.pages, loadJudgments);
  } catch (err) {
    showToast('Failed to load judgments: ' + err.message, 'error');
  }
}

// ─── Shared pagination builder ────────────────────────────────────────────────

function renderPagination(containerId, currentPage, totalPages, loadFn) {
  const container = el(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const addBtn = (label, page, disabled, active) => {
    const btn = document.createElement('button');
    btn.className = `page-btn${active ? ' active' : ''}`;
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => loadFn(page));
    container.appendChild(btn);
  };

  addBtn('←', currentPage - 1, currentPage === 1, false);
  const start = Math.max(1, currentPage - 2);
  const end   = Math.min(totalPages, currentPage + 2);
  for (let p = start; p <= end; p++) addBtn(p, p, false, p === currentPage);
  addBtn('→', currentPage + 1, currentPage === totalPages, false);
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

let confirmCallback = null;

function confirmAction(title, msg, callback) {
  el('confirm-title').textContent = title;
  el('confirm-msg').textContent   = msg;
  confirmCallback = callback;
  el('confirm-overlay').classList.add('open');
}

el('confirm-ok')?.addEventListener('click', () => {
  el('confirm-overlay').classList.remove('open');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

el('confirm-cancel')?.addEventListener('click', () => {
  el('confirm-overlay').classList.remove('open');
  confirmCallback = null;
});

el('confirm-overlay')?.addEventListener('click', e => {
  if (e.target === el('confirm-overlay')) {
    el('confirm-overlay').classList.remove('open');
    confirmCallback = null;
  }
});

// ─── Authed fetch helpers ────────────────────────────────────────────────────

function authHeader() {
  const token = Storage.get('token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
}

async function authedGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeader() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function authedPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function authedDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE', headers: authHeader()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

checkAdminAccess();
