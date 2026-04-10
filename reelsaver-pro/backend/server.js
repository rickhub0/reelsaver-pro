const express = require('express');
const cors = require('cors');
const { analyzeReel, resolveDownload } = require('./utils/ytdlp');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

/**
 * Normalizes and validates instagram reel URL.
 */
function normalizeAndValidateInstagramUrl(rawUrl) {
  if (!rawUrl) return null;
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  try {
    const parsed = new URL(withProtocol);
    const normalized = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
    if (!/^https:\/\/(www\.)?instagram\.com\/(reel|reels)\//i.test(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Basic health endpoint for local checks.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Analyzes a reel URL and returns media metadata + recommended formats.
 */
app.post('/analyze', async (req, res) => {
  try {
    const url = normalizeAndValidateInstagramUrl(req.body?.url);
    if (!url) {
      return res.status(400).json({ status: 'error', message: 'Invalid Instagram reel URL.' });
    }

    const result = await analyzeReel(url);
    return res.json({ status: 'success', ...result });
  } catch (error) {
    return res.status(422).json({
      status: 'error',
      message: `Unable to analyze reel. ${error.message}`
    });
  }
});

/**
 * Resolves direct downloadable media URL for requested type and quality.
 */
app.post('/download', async (req, res) => {
  try {
    const url = normalizeAndValidateInstagramUrl(req.body?.url);
    const { type = 'video', quality = 'best' } = req.body || {};

    if (!url) {
      return res.status(400).json({ status: 'error', message: 'Invalid Instagram reel URL.' });
    }

    if (!['video', 'audio'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Type must be video or audio.' });
    }

    if (!['best', '720p', '480p'].includes(quality)) {
      return res.status(400).json({ status: 'error', message: 'Unsupported quality option.' });
    }

    const result = await resolveDownload(url, type, quality);

    return res.json({
      status: 'success',
      type,
      quality,
      ...result
    });
  } catch (error) {
    return res.status(422).json({
      status: 'error',
      message: `Unable to resolve download URL. ${error.message}`
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ReelSaver Pro API listening on http://localhost:${PORT}`);
});
