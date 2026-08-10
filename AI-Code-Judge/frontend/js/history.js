/**
 * history.js — History page logic
 * Renders a sortable, filterable, paginated table of all past judgments.
 * Supports row selection for version comparison and a detail modal.
 */

// ─── State ────────────────────────────────────────────────────────────────────

let allJudgments  = Storage.get('judgments', []);
let filtered      = [...allJudgments];
let sortCol       = 'date';
let sortDir       = 'desc';
let currentPage   = 1;
const PAGE_SIZE   = 15;
let selectedRows  = [];   // stores judgment ids (max 2)
let detailTarget  = null; // id of item shown in detail modal

// ─── Seed demo data if empty ──────────────────────────────────────────────────

if (allJudgments.length === 0) {
  const langs = ['python','javascript','typescript','java','go'];
  const files = ['app.py','index.js','auth.ts','Main.java','main.go','utils.py','api.js'];
  const now   = Date.now();

  for (let i = 19; i >= 0; i--) {
    const lang  = langs[i % langs.length];
    const score = Math.floor(40 + Math.random() * 55);
    const prev  = i < 19 ? allJudgments[allJudgments.length - 1]?.score : null;
    allJudgments.push({
      id: now - i * 3600000,
      file: files[i % files.length],
      language: lang,
      code: `# Demo code for ${files[i % files.length]}\nprint("hello world")`,
      score,
      result: {
        overall_score: score,
        scores: {
          quality:         Math.floor(score / 11),
          readability:     Math.floor(score / 10),
          security:        Math.floor(score / 12),
          performance:     Math.floor(score / 10),
          maintainability: Math.floor(score / 11),
          bug_risk:        Math.floor(score / 10),
        },
        bugs: score < 60
          ? [{ title: 'Missing error handling', severity: 'medium', description: 'Function does not handle exceptions.', line: 3 }]
          : [],
        security_issues: score < 50
          ? [{ title: 'Hardcoded credentials', severity: 'high', description: 'Sensitive value appears in source code.' }]
          : [],
        suggestions: ['Use more descriptive variable names.', 'Add docstrings to functions.'],
        verdict: score >= 70 ? 'Decent work overall. A few things to tighten up.' : 'Several issues need attention before this is production-ready.',
      },
      timestamp: new Date(now - i * 3600000).toISOString(),
    });
  }
  Storage.set('judgments', allJudgments);
  filtered = [...allJudgments];
}

// ─── Filter & Sort ────────────────────────────────────────────────────────────

function applyFilters() {
  const search    = document.getElementById('search-input').value.toLowerCase().trim();
  const langVal   = document.getElementById('lang-filter').value;
  const scoreVal  = document.getElementById('score-filter').value;

  filtered = allJudgments.filter(j => {
    if (search   && !j.file.toLowerCase().includes(search) && !j.language.toLowerCase().includes(search)) return false;
    if (langVal  && j.language !== langVal) return false;
    if (scoreVal === 'high' && j.score < 80)  return false;
    if (scoreVal === 'mid'  && (j.score < 50 || j.score >= 80)) return false;
    if (scoreVal === 'low'  && j.score >= 50) return false;
    return true;
  });

  applySort();
}

function applySort() {
  filtered.sort((a, b) => {
    let av, bv;
    switch (sortCol) {
      case 'file':     av = a.file;      bv = b.file;      break;
      case 'language': av = a.language;  bv = b.language;  break;
      case 'score':    av = a.score;     bv = b.score;     break;
      case 'delta':    av = getDelta(a); bv = getDelta(b); break;
      case 'date':
      default:         av = a.id;        bv = b.id;        break;
    }
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1  : -1;
    return 0;
  });

  currentPage = 1;
  renderTable();
}

function getDelta(j) {
  const idx  = allJudgments.indexOf(j);
  const prev = allJudgments[idx + 1];
  return prev ? j.score - prev.score : 0;
}

// ─── Table rendering ──────────────────────────────────────────────────────────

function renderTable() {
  const tbody   = document.getElementById('history-tbody');
  const empty   = document.getElementById('history-empty');
  const infoEl  = document.getElementById('filter-info');
  const total   = filtered.length;

  // Update info
  if (infoEl) infoEl.textContent = `Showing ${total} result${total !== 1 ? 's' : ''}`;

  if (total === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    renderPagination(0, 0);
    return;
  }

  empty.style.display = 'none';

  const start  = (currentPage - 1) * PAGE_SIZE;
  const end    = Math.min(start + PAGE_SIZE, total);
  const page   = filtered.slice(start, end);

  tbody.innerHTML = '';
  page.forEach((j, relIdx) => {
    const absIdx = allJudgments.indexOf(j);
    const prev   = allJudgments[absIdx + 1];
    const delta  = prev ? j.score - prev.score : null;
    const row    = buildRow(j, delta);
    tbody.appendChild(row);
  });

  renderPagination(total, Math.ceil(total / PAGE_SIZE));
  updateSortHeaders();
}

function buildRow(j, delta) {
  const tr = document.createElement('tr');
  tr.dataset.id = j.id;

  const deltaHtml = delta !== null
    ? `<span class="delta-cell ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'}">${delta > 0 ? '↑ +' : delta < 0 ? '↓ ' : '→ '}${delta}</span>`
    : '<span class="delta-cell same">—</span>';

  const isSelected = selectedRows.includes(j.id);

  tr.innerHTML = `
    <td><input type="checkbox" class="row-check" data-id="${j.id}" ${isSelected ? 'checked' : ''} aria-label="Select row" /></td>
    <td>
      <div class="td-file">
        <div class="file-icon">${langIcon(j.language)}</div>
        <div>
          <div class="file-name">${escapeHtml(j.file)}</div>
          <div class="file-date">${timeAgo(j.timestamp)}</div>
        </div>
      </div>
    </td>
    <td><span class="badge badge-purple">${j.language}</span></td>
    <td><span class="score-cell ${scoreClass(j.score)}">${j.score}</span></td>
    <td>${deltaHtml}</td>
    <td style="color:var(--text-muted);font-size:0.8rem;">${formatDate(j.timestamp)}</td>
    <td>
      <div class="actions-cell">
        <button class="btn btn-ghost btn-sm view-btn" data-id="${j.id}" title="View details">👁 View</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${j.id}" title="Delete">🗑</button>
      </div>
    </td>
  `;

  // Row click → detail modal
  tr.addEventListener('click', e => {
    if (e.target.closest('input') || e.target.closest('button')) return;
    openDetailModal(j.id);
  });

  return tr;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function renderPagination(total, totalPages) {
  const container = document.getElementById('pagination');
  if (!container) return;
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const addBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.className = `page-btn${active ? ' active' : ''}`;
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => { currentPage = page; renderTable(); });
    container.appendChild(btn);
  };

  addBtn('←', currentPage - 1, currentPage === 1);

  // Show up to 5 page numbers around current
  const start = Math.max(1, currentPage - 2);
  const end   = Math.min(totalPages, currentPage + 2);
  if (start > 1) { addBtn('1', 1); if (start > 2) container.insertAdjacentHTML('beforeend', '<span style="padding:0 4px;color:var(--text-muted);">…</span>'); }
  for (let p = start; p <= end; p++) addBtn(p, p, false, p === currentPage);
  if (end < totalPages) { if (end < totalPages - 1) container.insertAdjacentHTML('beforeend', '<span style="padding:0 4px;color:var(--text-muted);">…</span>'); addBtn(totalPages, totalPages); }

  addBtn('→', currentPage + 1, currentPage === totalPages);
}

// ─── Sort headers ─────────────────────────────────────────────────────────────

function updateSortHeaders() {
  document.querySelectorAll('.history-table th.sortable').forEach(th => {
    const col = th.dataset.col;
    th.classList.remove('sort-asc', 'sort-desc');
    const icon = th.querySelector('.sort-icon');
    if (col === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      if (icon) icon.textContent = sortDir === 'asc' ? '↑' : '↓';
    } else {
      if (icon) icon.textContent = '↕';
    }
  });
}

document.querySelectorAll('.history-table th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'desc';
    }
    applyFilters();
  });
});

// ─── Checkbox selection ───────────────────────────────────────────────────────

document.getElementById('history-tbody')?.addEventListener('change', e => {
  const cb = e.target.closest('.row-check');
  if (!cb) return;
  const id = parseInt(cb.dataset.id);

  if (cb.checked) {
    if (selectedRows.length >= 2) {
      cb.checked = false;
      showToast('Select only 2 items to compare.', 'warning');
      return;
    }
    selectedRows.push(id);
  } else {
    selectedRows = selectedRows.filter(x => x !== id);
  }

  updateCompareUI();
});

document.getElementById('select-all')?.addEventListener('change', e => {
  const checked = e.target.checked;
  document.querySelectorAll('.row-check').forEach(cb => {
    cb.checked = checked;
    const id = parseInt(cb.dataset.id);
    if (checked && !selectedRows.includes(id)) selectedRows.push(id);
    if (!checked) selectedRows = [];
  });
  if (selectedRows.length > 2) selectedRows = selectedRows.slice(0, 2);
  updateCompareUI();
});

function updateCompareUI() {
  const btn    = document.getElementById('compare-btn');
  const banner = document.getElementById('compare-banner');

  btn.disabled = selectedRows.length !== 2;

  if (selectedRows.length === 2) {
    banner.classList.remove('hidden');
    const a = allJudgments.find(j => j.id === selectedRows[0]);
    const b = allJudgments.find(j => j.id === selectedRows[1]);
    document.getElementById('compare-a-name').textContent = a?.file || '—';
    document.getElementById('compare-b-name').textContent = b?.file || '—';
  } else {
    banner.classList.add('hidden');
  }
}

// ─── Filters ──────────────────────────────────────────────────────────────────

document.getElementById('search-input')?.addEventListener('input',  applyFilters);
document.getElementById('lang-filter')?.addEventListener('change',  applyFilters);
document.getElementById('score-filter')?.addEventListener('change', applyFilters);
document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
  document.getElementById('search-input').value = '';
  document.getElementById('lang-filter').value  = '';
  document.getElementById('score-filter').value = '';
  applyFilters();
});

// ─── Table delegated actions ──────────────────────────────────────────────────

document.getElementById('history-tbody')?.addEventListener('click', e => {
  const viewBtn = e.target.closest('.view-btn');
  const delBtn  = e.target.closest('.delete-btn');

  if (viewBtn) {
    e.stopPropagation();
    openDetailModal(parseInt(viewBtn.dataset.id));
  }
  if (delBtn) {
    e.stopPropagation();
    deleteJudgment(parseInt(delBtn.dataset.id));
  }
});

function deleteJudgment(id) {
  if (!confirm('Delete this judgment?')) return;
  allJudgments = allJudgments.filter(j => j.id !== id);
  Storage.set('judgments', allJudgments);
  filtered = filtered.filter(j => j.id !== id);
  selectedRows = selectedRows.filter(x => x !== id);
  renderTable();
  updateCompareUI();
  showToast('Judgment deleted.', 'info');
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const detailModal = document.getElementById('detail-modal');

function openDetailModal(id) {
  const j = allJudgments.find(x => x.id === id);
  if (!j) return;
  detailTarget = id;

  const absIdx = allJudgments.indexOf(j);
  const prev   = allJudgments[absIdx + 1];
  const delta  = prev ? j.score - prev.score : null;

  // Header
  document.getElementById('modal-title').textContent = j.file;

  // Score
  const scoreEl = document.getElementById('modal-score');
  scoreEl.textContent    = j.score;
  scoreEl.style.color    = scoreColor(j.score);

  // File + meta
  document.getElementById('modal-file').textContent =
    `${langIcon(j.language)} ${j.file}`;
  document.getElementById('modal-meta').textContent =
    `${j.language} · ${formatDate(j.timestamp)}` +
    (delta !== null ? ` · ${delta >= 0 ? '+' : ''}${delta} vs prev` : '');

  // Verdict short
  const vs = document.getElementById('modal-verdict-short');
  vs.innerHTML = `<span class="badge badge-${scoreClass(j.score) === 'high' ? 'green' : scoreClass(j.score) === 'mid' ? 'yellow' : 'red'}">${scoreLabel(j.score)}</span>`;

  // Breakdown
  const breakdownEl = document.getElementById('modal-breakdown');
  breakdownEl.innerHTML = '';
  const LABELS = {
    quality:'Quality', readability:'Readability', security:'Security',
    performance:'Performance', maintainability:'Maintainability', bug_risk:'Bug Risk',
  };
  Object.entries(LABELS).forEach(([key, lbl]) => {
    const val = j.result?.scores?.[key] ?? 0;
    breakdownEl.appendChild(buildProgressBar(lbl, val, 10));
  });

  // Verdict text
  document.getElementById('modal-verdict').textContent =
    j.result?.verdict || 'No verdict available.';

  // Issues
  const issuesEl = document.getElementById('modal-issues');
  issuesEl.innerHTML = '';
  const issues = [...(j.result?.bugs ?? []), ...(j.result?.security_issues ?? [])];
  if (issues.length === 0) {
    issuesEl.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No issues found.</p>';
  } else {
    issues.forEach(issue => {
      const sev = (issue.severity || 'info').toLowerCase();
      const d   = document.createElement('div');
      d.className = `issue-item severity-${sev}`;
      d.innerHTML = `
        <div class="issue-header">
          <span class="issue-title">${escapeHtml(issue.title || 'Issue')}</span>
          <span class="badge badge-${sevBadgeClass(sev)}">${sev.toUpperCase()}</span>
        </div>
        <div class="issue-body">${escapeHtml(issue.description || '')}</div>
      `;
      issuesEl.appendChild(d);
    });
  }

  // Suggestions
  const sugEl = document.getElementById('modal-suggestions');
  sugEl.innerHTML = '';
  const sugs = j.result?.suggestions ?? [];
  if (sugs.length === 0) {
    sugEl.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No suggestions.</p>';
  } else {
    sugs.forEach(s => {
      const d = document.createElement('div');
      d.className = 'suggestion-item';
      d.textContent = s;
      sugEl.appendChild(d);
    });
  }

  // Code snapshot
  document.getElementById('modal-code').textContent = j.code || 'No code stored.';

  detailModal.classList.add('open');
}

document.getElementById('modal-close')?.addEventListener('click', () => {
  detailModal.classList.remove('open');
});

detailModal?.addEventListener('click', e => {
  if (e.target === detailModal) detailModal.classList.remove('open');
});

document.getElementById('modal-rejudge-btn')?.addEventListener('click', () => {
  const j = allJudgments.find(x => x.id === detailTarget);
  if (!j) return;
  // Store the code for judge page to pick up
  Storage.set('rejudge_code', { code: j.code, language: j.language });
  location.href = 'judge.html';
});

document.getElementById('modal-delete-btn')?.addEventListener('click', () => {
  if (!detailTarget) return;
  detailModal.classList.remove('open');
  deleteJudgment(detailTarget);
});

// ─── Compare Modal ────────────────────────────────────────────────────────────

const compareModal = document.getElementById('compare-modal');

function openCompareModal(idA, idB) {
  const a = allJudgments.find(j => j.id === idA);
  const b = allJudgments.find(j => j.id === idB);
  if (!a || !b) return;

  const body = document.getElementById('compare-body');
  body.innerHTML = '';

  [a, b].forEach(j => {
    const col = document.createElement('div');
    col.innerHTML = `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-family:var(--font-mono);font-size:2rem;font-weight:700;color:${scoreColor(j.score)}">${j.score}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">/ 100</div>
        <div style="font-weight:600;margin-top:6px;">${langIcon(j.language)} ${escapeHtml(j.file)}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${formatDate(j.timestamp)}</div>
      </div>
    `;

    const LABELS = { quality:'Quality', readability:'Readability', security:'Security', performance:'Performance', maintainability:'Maintainability', bug_risk:'Bug Risk' };
    const barsWrap = document.createElement('div');
    barsWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    Object.entries(LABELS).forEach(([key, lbl]) => {
      const val = j.result?.scores?.[key] ?? 0;
      barsWrap.appendChild(buildProgressBar(lbl, val, 10));
    });
    col.appendChild(barsWrap);

    const codeWrap = document.createElement('div');
    codeWrap.style.marginTop = '16px';
    codeWrap.innerHTML = `<div class="modal-section-title" style="margin-bottom:8px;">Code</div>`;
    const pre = document.createElement('pre');
    pre.className = 'modal-code-block';
    pre.style.maxHeight = '160px';
    pre.textContent = j.code || 'No code stored.';
    codeWrap.appendChild(pre);
    col.appendChild(codeWrap);

    body.appendChild(col);
  });

  // Summary
  const diff  = a.score - b.score;
  const sign  = diff >= 0 ? '+' : '';
  const color = diff >= 0 ? 'var(--green)' : 'var(--red)';
  const summary = document.getElementById('compare-summary');
  if (summary) {
    summary.innerHTML = `
      <div style="background:var(--bg-input);border-radius:var(--radius);padding:14px;text-align:center;margin-top:8px;">
        <span style="font-size:0.9rem;color:var(--text-secondary);">${escapeHtml(a.file)} vs ${escapeHtml(b.file)} — </span>
        <span style="font-family:var(--font-mono);font-weight:700;color:${color};">${sign}${diff} points</span>
      </div>
    `;
  }

  compareModal.classList.add('open');
}

document.getElementById('do-compare-btn')?.addEventListener('click', () => {
  if (selectedRows.length !== 2) return;
  openCompareModal(selectedRows[0], selectedRows[1]);
});

document.getElementById('compare-btn')?.addEventListener('click', () => {
  if (selectedRows.length !== 2) return;
  openCompareModal(selectedRows[0], selectedRows[1]);
});

document.getElementById('cancel-compare-btn')?.addEventListener('click', () => {
  selectedRows = [];
  document.querySelectorAll('.row-check').forEach(cb => cb.checked = false);
  document.getElementById('select-all').checked = false;
  updateCompareUI();
  renderTable();
});

document.getElementById('compare-modal-close')?.addEventListener('click', () => {
  compareModal.classList.remove('open');
});

compareModal?.addEventListener('click', e => {
  if (e.target === compareModal) compareModal.classList.remove('open');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sevBadgeClass(sev) {
  return { high: 'red', medium: 'yellow', low: 'blue', info: 'purple' }[sev] || 'purple';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

applyFilters();
