const { spawn } = require('node:child_process');

const YT_DLP_COMMAND_CANDIDATES = [
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
 * Runs yt-dlp by trying several command candidates (binary and Python module fallback).
 */
async function runYtDlpJson(args) {
  let lastError;

  for (const candidate of YT_DLP_COMMAND_CANDIDATES) {
    try {
      return await runYtDlpWithCandidate(candidate, args);
    } catch (error) {
      lastError = error;

      // For missing command, continue trying fallbacks.
      if (error.code === 'ENOENT' || /not found|ENOENT/i.test(error.message)) {
        continue;
      }

      // Command exists but yt-dlp itself failed (private reel/geo/etc) -> stop here.
      throw new Error(error.message);
    }
  }

  throw new Error(
    `Unable to execute yt-dlp. Install it using one of: 'yt-dlp', 'python -m pip install yt-dlp', or ensure it is in PATH. Last error: ${lastError?.message || 'unknown error'}`
  );
}

/**
 * Selects best-matching video format based on requested quality.
 */
function pickVideoFormat(formats, quality) {
  const videoOnly = formats.filter(
    (item) => item.vcodec !== 'none' && item.protocol !== 'm3u8_native' && item.url
  );

  if (!videoOnly.length) return null;

  const normalized = quality === 'best' ? Infinity : Number.parseInt(quality, 10);

  if (!Number.isFinite(normalized)) {
    return videoOnly.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  }

  const eligible = videoOnly
    .filter((item) => (item.height || 0) <= normalized)
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  return eligible[0] || videoOnly.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
}

/**
 * Selects best audio format URL.
 */
function pickAudioFormat(formats) {
  const audioOnly = formats
    .filter((item) => item.acodec !== 'none' && item.vcodec === 'none' && item.url)
    .sort((a, b) => (b.abr || 0) - (a.abr || 0));

  return audioOnly[0] || null;
}

/**
 * Analyzes an Instagram reel URL and returns normalized metadata.
 */
async function analyzeReel(url) {
  const data = await runYtDlpJson([url]);
  const formats = data.formats || [];

  const bestVideo = pickVideoFormat(formats, 'best');
  const bestAudio = pickAudioFormat(formats);

  return {
    title: data.title || 'Instagram Reel',
    duration: data.duration || null,
    thumbnail: data.thumbnail || null,
    formats: [
      ...(bestVideo
        ? [
            {
              type: 'video',
              quality: bestVideo.height ? `${bestVideo.height}p` : 'best',
              ext: bestVideo.ext || 'mp4',
              url: bestVideo.url
            }
          ]
        : []),
      ...(bestAudio
        ? [
            {
              type: 'audio',
              quality: 'mp3',
              ext: 'mp3',
              url: bestAudio.url
            }
          ]
        : [])
    ]
  };
}

/**
 * Resolves download URL and extension by download type and requested quality.
 */
async function resolveDownload(url, type, quality) {
  const data = await runYtDlpJson([url]);
  const formats = data.formats || [];

  if (type === 'audio') {
    const audio = pickAudioFormat(formats);
    if (!audio) throw new Error('No audio stream found for this reel.');
    return {
      downloadUrl: audio.url,
      ext: 'mp3'
    };
  }

  const selectedVideo = pickVideoFormat(formats, quality);
  if (!selectedVideo) {
    throw new Error('No video stream found for this reel.');
  }

  return {
    downloadUrl: selectedVideo.url,
    ext: selectedVideo.ext || 'mp4'
  };
}

module.exports = {
  analyzeReel,
  resolveDownload
};
