/**
 * config.js — Auto-commit watcher configuration.
 * Values are read from .env in the project root.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

module.exports = {
  // Milliseconds to wait after the last save before committing
  commitDelay: parseInt(process.env.COMMIT_DELAY || '2000', 10),

  // Whether to automatically commit on save
  autoCommit: process.env.AUTO_COMMIT !== 'false',

  // Whether to send the commit to the AI judge automatically
  autoJudge: process.env.AUTO_JUDGE !== 'false',

  // Flask API base URL
  apiBase: process.env.API_BASE || 'http://127.0.0.1:5000',

  // Paths to watch (comma-separated in .env, or default to cwd)
  watchPaths: (process.env.WATCH_PATHS || '.').split(',').map(p => p.trim()),

  // Patterns to ignore
  ignored: [
    /(^|[/\\])\../,          // dot-files
    /node_modules/,
    /\.venv/,
    /__pycache__/,
    /\.git/,
    /\.env/,
    /\.db$/,
    /\.sqlite/,
    /\.log$/,
    /\.pyc$/,
  ],

  // File extensions that trigger a judgment
  judgeExtensions: new Set([
    '.py', '.js', '.ts', '.java', '.cpp', '.cs', '.go', '.rs', '.php', '.rb',
  ]),

  // Language map: extension → language name
  extensionToLanguage: {
    '.py':   'python',
    '.js':   'javascript',
    '.ts':   'typescript',
    '.java': 'java',
    '.cpp':  'cpp',
    '.cs':   'csharp',
    '.go':   'go',
    '.rs':   'rust',
    '.php':  'php',
    '.rb':   'ruby',
  },

  // Default AI personality for auto-judging
  personality: process.env.AUTO_JUDGE_PERSONALITY || 'professional',
};
