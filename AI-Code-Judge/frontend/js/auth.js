/**
 * auth.js — Login & Register page logic
 */

// ─── Backend connectivity check ───────────────────────────────────────────────
// Run on login/register pages so the user gets an early warning if Flask is down.
(async function checkBackend() {
  const pages = ['login.html', 'register.html'];
  const current = location.pathname.split('/').pop();
  if (!pages.includes(current)) return;

  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error();
    // Backend is up — nothing to do
  } catch {
    const warn = document.createElement('div');
    warn.className = 'alert alert-warning';
    warn.style.cssText = 'margin-bottom:16px;';
    warn.innerHTML = '<span>⚠</span><span>Flask server is not running. Start it with <code style="font-family:var(--font-mono);font-size:0.85em;">python backend/app.py</code> before logging in.</span>';
    const card = document.querySelector('.auth-card');
    if (card) card.insertBefore(warn, card.firstChild);
  }
})();

// ─── Password toggle ──────────────────────────────────────────────────────────

document.querySelectorAll('.password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.input-icon-wrap').querySelector('input');
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.textContent = isText ? '👁' : '🙈';
  });
});

// ─── Password strength meter (register page only) ────────────────────────────

const pwdInput     = document.getElementById('password');
const strengthFill = document.getElementById('strength-fill');
const strengthLbl  = document.getElementById('strength-label');

if (pwdInput && strengthFill) {
  pwdInput.addEventListener('input', () => {
    const val   = pwdInput.value;
    const score = calcStrength(val);
    const map   = [
      { pct: 0,   color: 'var(--border)',  label: 'Enter a password' },
      { pct: 20,  color: 'var(--red)',     label: 'Very weak' },
      { pct: 40,  color: 'var(--red)',     label: 'Weak' },
      { pct: 60,  color: 'var(--yellow)',  label: 'Fair' },
      { pct: 80,  color: 'var(--green)',   label: 'Strong' },
      { pct: 100, color: 'var(--green)',   label: 'Very strong' },
    ];
    const entry = map[score];
    strengthFill.style.width      = `${entry.pct}%`;
    strengthFill.style.background = entry.color;
    if (strengthLbl) strengthLbl.textContent = entry.label;
  });
}

function calcStrength(pwd) {
  if (!pwd) return 0;
  let score = 1;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 5);
}

// ─── Login form ───────────────────────────────────────────────────────────────

const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn     = document.getElementById('login-btn');
    const errWrap = document.getElementById('login-error');
    const errMsg  = document.getElementById('login-error-msg');

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Client-side validation
    if (!email || !password) {
      errMsg.textContent = 'Please fill in all fields.';
      errWrap.classList.remove('hidden');
      return;
    }

    setLoading(btn, true, 'Signing in...');
    errWrap.classList.add('hidden');

    try {
      const data = await Api.post('/api/auth/login', { email, password });
      Storage.set('user', data.user);
      Storage.set('token', data.token);
      showToast('Welcome back!', 'success');
      setTimeout(() => { location.href = 'dashboard.html'; }, 800);
    } catch (err) {
      // Distinguish network errors from API errors
      const msg = err.message.startsWith('Failed to fetch')
        ? 'Cannot reach the server. Make sure Flask is running on port 5000.'
        : (err.message || 'Invalid email or password.');
      errMsg.textContent = msg;
      errWrap.classList.remove('hidden');
      setLoading(btn, false, 'Sign In');
    }
  });
}

// ─── Register form ────────────────────────────────────────────────────────────

const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn     = document.getElementById('register-btn');
    const errWrap = document.getElementById('register-error');
    const errMsg  = document.getElementById('register-error-msg');

    const firstName = document.getElementById('first-name').value.trim();
    const username  = document.getElementById('username').value.trim();
    const email     = document.getElementById('email').value.trim();
    const password  = document.getElementById('password').value;
    const confirm   = document.getElementById('confirm-password').value;
    const terms     = document.getElementById('terms').checked;

    errWrap.classList.add('hidden');

    if (!firstName || !username || !email || !password) {
      errMsg.textContent = 'Please fill in all required fields.';
      errWrap.classList.remove('hidden'); return;
    }
    if (password !== confirm) {
      errMsg.textContent = 'Passwords do not match.';
      errWrap.classList.remove('hidden'); return;
    }
    if (password.length < 8) {
      errMsg.textContent = 'Password must be at least 8 characters.';
      errWrap.classList.remove('hidden'); return;
    }
    if (!terms) {
      errMsg.textContent = 'You must accept the Terms of Service.';
      errWrap.classList.remove('hidden'); return;
    }

    setLoading(btn, true, 'Creating account...');

    try {
      const data = await Api.post('/api/auth/register', {
        first_name: firstName,
        username, email, password
      });
      Storage.set('user', data.user);
      Storage.set('token', data.token);
      showToast('Account created! Welcome 🎉', 'success');
      setTimeout(() => { location.href = 'judge.html'; }, 800);
    } catch (err) {
      const msg = err.message.startsWith('Failed to fetch')
        ? 'Cannot reach the server. Make sure Flask is running on port 5000.'
        : (err.message || 'Registration failed. Try again.');
      errMsg.textContent = msg;
      errWrap.classList.remove('hidden');
      setLoading(btn, false, 'Create Account');
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<div class="spinner" style="margin:0 auto;"></div>`
    : text;
}
