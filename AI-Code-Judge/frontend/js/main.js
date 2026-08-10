/**
 * main.js — Shared utilities used across all pages
 */

// ─── Toast Notifications ─────────────────────────────────────────────────────

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration  ms before auto-dismiss (0 = sticky)
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
  return toast;
}

function dismissToast(toast) {
  toast.classList.remove('show');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// ─── Local Storage Helpers ────────────────────────────────────────────────────

const Storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage.set failed:', e);
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  },
  push(key, item, maxItems = 500) {
    const arr = this.get(key, []);
    arr.unshift(item);
    if (arr.length > maxItems) arr.length = maxItems;
    this.set(key, arr);
  }
};

// ─── API Client ───────────────────────────────────────────────────────────────

const API_BASE = 'http://127.0.0.1:5000';

const Api = {
  _authHeaders() {
    const token = Storage.get('token');
    const base  = { 'Content-Type': 'application/json' };
    return token ? { ...base, 'Authorization': `Bearer ${token}` } : base;
  },

  async post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method:  'POST',
      headers: this._authHeaders(),
      body:    JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async get(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: this._authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async delete(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      method:  'DELETE',
      headers: this._authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }
};

// ─── Score Color ──────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 50) return 'var(--yellow)';
  return 'var(--red)';
}

function scoreClass(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

function scoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 65) return 'Decent';
  if (score >= 50) return 'Needs Work';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

// ─── Language helpers ─────────────────────────────────────────────────────────

const LANG_ICONS = {
  python: '🐍', javascript: '🟨', typescript: '🔷',
  java: '☕', cpp: '⚙', csharp: '🔵',
  go: '🐹', rust: '🦀', php: '🐘', ruby: '💎',
};

const LANG_EXTENSIONS = {
  python: 'py', javascript: 'js', typescript: 'ts',
  java: 'java', cpp: 'cpp', csharp: 'cs',
  go: 'go', rust: 'rs', php: 'php', ruby: 'rb',
};

const LANG_COLORS = [
  '#6c63ff','#22d3a0','#ffd166','#38bdf8',
  '#f472b6','#fb923c','#a3e635','#e879f9',
];

function langIcon(lang) {
  return LANG_ICONS[lang?.toLowerCase()] || '📄';
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Score Ring animation ─────────────────────────────────────────────────────

/**
 * Animate an SVG score ring to the given score (0–100).
 * @param {string} fillId   id of the <circle> to animate
 * @param {number} score    0–100
 * @param {number} radius   circle radius (default 52)
 */
function animateScoreRing(fillId, score, radius = 52) {
  const circle = document.getElementById(fillId);
  if (!circle) return;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  circle.style.strokeDasharray  = circumference;
  circle.style.strokeDashoffset = circumference; // start at 0
  circle.style.stroke = scoreColor(score);
  // Trigger animation on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      circle.style.strokeDashoffset = offset;
    });
  });
}

// ─── Progress bar builder ─────────────────────────────────────────────────────

/**
 * Build a score breakdown row element.
 */
function buildProgressBar(label, value, max = 10) {
  const pct = Math.round((value / max) * 100);
  const color = scoreColor(Math.round((value / max) * 100));
  const wrap = document.createElement('div');
  wrap.className = 'progress-bar-wrap';
  wrap.innerHTML = `
    <span class="progress-bar-label">${label}</span>
    <div class="progress-bar-track">
      <div class="progress-bar-fill" style="width:0%;background:${color}" data-target="${pct}"></div>
    </div>
    <span class="progress-bar-score">${value}</span>
  `;
  // Animate on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = wrap.querySelector('.progress-bar-fill');
      if (fill) fill.style.width = `${pct}%`;
    });
  });
  return wrap;
}

// ─── Navbar active state ──────────────────────────────────────────────────────

(function highlightNav() {
  const path = location.pathname.split('/').pop();
  document.querySelectorAll('.navbar-nav a').forEach(a => {
    const href = a.getAttribute('href').split('/').pop();
    a.classList.toggle('active', href === path);
  });
})();

// ─── Keyboard: close modals on Escape ────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
    });
  }
});
