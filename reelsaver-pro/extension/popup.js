const HISTORY_KEY = 'reelsaver_history';
const SETTINGS_KEY = 'reelsaver_settings';
const DEFAULT_API_BASE = 'http://localhost:4000';

const state = {
  currentUrl: '',
  analysis: null,
  activeTabReelUrl: '',
  apiBase: DEFAULT_API_BASE,
  autoDetectEnabled: true
};

const el = {
  reelUrl: document.getElementById('reelUrl'),
  fetchBtn: document.getElementById('fetchBtn'),
  detectBtn: document.getElementById('detectBtn'),
  autoDetectToggle: document.getElementById('autoDetectToggle'),
  tabHint: document.getElementById('tabHint'),
  apiHostLabel: document.getElementById('apiHostLabel'),
  videoToggle: document.getElementById('videoToggle'),
  audioToggle: document.getElementById('audioToggle'),
  qualitySelect: document.getElementById('qualitySelect'),
  downloadBtn: document.getElementById('downloadBtn'),
  historyList: document.getElementById('historyList'),
  previewCard: document.getElementById('previewCard'),
  thumb: document.getElementById('thumb'),
  title: document.getElementById('title'),
  duration: document.getElementById('duration'),
  videoPreview: document.getElementById('videoPreview'),
  loader: document.getElementById('loader'),
  errorMsg: document.getElementById('errorMsg'),
  statusBadge: document.getElementById('statusBadge')
};

/**
 * Bootstraps popup state and wire events.
 */
async function init() {
  bindEvents();
  loadSettings();
  renderHistory();
  await detectReelFromCurrentTab();
}

/**
 * Registers UI handlers.
 */
function bindEvents() {
  el.fetchBtn.addEventListener('click', onFetchByUrl);
  el.detectBtn.addEventListener('click', onAutoDetectDownload);
  el.downloadBtn.addEventListener('click', onDownload);
  el.videoToggle.addEventListener('change', onTypeToggleChanged);
  el.audioToggle.addEventListener('change', onTypeToggleChanged);
  el.autoDetectToggle.addEventListener('change', onAutoDetectToggleChanged);
}

/**
 * Loads persisted settings from local storage.
 */
function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const settings = raw ? JSON.parse(raw) : {};

  state.apiBase = settings.apiBase || DEFAULT_API_BASE;
  state.autoDetectEnabled = settings.autoDetectEnabled ?? true;
  el.autoDetectToggle.checked = state.autoDetectEnabled;
  el.apiHostLabel.textContent = state.apiBase;
}

/**
 * Persists settings in local storage.
 */
function saveSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      apiBase: state.apiBase,
      autoDetectEnabled: state.autoDetectEnabled
    })
  );
}

/**
 * Handles auto-detect feature toggle.
 */
async function onAutoDetectToggleChanged() {
  state.autoDetectEnabled = el.autoDetectToggle.checked;
  saveSettings();

  if (!state.autoDetectEnabled) {
    state.activeTabReelUrl = '';
    el.detectBtn.disabled = true;
    el.tabHint.textContent = 'Auto detect is disabled.';
    return;
  }

  await detectReelFromCurrentTab();
}

/**
 * Keeps at least one download type enabled.
 */
function onTypeToggleChanged() {
  if (!el.videoToggle.checked && !el.audioToggle.checked) {
    el.videoToggle.checked = true;
  }
}

/**
 * Handles URL fetch mode.
 */
async function onFetchByUrl() {
  const url = normalizeInstagramUrl(el.reelUrl.value.trim());
  if (!isReelUrl(url)) {
    showError('Please enter a valid Instagram Reel URL.');
    return;
  }

  await analyzeUrl(url);
}

/**
 * Handles download from current active tab.
 */
async function onAutoDetectDownload() {
  if (!state.activeTabReelUrl) {
    showError('No reel found on current tab.');
    return;
  }

  await analyzeUrl(state.activeTabReelUrl);
}

/**
 * Calls backend /analyze to get metadata and stream URLs.
 */
async function analyzeUrl(url) {
  setLoading(true, 'Analyzing');
  hideError();

  try {
    await assertApiReachable();

    const response = await fetch(`${state.apiBase}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    if (!response.ok || data.status !== 'success') {
      throw new Error(data.message || 'Unable to analyze this reel.');
    }

    state.currentUrl = url;
    state.analysis = data;
    renderPreview(data);
    el.downloadBtn.disabled = false;
    setStatus('ready', 'Ready');
  } catch (error) {
    setStatus('error', 'Error');
    showError(error.message || 'Failed to fetch reel details.');
  } finally {
    setLoading(false);
  }
}

/**
 * Performs requested media downloads through backend + chrome.downloads.
 */
async function onDownload() {
  if (!state.currentUrl) {
    showError('Fetch a reel before downloading.');
    return;
  }

  const selectedTypes = [];
  if (el.videoToggle.checked) selectedTypes.push('video');
  if (el.audioToggle.checked) selectedTypes.push('audio');

  setLoading(true, 'Downloading');
  hideError();

  try {
    await assertApiReachable();

    for (const type of selectedTypes) {
      const downloadResp = await fetch(`${state.apiBase}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: state.currentUrl,
          type,
          quality: el.qualitySelect.value
        })
      });

      const downloadData = await downloadResp.json();
      if (!downloadResp.ok || downloadData.status !== 'success') {
        throw new Error(downloadData.message || `Failed to prepare ${type} download.`);
      }

      await chrome.runtime.sendMessage({
        action: 'startDownload',
        url: downloadData.downloadUrl,
        filename: buildFilename(state.analysis?.title || 'reel', type, downloadData.ext)
      });

      appendHistory({
        title: state.analysis?.title || 'Instagram Reel',
        type,
        quality: el.qualitySelect.value,
        timestamp: new Date().toISOString()
      });
    }

    renderHistory();
    setStatus('ready', 'Downloaded');
  } catch (error) {
    setStatus('error', 'Error');
    showError(error.message || 'Download failed.');
  } finally {
    setLoading(false);
  }
}

/**
 * Auto-detects reel URL from current tab when feature is enabled.
 */
async function detectReelFromCurrentTab() {
  if (!state.autoDetectEnabled) {
    el.detectBtn.disabled = true;
    el.tabHint.textContent = 'Auto detect is disabled.';
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = normalizeInstagramUrl(tab?.url || '');

    if (isReelUrl(currentUrl)) {
      state.activeTabReelUrl = currentUrl;
      el.detectBtn.disabled = false;
      el.tabHint.textContent = `Detected: ${new URL(currentUrl).pathname}`;
      return;
    }

    state.activeTabReelUrl = '';
    el.detectBtn.disabled = true;
    el.tabHint.textContent = 'Open an Instagram reel tab to enable auto detect.';
  } catch {
    el.detectBtn.disabled = true;
    el.tabHint.textContent = 'Unable to access active tab.';
  }
}

/**
 * Shows preview content and metadata.
 */
function renderPreview(data) {
  el.previewCard.classList.remove('hidden');
  el.thumb.src = data.thumbnail || '';
  el.thumb.classList.toggle('hidden', !data.thumbnail);
  el.title.textContent = data.title || 'Instagram Reel';
  el.duration.textContent = data.duration ? `Duration: ${formatDuration(data.duration)}` : 'Duration unavailable';

  const previewVideo = data.formats?.find((item) => item.type === 'video')?.url;
  if (previewVideo) {
    el.videoPreview.src = previewVideo;
    el.videoPreview.classList.remove('hidden');
  } else {
    el.videoPreview.classList.add('hidden');
  }
}

/**
 * Validates backend availability before API calls.
 */
async function assertApiReachable() {
  try {
    const response = await fetch(`${state.apiBase}/health`, { method: 'GET' });
    if (!response.ok) throw new Error();
  } catch {
    throw new Error(`Backend not reachable at ${state.apiBase}. Start backend with: cd backend && npm install && npm start`);
  }
}

function buildFilename(title, type, ext = type === 'audio' ? 'mp3' : 'mp4') {
  const cleanTitle = title.replace(/[^a-z0-9-_ ]/gi, '').trim().slice(0, 60) || 'instagram-reel';
  return `ReelSaverPro/${cleanTitle}-${Date.now()}.${ext}`;
}

function normalizeInstagramUrl(raw) {
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return raw;
  }
}

function isReelUrl(url) {
  return /^https:\/\/(www\.)?instagram\.com\/(reel|reels)\//i.test(url);
}

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

function setLoading(isLoading, label = 'Loading') {
  el.loader.classList.toggle('hidden', !isLoading);
  if (isLoading) setStatus('loading', label);
}

function setStatus(kind, text) {
  el.statusBadge.className = `badge ${kind}`;
  el.statusBadge.textContent = text;
}

function showError(message) {
  el.errorMsg.textContent = message;
  el.errorMsg.classList.remove('hidden');
}

function hideError() {
  el.errorMsg.classList.add('hidden');
  el.errorMsg.textContent = '';
}

function appendHistory(entry) {
  const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  existing.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(existing.slice(0, 10)));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  el.historyList.innerHTML = history.length
    ? history
        .map(
          (item) =>
            `<li><strong>${escapeHtml(item.title)}</strong><br/>${item.type.toUpperCase()} • ${item.quality} • ${new Date(item.timestamp).toLocaleString()}</li>`
        )
        .join('')
    : '<li>No downloads yet.</li>';
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

init();
