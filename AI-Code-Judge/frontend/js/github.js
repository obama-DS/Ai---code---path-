/**
 * github.js — GitHub repository analysis page logic.
 */

const analyseBtn  = document.getElementById('analyse-btn');
const repoUrlInput = document.getElementById('repo-url');
let distChart = null;

// ─── Analyse button ───────────────────────────────────────────────────────────

analyseBtn?.addEventListener('click', runAnalysis);
repoUrlInput?.addEventListener('keydown', e => { if (e.key === 'Enter') runAnalysis(); });

async function runAnalysis() {
  const url = repoUrlInput.value.trim();
  if (!url) { showError('Please enter a GitHub repository URL.'); return; }

  hideError();
  setLoading(true, 'Fetching repository…');
  hide('results-wrap');

  try {
    setLoadingMsg('Analysing files… this may take a moment.');
    const result = await Api.post('/api/github/analyse', { url });
    renderResults(result);
  } catch (err) {
    showError(err.message || 'Analysis failed. Make sure the repo is public.');
  } finally {
    setLoading(false);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderResults(data) {
  // Repo summary
  el('repo-name').textContent   = data.repo || '—';
  el('repo-desc').textContent   = data.description || 'No description.';
  el('repo-stars').textContent  = (data.stars || 0).toLocaleString();
  el('repo-lang').textContent   = data.language || '—';
  el('repo-files').textContent  = data.files_analysed || 0;
  el('repo-branch').textContent = data.default_branch || 'main';

  const score    = data.repo_score ?? 0;
  const scoreEl  = el('repo-score-num');
  scoreEl.textContent  = score;
  scoreEl.style.color  = scoreColor(score);

  el('repo-score-badge').innerHTML =
    `<span class="badge badge-${scoreClass(score) === 'high' ? 'green' : scoreClass(score) === 'mid' ? 'yellow' : 'red'}">${scoreLabel(score)}</span>`;

  // File list
  const files   = data.file_results || [];
  const fileList = el('file-list');
  fileList.innerHTML = '';
  el('file-count-badge').textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;

  files.forEach(f => {
    const item = document.createElement('div');
    item.className = `file-item score-${scoreClass(f.score)}`;
    item.innerHTML = `
      <span class="file-lang">${langIcon(f.language)}</span>
      <span class="file-path">${escapeHtml(f.path)}</span>
      <span class="file-score" style="color:${scoreColor(f.score)}">${f.score}</span>
      <span class="badge badge-${scoreClass(f.score) === 'high' ? 'green' : scoreClass(f.score) === 'mid' ? 'yellow' : 'red'}" style="font-size:0.7rem;">/100</span>
    `;
    fileList.appendChild(item);
  });

  // Top issues
  const topList = el('top-issues-list');
  topList.innerHTML = '';
  (data.top_issues || []).forEach(issue => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:space-between;padding:7px 10px;background:var(--bg-input);border-radius:var(--radius);font-size:0.83rem;';
    d.innerHTML = `<span style="color:var(--text-secondary)">${escapeHtml(issue.title)}</span><span class="mono" style="color:var(--text-muted)">${issue.count}×</span>`;
    topList.appendChild(d);
  });
  if (!data.top_issues?.length) {
    topList.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No recurring issues detected.</p>';
  }

  // Language breakdown
  renderLangBreakdown(data.languages || {});

  // Score distribution chart
  renderDistChart(files);

  // Category averages
  renderCategoryAverages(files);

  show('results-wrap');
}

function renderLangBreakdown(langs) {
  const container = el('lang-breakdown');
  container.innerHTML = '';
  const entries = Object.entries(langs).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;

  entries.forEach(([lang, count], i) => {
    const color = LANG_COLORS[i % LANG_COLORS.length];
    const pct   = Math.round((count / max) * 100);
    const row   = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    row.innerHTML = `
      <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></div>
      <span style="font-size:0.85rem;color:var(--text-secondary);flex:1;">${langIcon(lang)} ${lang}</span>
      <div style="flex:2;height:5px;background:var(--border);border-radius:2px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;"></div>
      </div>
      <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-muted);min-width:20px;text-align:right;">${count}</span>
    `;
    container.appendChild(row);
  });
  if (!entries.length) container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No language data.</p>';
}

function renderDistChart(files) {
  const canvas = document.getElementById('dist-chart');
  if (!canvas || !files.length) return;

  const buckets = { '0-49': 0, '50-64': 0, '65-79': 0, '80-89': 0, '90-100': 0 };
  files.forEach(f => {
    if (f.score < 50)       buckets['0-49']++;
    else if (f.score < 65)  buckets['50-64']++;
    else if (f.score < 80)  buckets['65-79']++;
    else if (f.score < 90)  buckets['80-89']++;
    else                    buckets['90-100']++;
  });

  if (distChart) distChart.destroy();
  distChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        label: 'Files',
        data:  Object.values(buckets),
        backgroundColor: [
          'rgba(255,77,109,0.7)', 'rgba(255,209,102,0.7)', 'rgba(56,189,248,0.7)',
          'rgba(108,99,255,0.7)', 'rgba(34,211,160,0.7)',
        ],
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#2a2a3a' }, ticks: { color: '#55556a' } },
        y: { grid: { color: '#2a2a3a' }, ticks: { color: '#55556a', stepSize: 1 } }
      }
    }
  });
}

function renderCategoryAverages(files) {
  const container = el('cat-breakdown');
  container.innerHTML = '';
  if (!files.length) return;

  const keys   = ['quality','readability','security','performance','maintainability','bug_risk'];
  const labels = ['Quality','Readability','Security','Performance','Maintainability','Bug Risk'];

  keys.forEach((key, i) => {
    const vals = files.map(f => f.scores?.[key] ?? 0).filter(v => v !== undefined);
    const avg  = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
    container.appendChild(buildProgressBar(labels[i], avg, 10));
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function el(id)         { return document.getElementById(id); }
function show(id)       { el(id)?.classList.remove('hidden'); }
function hide(id)       { el(id)?.classList.add('hidden'); }

function setLoading(on, msg = '') {
  analyseBtn.disabled = on;
  analyseBtn.innerHTML = on
    ? '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Analysing…'
    : '🔍 Analyse Repository';
  el('loading-wrap').classList.toggle('hidden', !on);
  if (msg) setLoadingMsg(msg);
}

function setLoadingMsg(msg) {
  const m = el('loading-msg');
  if (m) m.textContent = msg;
}

function showError(msg) {
  el('analyse-error-msg').textContent = msg;
  el('analyse-error').classList.remove('hidden');
}

function hideError() {
  el('analyse-error')?.classList.add('hidden');
}
