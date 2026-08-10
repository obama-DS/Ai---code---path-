/**
 * git.js — Git CLI helpers for the auto-commit watcher.
 */
const { execSync } = require('child_process');
const path = require('path');

/**
 * Run a git command synchronously.
 * @param {string} cmd
 * @param {string} cwd
 * @returns {{ code: number, stdout: string, stderr: string }}
 */
function run(cmd, cwd) {
  try {
    const stdout = execSync(cmd, { cwd, encoding: 'utf8', timeout: 15000 }).trim();
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code:   err.status || 1,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || err.message || '').trim(),
    };
  }
}

/**
 * Check if a path is inside a git repository.
 */
function isGitRepo(repoPath) {
  const { code } = run('git rev-parse --is-inside-work-tree', repoPath);
  return code === 0;
}

/**
 * Return true if `filePath` has staged or unstaged changes.
 */
function hasChanges(repoPath, filePath) {
  const rel = path.relative(repoPath, filePath);
  const { stdout } = run(`git status --porcelain "${rel}"`, repoPath);
  return stdout.length > 0;
}

/**
 * Stage a file.
 */
function stageFile(repoPath, filePath) {
  const rel = path.relative(repoPath, filePath);
  const { code, stderr } = run(`git add "${rel}"`, repoPath);
  if (code !== 0) throw new Error(`git add failed: ${stderr}`);
}

/**
 * Create a commit and return the commit hash.
 */
function createCommit(repoPath, message) {
  const { code, stderr } = run(`git commit -m "${message.replace(/"/g, '\\"')}"`, repoPath);
  if (code !== 0) {
    // "nothing to commit" is not a real error
    if (stderr.includes('nothing to commit') || stderr.includes('nothing added')) {
      return null;
    }
    throw new Error(`git commit failed: ${stderr}`);
  }
  const { stdout: hash } = run('git rev-parse HEAD', repoPath);
  return hash;
}

/**
 * Return the diff for a specific file (staged first, then unstaged).
 */
function getDiff(repoPath, filePath) {
  const rel = path.relative(repoPath, filePath);
  let { stdout } = run(`git diff --cached -- "${rel}"`, repoPath);
  if (!stdout) {
    ({ stdout } = run(`git diff -- "${rel}"`, repoPath));
  }
  return stdout;
}

/**
 * Find the root of the git repository containing `startPath`.
 */
function getRepoRoot(startPath) {
  const { code, stdout } = run('git rev-parse --show-toplevel', startPath);
  if (code !== 0) throw new Error(`Not a git repository: ${startPath}`);
  return stdout;
}

module.exports = { isGitRepo, hasChanges, stageFile, createCommit, getDiff, getRepoRoot };
