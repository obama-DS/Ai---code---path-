/**
 * judge.js — Code Judge page logic
 * Handles Monaco editor, personality selection, API call, and results rendering.
 */

// ─── State ────────────────────────────────────────────────────────────────────

let monacoEditor    = null;
let selectedPersonality = 'friendly';
let lastResult      = null;

// ─── Monaco Editor setup ──────────────────────────────────────────────────────

const MONACO_LANG_MAP = {
  python: 'python', javascript: 'javascript', typescript: 'typescript',
  java: 'java', cpp: 'cpp', csharp: 'csharp',
  go: 'go', rust: 'rust', php: 'php', ruby: 'ruby',
};

function initMonaco() {
  if (window.MonacoLoadFailed || typeof require === 'undefined') {
    showFallbackTextarea();
    return;
  }

  require.config({
    paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs' }
  });

  require(['vs/editor/editor.main'], () => {
    monacoEditor = monaco.editor.create(
      document.getElementById('monaco-container'),
      {
        value: getDefaultSnippet('python'),
        language: 'python',
        theme: 'vs-dark',
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontLigatures: true,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: 'on',
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: 'line',
        smoothScrolling: true,
      }
    );

    monacoEditor.onDidChangeModelContent(updateEditorStats);
    updateEditorStats();
  });
}

function showFallbackTextarea() {
  document.getElementById('monaco-container').classList.add('hidden');
  const ta = document.getElementById('code-textarea');
  ta.classList.remove('hidden');
  ta.value = getDefaultSnippet('python');
  ta.addEventListener('input', updateEditorStats);
  updateEditorStats();
}

function getCode() {
  if (monacoEditor) return monacoEditor.getValue();
  return document.getElementById('code-textarea').value;
}

function setCode(code) {
  if (monacoEditor) {
    monacoEditor.setValue(code);
  } else {
    document.getElementById('code-textarea').value = code;
  }
  updateEditorStats();
}

function updateEditorStats() {
  const code  = getCode();
  const lines = code.split('\n').length;
  const chars = code.length;
  const el = id => document.getElementById(id);
  if (el('line-count')) el('line-count').textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
  if (el('char-count')) el('char-count').textContent = `${chars} chars`;
}

// ─── Language selector ────────────────────────────────────────────────────────

const langSelect = document.getElementById('language-select');
if (langSelect) {
  langSelect.addEventListener('change', () => {
    const lang    = langSelect.value;
    const display = langSelect.options[langSelect.selectedIndex].text;
    const ext     = LANG_EXTENSIONS[lang] || lang;

    // Update Monaco language
    if (monacoEditor) {
      const model = monacoEditor.getModel();
      monaco.editor.setModelLanguage(model, MONACO_LANG_MAP[lang] || lang);
    }

    // Update filename display
    const fnEl = document.getElementById('editor-filename');
    if (fnEl) fnEl.textContent = `untitled.${ext}`;

    const ldEl = document.getElementById('lang-display');
    if (ldEl) ldEl.textContent = display.replace(/^.\s*/, '');
  });
}

// ─── Clear button ─────────────────────────────────────────────────────────────

document.getElementById('clear-btn')?.addEventListener('click', () => {
  const lang = langSelect?.value || 'python';
  setCode(getDefaultSnippet(lang));
  hideResults();
});

// ─── Personality selector ─────────────────────────────────────────────────────

document.getElementById('personality-grid')?.addEventListener('click', e => {
  const card = e.target.closest('.personality-card');
  if (!card) return;

  document.querySelectorAll('.personality-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  card.classList.add('selected');
  card.setAttribute('aria-pressed', 'true');
  selectedPersonality = card.dataset.personality;
});

// Also support keyboard activation
document.getElementById('personality-grid')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.target.closest('.personality-card')?.click();
  }
});

// ─── Judge button ─────────────────────────────────────────────────────────────

document.getElementById('judge-btn')?.addEventListener('click', runJudge);

async function runJudge() {
  const code     = getCode().trim();
  const language = langSelect?.value || 'python';

  // Validation
  if (!code) {
    showJudgeError('Please enter some code first.');
    return;
  }
  if (code.length > 50000) {
    showJudgeError('Code is too long (max 50,000 characters).');
    return;
  }

  hideJudgeError();
  setJudgeLoading(true);
  hideResults();

  try {
    const result = await Api.post('/api/judge', {
      language,
      code,
      personality: selectedPersonality,
    });

    lastResult = { ...result, language, code, timestamp: new Date().toISOString() };
    renderResults(lastResult);

    // Save to local history
    Storage.push('judgments', {
      id: Date.now(),
      file: `untitled.${LANG_EXTENSIONS[language] || language}`,
      language,
      code: code.slice(0, 2000), // store first 2000 chars
      score: result.overall_score,
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    showJudgeError(`API error: ${err.message}. Make sure the backend is running.`);
  } finally {
    setJudgeLoading(false);
  }
}

// ─── Results rendering ────────────────────────────────────────────────────────

function renderResults(data) {
  const score    = data.overall_score ?? 0;
  const scores   = data.scores        ?? {};
  const bugs     = data.bugs          ?? [];
  const security = data.security_issues ?? [];
  const suggestions = data.suggestions ?? [];
  const verdict  = data.verdict       ?? '';

  // Show/hide panels
  document.getElementById('placeholder-panel').style.display = 'none';
  const panel = document.getElementById('results-panel');
  panel.classList.add('visible');

  // Score ring
  animateScoreRing('score-ring-fill', score);
  document.getElementById('score-num').textContent   = score;
  document.getElementById('score-label').textContent = scoreLabel(score);
  document.getElementById('score-label').style.color = scoreColor(score);

  // Score change vs previous
  const judgments = Storage.get('judgments', []);
  if (judgments.length >= 2) {
    const prev = judgments[1]?.score;
    if (prev !== undefined) {
      const delta = score - prev;
      const wrap  = document.getElementById('score-change-wrap');
      const sign  = delta > 0 ? '+' : '';
      const cls   = delta > 0 ? 'text-green' : delta < 0 ? 'text-red' : 'text-muted';
      wrap.innerHTML = `<span class="badge ${delta >= 0 ? 'badge-green' : 'badge-red'}">${sign}${delta} vs last</span>`;
    }
  }

  // Sub-label
  const subLbl = document.getElementById('score-sublabel');
  if (subLbl) subLbl.textContent = `${selectedPersonality.charAt(0).toUpperCase() + selectedPersonality.slice(1)} mode`;

  // Verdict
  document.getElementById('verdict-text').textContent = verdict;

  // Breakdown
  const breakdownList = document.getElementById('breakdown-list');
  breakdownList.innerHTML = '';
  const BREAKDOWN_LABELS = {
    quality:         'Quality',
    readability:     'Readability',
    security:        'Security',
    performance:     'Performance',
    maintainability: 'Maintainability',
    bug_risk:        'Bug Risk',
  };
  Object.entries(BREAKDOWN_LABELS).forEach(([key, label]) => {
    const val = scores[key] ?? 0;
    breakdownList.appendChild(buildProgressBar(label, val, 10));
  });

  // Issues
  renderIssueList('issues-list', 'issues-count-badge', bugs, 'bug');

  // Security
  renderIssueList('security-list', 'security-badge', security, 'security');
  const secBadge = document.getElementById('security-badge');
  if (security.length === 0) {
    secBadge.textContent = 'Clean';
    secBadge.className   = 'badge badge-green';
  } else {
    secBadge.textContent = `${security.length} issue${security.length !== 1 ? 's' : ''}`;
    secBadge.className   = 'badge badge-red';
  }

  // Suggestions
  const sugList = document.getElementById('suggestion-list');
  sugList.innerHTML = '';
  if (suggestions.length === 0) {
    sugList.innerHTML = '<p class="text-muted" style="font-size:0.85rem">No suggestions. Solid work!</p>';
  } else {
    suggestions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = s;
      sugList.appendChild(item);
    });
  }

  // Scroll results into view on mobile
  if (window.innerWidth < 960) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderIssueList(listId, badgeId, items, type) {
  const list  = document.getElementById(listId);
  const badge = document.getElementById(badgeId);
  list.innerHTML = '';

  if (badge && type === 'bug') {
    badge.textContent = items.length;
    badge.className = items.length > 0 ? 'badge badge-red' : 'badge badge-green';
  }

  if (items.length === 0) {
    list.innerHTML = '<p class="text-muted" style="font-size:0.85rem">None detected.</p>';
    return;
  }

  items.forEach(issue => {
    const div = document.createElement('div');
    const sev = (issue.severity || 'info').toLowerCase();
    div.className = `issue-item severity-${sev}`;
    div.innerHTML = `
      <div class="issue-header">
        <span class="issue-title">${escapeHtml(issue.title || issue.type || 'Issue')}</span>
        <span class="badge badge-${sevBadgeClass(sev)}">${sev.toUpperCase()}</span>
      </div>
      <div class="issue-body">${escapeHtml(issue.description || issue.message || '')}</div>
      ${issue.line ? `<div class="issue-line">Line ${issue.line}</div>` : ''}
    `;
    list.appendChild(div);
  });
}

function sevBadgeClass(sev) {
  return { high: 'red', medium: 'yellow', low: 'blue', info: 'purple' }[sev] || 'purple';
}

// ─── Save button ──────────────────────────────────────────────────────────────

document.getElementById('save-result-btn')?.addEventListener('click', () => {
  if (!lastResult) return;
  showToast('Saved to history!', 'success');
  // In a real app this would POST to /api/history
});

// ─── UI helpers ───────────────────────────────────────────────────────────────

function setJudgeLoading(loading) {
  const btn     = document.getElementById('judge-btn');
  const txt     = document.getElementById('judge-btn-text');
  const spinner = document.getElementById('judge-spinner');
  btn.disabled = loading;
  txt.classList.toggle('hidden', loading);
  spinner.classList.toggle('hidden', !loading);
}

function showJudgeError(msg) {
  const wrap = document.getElementById('judge-error');
  document.getElementById('judge-error-msg').textContent = msg;
  wrap.classList.remove('hidden');
}

function hideJudgeError() {
  document.getElementById('judge-error')?.classList.add('hidden');
}

function hideResults() {
  document.getElementById('results-panel').classList.remove('visible');
  document.getElementById('placeholder-panel').style.display = '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Default code snippets ────────────────────────────────────────────────────

function getDefaultSnippet(lang) {
  const snippets = {
    python: `def calculate_total(items):
    total = 0
    for item in items:
        total = total + item['price'] * item['qty']
    return total

# TODO: add error handling
result = calculate_total([
    {'price': 10, 'qty': 2},
    {'price': 5,  'qty': 4},
])
print(result)
`,
    javascript: `function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].qty;
  }
  return total;
}

// TODO: add input validation
const result = calculateTotal([
  { price: 10, qty: 2 },
  { price: 5,  qty: 4 },
]);
console.log(result);
`,
    typescript: `interface CartItem {
  price: number;
  qty: number;
}

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

const result = calculateTotal([
  { price: 10, qty: 2 },
  { price: 5,  qty: 4 },
]);
console.log(result);
`,
  };
  return snippets[lang] || `// Write your ${lang} code here\n`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

initMonaco();
