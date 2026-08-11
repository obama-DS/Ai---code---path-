/**
 * dashboard.js — Dashboard page logic
 * Reads judgment history from localStorage and renders stats, charts, and heatmap.
 */

// ─── Load data ────────────────────────────────────────────────────────────────

const judgments = Storage.get('judgments', []);

// ─── Stats cards ─────────────────────────────────────────────────────────────

function renderStats() {
  const total = judgments.length;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-total-change').textContent =
    total === 0 ? 'No judgments yet' : `${total} judgment${total !== 1 ? 's' : ''} total`;

  if (total === 0) return;

  const scores  = judgments.map(j => j.score);
  const avg     = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const best    = Math.max(...scores);
  const worst   = Math.min(...scores);
  const bestJ   = judgments.find(j => j.score === best);
  const worstJ  = judgments.find(j => j.score === worst);

  document.getElementById('stat-avg').textContent   = avg;
  document.getElementById('stat-best').textContent  = best;
  document.getElementById('stat-worst').textContent = worst;

  // Trend: compare first half vs second half
  if (scores.length >= 4) {
    const half    = Math.floor(scores.length / 2);
    const recent  = scores.slice(0, half);
    const older   = scores.slice(half);
    const rAvg    = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
    const oAvg    = Math.round(older.reduce((a, b) => a + b, 0) / older.length);
    const diff    = rAvg - oAvg;
    const sign    = diff >= 0 ? '+' : '';
    const cls     = diff >= 0 ? 'positive' : 'negative';
    document.getElementById('stat-avg-change').innerHTML =
      `<span class="${cls}">${sign}${diff} vs earlier</span>`;
  } else {
    document.getElementById('stat-avg-change').textContent = 'Need more data';
  }

  if (bestJ) {
    document.getElementById('stat-best-lang').textContent =
      `${langIcon(bestJ.language)} ${bestJ.file}`;
  }
  if (worstJ) {
    document.getElementById('stat-worst-lang').textContent =
      `${langIcon(worstJ.language)} ${worstJ.file}`;
  }

  // Improvement banner
  if (scores.length >= 2) {
    const latest = scores[0];
    const prev   = scores[1];
    const delta  = latest - prev;
    const bannerMsg   = document.getElementById('banner-msg');
    const bannerScore = document.getElementById('banner-score');
    bannerScore.textContent = `${latest}/100`;
    bannerScore.style.color = scoreColor(latest);
    if (delta > 0) {
      bannerMsg.textContent = `Your last score improved by +${delta} points. Keep going!`;
    } else if (delta < 0) {
      bannerMsg.textContent = `Your last score dropped by ${delta}. Check the suggestions.`;
    } else {
      bannerMsg.textContent = `Your score is holding steady at ${latest}. Push for higher!`;
    }
  }
}

// ─── Score over time chart ────────────────────────────────────────────────────

let scoreChart = null;
let activeRange = 7;

function buildScoreChartData(rangeDays) {
  let data = [...judgments].reverse(); // oldest first
  if (rangeDays !== 'all') {
    const cutoff = Date.now() - rangeDays * 86400000;
    data = data.filter(j => new Date(j.timestamp).getTime() >= cutoff);
  }
  return {
    labels: data.map(j => timeAgo(j.timestamp)),
    scores: data.map(j => j.score),
  };
}

function initScoreChart(rangeDays = 7) {
  const canvas = document.getElementById('score-chart');
  if (!canvas) return;

  const { labels, scores } = buildScoreChartData(rangeDays);

  const gradient = canvas.getContext('2d').createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0,   'rgba(108,99,255,0.35)');
  gradient.addColorStop(1,   'rgba(108,99,255,0)');

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Score',
        data: scores,
        borderColor: 'rgba(108,99,255,1)',
        backgroundColor: gradient,
        borderWidth: 2,
        pointBackgroundColor: scores.map(s => scoreColor(s)),
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a24',
          borderColor: '#2a2a3a',
          borderWidth: 1,
          titleColor: '#f0f0f8',
          bodyColor: '#8888aa',
          callbacks: {
            label: ctx => ` Score: ${ctx.parsed.y}/100`,
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#2a2a3a' },
          ticks: { color: '#55556a', maxTicksLimit: 8 }
        },
        y: {
          min: 0, max: 100,
          grid: { color: '#2a2a3a' },
          ticks: { color: '#55556a', stepSize: 20 }
        }
      }
    }
  };

  if (scoreChart) {
    scoreChart.data.labels   = labels;
    scoreChart.data.datasets[0].data = scores;
    scoreChart.update();
  } else {
    scoreChart = new Chart(canvas, config);
  }
}

// Chart tab switching
document.querySelectorAll('.chart-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const range = btn.dataset.range === 'all' ? 'all' : parseInt(btn.dataset.range);
    initScoreChart(range);
  });
});

// ─── Category averages chart ──────────────────────────────────────────────────

function initCategoryChart() {
  const canvas = document.getElementById('category-chart');
  if (!canvas || judgments.length === 0) return;

  const keys   = ['quality','readability','security','performance','maintainability','bug_risk'];
  const labels = ['Quality','Readability','Security','Performance','Maintainability','Bug Risk'];

  const avgs = keys.map(key => {
    const vals = judgments
      .map(j => j.result?.scores?.[key])
      .filter(v => v !== undefined);
    if (!vals.length) return 0;
    return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  });

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Score',
        data: avgs,
        backgroundColor: 'rgba(108,99,255,0.7)',
        borderColor:     'rgba(108,99,255,1)',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#2a2a3a' }, ticks: { color: '#55556a' } },
        y: {
          min: 0, max: 10,
          grid: { color: '#2a2a3a' },
          ticks: { color: '#55556a', stepSize: 2 }
        }
      }
    }
  });
}

// ─── Recent history feed ──────────────────────────────────────────────────────

function renderRecentHistory() {
  const container = document.getElementById('recent-history');
  if (!container) return;

  const recent = judgments.slice(0, 8);
  if (recent.length === 0) return;

  container.innerHTML = '';
  recent.forEach((j, idx) => {
    const prev  = judgments[idx + 1];
    const delta = prev ? j.score - prev.score : null;
    const item  = buildHistoryItem(j, delta);
    container.appendChild(item);
  });
}

function buildHistoryItem(j, delta) {
  const wrap = document.createElement('a');
  wrap.className  = 'history-item';
  wrap.href       = 'history.html';

  const deltaHtml = delta !== null
    ? `<span class="hi-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'}">${delta > 0 ? '+' : ''}${delta}</span>`
    : '';

  wrap.innerHTML = `
    <div class="hi-icon">${langIcon(j.language)}</div>
    <div class="hi-body">
      <div class="hi-name">${escapeHtml(j.file)}</div>
      <div class="hi-meta">${timeAgo(j.timestamp)}</div>
    </div>
    <span class="hi-score" style="color:${scoreColor(j.score)}">${j.score}</span>
    ${deltaHtml}
  `;
  return wrap;
}

// ─── Language breakdown ───────────────────────────────────────────────────────

function renderLanguageStats() {
  const container = document.getElementById('lang-list');
  if (!container || judgments.length === 0) return;

  const counts = {};
  judgments.forEach(j => {
    const lang = j.language || 'unknown';
    counts[lang] = (counts[lang] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max    = sorted[0][1];

  container.innerHTML = '';
  sorted.forEach(([lang, count], i) => {
    const pct = Math.round((count / max) * 100);
    const color = LANG_COLORS[i % LANG_COLORS.length];
    const row = document.createElement('div');
    row.className = 'lang-item';
    row.innerHTML = `
      <div class="lang-dot" style="background:${color}"></div>
      <span class="lang-name">${langIcon(lang)} ${lang}</span>
      <div class="lang-bar-wrap">
        <div class="lang-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="lang-count">${count}</span>
    `;
    container.appendChild(row);
  });

  // Insights
  const insLang = document.getElementById('insight-lang');
  if (insLang && sorted.length) insLang.textContent = sorted[0][0];
}

// ─── Common problems ──────────────────────────────────────────────────────────

function renderCommonProblems() {
  const container = document.getElementById('problem-list');
  if (!container || judgments.length === 0) return;

  const counts = {};
  judgments.forEach(j => {
    const issues = [
      ...(j.result?.bugs            ?? []),
      ...(j.result?.security_issues ?? []),
    ];
    issues.forEach(issue => {
      const key = issue.title || issue.type || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  if (sorted.length === 0) return;

  container.innerHTML = '';
  sorted.forEach(([name, count]) => {
    const item = document.createElement('div');
    item.className = 'problem-item';
    item.innerHTML = `
      <span class="problem-name">${escapeHtml(name)}</span>
      <span class="problem-count">${count}×</span>
    `;
    container.appendChild(item);
  });
}

// ─── Insights sidebar ─────────────────────────────────────────────────────────

function renderInsights() {
  if (judgments.length === 0) return;

  const allBugs = judgments.reduce((sum, j) => sum + (j.result?.bugs?.length ?? 0), 0);
  const allSec  = judgments.reduce((sum, j) => sum + (j.result?.security_issues?.length ?? 0), 0);
  const allSug  = judgments.reduce((sum, j) => sum + (j.result?.suggestions?.length ?? 0), 0);

  const el = id => document.getElementById(id);
  if (el('insight-bugs'))        el('insight-bugs').textContent        = allBugs;
  if (el('insight-security'))    el('insight-security').textContent    = allSec;
  if (el('insight-suggestions')) el('insight-suggestions').textContent = allSug;

  // Trend
  if (judgments.length >= 3) {
    const recent = judgments[0].score;
    const older  = judgments[2].score;
    const diff   = recent - older;
    const trendEl = el('insight-trend');
    if (trendEl) {
      trendEl.textContent = diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '→ Stable';
      trendEl.style.color = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)';
    }
  }
}

// ─── Activity heatmap ─────────────────────────────────────────────────────────

function renderHeatmap() {
  const container = document.getElementById('heatmap-grid');
  if (!container) return;

  // Build a map: YYYY-MM-DD -> count
  const activityMap = {};
  judgments.forEach(j => {
    const day = new Date(j.timestamp).toISOString().split('T')[0];
    activityMap[day] = (activityMap[day] || 0) + 1;
  });

  // Generate 91 days (13 weeks) ending today
  const cells = 91;
  const today = new Date();
  container.innerHTML = '';

  for (let i = cells - 1; i >= 0; i--) {
    const d   = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const cnt = activityMap[key] || 0;
    const lvl = cnt === 0 ? 0 : cnt === 1 ? 1 : cnt <= 3 ? 2 : cnt <= 5 ? 3 : 4;

    const cell = document.createElement('div');
    cell.className = `heatmap-cell${lvl > 0 ? ` level-${lvl}` : ''}`;
    cell.title     = `${key}: ${cnt} judgment${cnt !== 1 ? 's' : ''}`;
    container.appendChild(cell);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if (Auth.requireLogin()) {
  renderStats();
  initScoreChart(7);
  initCategoryChart();
  renderRecentHistory();
  renderLanguageStats();
  renderCommonProblems();
  renderInsights();
  renderHeatmap();
}
