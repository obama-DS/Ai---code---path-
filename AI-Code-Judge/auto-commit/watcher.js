/**
 * watcher.js — File watcher that auto-commits saves and optionally sends
 *              the changed file to the AI Code Judge API.
 *
 * Usage:
 *   node auto-commit/watcher.js
 *   node auto-commit/watcher.js /path/to/project
 */
'use strict';

const path    = require('path');
const fs      = require('fs');
const chokidar = require('chokidar');
const axios   = require('axios');
const cfg     = require('./config');
const git     = require('./git');

// ─── Resolve watch root ───────────────────────────────────────────────────────

const watchRoot = path.resolve(process.argv[2] || cfg.watchPaths[0] || process.cwd());

if (!git.isGitRepo(watchRoot)) {
  console.error(`[Watcher] ERROR: ${watchRoot} is not inside a git repository.`);
  console.error('[Watcher] Run "git init" first.');
  process.exit(1);
}

const repoRoot = git.getRepoRoot(watchRoot);
console.log(`[Watcher] Watching: ${watchRoot}`);
console.log(`[Watcher] Repo root: ${repoRoot}`);
console.log(`[Watcher] Auto-commit: ${cfg.autoCommit}  |  Auto-judge: ${cfg.autoJudge}`);
console.log('[Watcher] Ready. Save a file to trigger.\n');

// ─── Debounce map: filePath → timer ──────────────────────────────────────────

const timers = new Map();

// ─── Watcher setup ────────────────────────────────────────────────────────────

const watcher = chokidar.watch(watchRoot, {
  ignored:        cfg.ignored,
  persistent:     true,
  ignoreInitial:  true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval:       100,
  },
});

watcher.on('change', filePath => {
  // Clear existing debounce timer for this file
  if (timers.has(filePath)) clearTimeout(timers.get(filePath));

  const timer = setTimeout(() => {
    timers.delete(filePath);
    handleChange(filePath);
  }, cfg.commitDelay);

  timers.set(filePath, timer);
});

watcher.on('error', err => console.error('[Watcher] Error:', err));

// ─── Handle a file change ─────────────────────────────────────────────────────

async function handleChange(filePath) {
  const relPath = path.relative(repoRoot, filePath);
  const ext     = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  console.log(`\n[Watcher] Changed: ${relPath}`);

  // ── Auto-commit ────────────────────────────────────────────────────────────
  let commitHash = null;
  if (cfg.autoCommit) {
    try {
      if (!git.hasChanges(repoRoot, filePath)) {
        console.log('[Watcher] No changes detected — skipping commit.');
        return;
      }

      git.stageFile(repoRoot, filePath);

      const timestamp = new Date().toLocaleTimeString();
      const message   = `Auto: ${relPath} [${timestamp}]`;
      commitHash = git.createCommit(repoRoot, message);

      if (!commitHash) {
        console.log('[Watcher] Nothing to commit.');
        return;
      }

      console.log(`[Watcher] Committed: ${commitHash.slice(0, 8)}  "${message}"`);
    } catch (err) {
      console.error('[Watcher] Git error:', err.message);
      return;
    }
  }

  // ── Auto-judge ────────────────────────────────────────────────────────────
  if (cfg.autoJudge && cfg.judgeExtensions.has(ext)) {
    const language = cfg.extensionToLanguage[ext];
    if (!language) return;

    let code;
    try {
      code = fs.readFileSync(filePath, 'utf8');
    } catch {
      console.error('[Watcher] Could not read file for judging.');
      return;
    }

    if (code.length > 50_000) {
      console.log('[Watcher] File too large for judging (>50k chars). Skipping.');
      return;
    }

    console.log(`[Watcher] Sending to AI Judge (${language}, ${cfg.personality})...`);

    try {
      const judgeRes = await axios.post(
        `${cfg.apiBase}/api/judge`,
        { language, code, personality: cfg.personality },
        { timeout: 30_000 }
      );

      const { overall_score: score, verdict, judgment_id } = judgeRes.data;
      console.log(`[Watcher] Score: ${score}/100`);
      console.log(`[Watcher] Verdict: ${verdict}`);

      // Record the commit + judgment in the DB
      if (commitHash) {
        await axios.post(
          `${cfg.apiBase}/api/history/commit`,
          {
            file_name:      relPath,
            commit_hash:    commitHash,
            commit_message: `Auto: ${relPath}`,
            language,
            score,
            judgment_id,
          },
          { timeout: 10_000 }
        ).catch(() => {}); // non-fatal
      }

    } catch (err) {
      if (err.response) {
        console.error(`[Watcher] Judge API error ${err.response.status}:`, err.response.data?.error || '');
      } else {
        console.error('[Watcher] Judge API unreachable — is Flask running?');
      }
    }
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGINT',  () => { watcher.close(); process.exit(0); });
process.on('SIGTERM', () => { watcher.close(); process.exit(0); });
