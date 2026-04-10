const { spawn } = require('node:child_process');
const ytdlpPath = require('yt-dlp-exec').path;

const YT_DLP_COMMAND_CANDIDATES = [
  { command: ytdlpPath, args: [] },
  { command: 'yt-dlp', args: [] },
  { command: 'python3', args: ['-m', 'yt_dlp'] },
  { command: 'python', args: ['-m', 'yt_dlp'] },
  { command: 'py', args: ['-m', 'yt_dlp'] }
];

/**
 * Runs yt-dlp with a specific command invocation and parses JSON output safely.
 */
function runYtDlpWithCandidate(candidate, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(
      candidate.command,
      [...candidate.args, ...args, '--dump-single-json', '--no-warnings'],
      {
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    process.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${candidate.command} process failed`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('Failed to parse yt-dlp output as JSON.'));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Runs yt-dlp by trying several command candidates (bundled binary, system binary, Python fallback).
 */
async function runYtDlpJson(args) {
  let lastError;

  for (const candidate of YT_DLP_COMMAND_CANDIDATES) {
    try {
      return await runYtDlpWithCandidate(candidate, args);
    } catch (error) {
      lastError = error;

      // For missing command/module, continue trying fallbacks.
      if (
        error.code === 'ENOENT' ||
        /not found|ENOENT|No module named yt_dlp/i.test(error.message)
      ) {
        continue;
      }

      // Command exists but yt-dlp itself failed (private reel/geo/etc) -> stop here.
      throw new Error(error.message);
    }
  }

  throw new Error(
    `Unable to execute yt-dlp. Install or bundle it (yt-dlp executable / python module). Last error: ${lastError?.message || 'unknown error'}`
  );
}
