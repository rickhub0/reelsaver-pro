# ReelSaver Pro — By Clickors

> **Download Instagram Reels as video (MP4) or audio (MP3) directly from your browser.**

ReelSaver Pro is a **Chrome Extension (Manifest V3)** paired with a lightweight **Node.js backend API**. It lets you save any public Instagram Reel in your choice of quality — with no third-party websites, no ads, and no account login required.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Quick Start](#quick-start)
   - [1. Run the Backend](#1-run-the-backend)
   - [2. Load the Extension](#2-load-the-extension)
7. [How It Works](#how-it-works)
8. [Extension UI Guide](#extension-ui-guide)
9. [Backend API Reference](#backend-api-reference)
10. [Configuration](#configuration)
11. [Quality Options](#quality-options)
12. [Download History](#download-history)
13. [Permissions](#permissions)
14. [Tech Stack](#tech-stack)
15. [Deployment (Render)](#deployment-render)
16. [Troubleshooting](#troubleshooting)
17. [License](#license)

---

## Overview

ReelSaver Pro solves a simple problem: Instagram does not provide a native way to download Reels. This tool bridges that gap by:

- Accepting a pasted Instagram Reel URL **or** auto-detecting the reel on your active browser tab.
- Sending that URL to a backend that uses **yt-dlp** to extract direct media stream URLs.
- Triggering a native Chrome download for the video (MP4) and/or audio (MP3) file.

Everything runs locally by default. A public production API is also available on Render for convenience.

---

## Features

| Feature | Description |
|---|---|
| **Paste URL mode** | Enter any Instagram Reel URL and fetch it instantly. |
| **Auto Detect mode** | Automatically reads the Reel URL from your current Instagram tab — no copy-pasting needed. |
| **Video download** | Downloads the Reel as an MP4 file. |
| **Audio download** | Extracts the audio track as an MP3 file. |
| **Quality selection** | Choose between Best, 720p, or 480p video quality. |
| **Preview card** | Displays the reel thumbnail, title, duration, and an inline video preview before downloading. |
| **Download history** | Keeps a local log of your last 10 downloads (title, type, quality, timestamp). |
| **Auto-detect toggle** | Enable or disable the automatic tab-URL detection with a single toggle. |
| **Persistent settings** | API base URL and auto-detect preference are stored across sessions via `localStorage`. |
| **Conflict-safe filenames** | Files are saved under a `ReelSaverPro/` folder with a timestamped name to avoid collisions. |
| **Health check** | The extension validates backend availability before every API call and surfaces a clear error if the server is down. |

---

## Architecture

```
┌────────────────────────────────┐        ┌──────────────────────────────────────┐
│   Chrome Extension (MV3)       │        │   Node.js Backend (Express)          │
│                                │        │                                      │
│  popup.html / popup.js         │◄──────►│  POST /analyze  → reel metadata      │
│    - Paste URL input           │  HTTP  │  POST /download → direct stream URL  │
│    - Auto-detect toggle        │        │  GET  /health   → liveness check     │
│    - Preview card              │        │                                      │
│    - Quality selector          │        │  utils/ytdlp.js                      │
│    - Download button           │        │    - Spawns yt-dlp subprocess        │
│    - History list              │        │    - Parses JSON format data         │
│                                │        │    - Picks best video/audio stream   │
│  background.js                 │        └──────────────────────────────────────┘
│    - Handles chrome.downloads  │                        │
│                                │                        ▼
│  content.js                    │               yt-dlp (system binary
│    - Reports current tab URL   │               or Python module)
└────────────────────────────────┘
```

The extension **never directly contacts Instagram**. All heavy lifting (media extraction) happens on the backend via `yt-dlp`.

---

## Project Structure

```
reelsaver-pro/
├── backend/
│   ├── server.js            # Express API server (routes: /health, /analyze, /download)
│   ├── package.json         # Node.js dependencies (express, cors)
│   └── utils/
│       └── ytdlp.js         # yt-dlp subprocess wrapper + format selection logic
│
└── extension/
    ├── manifest.json        # Chrome Extension Manifest V3 definition
    ├── popup.html           # Extension popup UI (HTML structure)
    ├── popup.js             # Popup logic (state, API calls, UI rendering)
    ├── popup.css            # Popup stylesheet
    ├── background.js        # Service worker (handles chrome.downloads API)
    ├── content.js           # Content script (reads current tab reel URL)
    └── icons/
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js** v18 or later | For running the backend server. |
| **npm** | Bundled with Node.js. |
| **yt-dlp** | Must be accessible in your system PATH. See install options below. |
| **Google Chrome** | Any recent version supporting Manifest V3. |

### Installing yt-dlp

The backend tries the following commands in order until one succeeds:

```
yt-dlp                   # standalone binary (recommended)
python3 -m yt_dlp        # Python 3 module
python  -m yt_dlp        # Python (Windows / some Linux)
py      -m yt_dlp        # Python Launcher (Windows)
```

**Standalone binary (recommended):**
```bash
# macOS (Homebrew)
brew install yt-dlp

# Linux
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Windows (winget)
winget install yt-dlp
```

**Python module fallback:**
```bash
pip install yt-dlp
# or
pip3 install yt-dlp
```

---

## Quick Start

### 1. Run the Backend

```bash
cd reelsaver-pro/backend
npm install
npm start
```

The server starts on **http://localhost:4000** by default. You should see:

```
ReelSaver Pro API listening on http://localhost:4000
```

To use a different port set the `PORT` environment variable:

```bash
PORT=5000 npm start
```

### 2. Load the Extension

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `reelsaver-pro/extension` folder.
5. The **ReelSaver Pro** icon will appear in your Chrome toolbar.

> **Production API:** The extension points to `https://reelsaver-pro-api.onrender.com` by default. For local development, change the API base URL in the extension settings to `http://localhost:4000`.

---

## How It Works

1. **User provides a Reel URL** — either by pasting it into the input field or by opening an Instagram Reel in the active Chrome tab (auto-detect mode).
2. **Fetch / Analyze** — The extension sends a `POST /analyze` request to the backend with the URL.
3. **Backend extracts metadata** — The backend spawns a `yt-dlp` subprocess with `--dump-single-json` to fetch media format info without downloading the file. It returns the title, duration, thumbnail, and available stream URLs.
4. **Preview is rendered** — The popup shows the thumbnail, title, duration, and an inline video preview.
5. **User selects options** — Video, audio, or both; and the desired quality (Best / 720p / 480p).
6. **Download** — The extension sends a `POST /download` request. The backend picks the best matching stream URL and returns it. The extension then triggers `chrome.downloads.download()` to save the file natively.
7. **History is saved** — An entry is prepended to the local download history (last 10 entries).

---

## Extension UI Guide

### Paste Reel URL

Enter or paste any Instagram Reel URL (e.g. `https://www.instagram.com/reel/XXXXXXXXXXX/`) and click **Fetch**. The URL is normalized and validated before the API call is made.

### Auto Detect

When you are on an Instagram Reel page, the extension automatically reads the URL from the active tab. The **Download Current Reel** button becomes enabled and the detected path is shown as a hint. Use the toggle switch to enable or disable this feature.

### Preview Card

After a successful analyze call, a preview card appears showing:
- **Thumbnail** image of the reel.
- **Title** as reported by Instagram.
- **Duration** formatted as `m:ss`.
- **Inline video** preview (when a direct video stream is available).

### Download Options

| Option | Values |
|---|---|
| **Video** | Toggle to include an MP4 video file in the download. |
| **Audio** | Toggle to include an MP3 audio file in the download. |
| **Quality** | Best (highest available), 720p, or 480p. |

At least one of Video or Audio must remain selected. Files are saved to a `ReelSaverPro/` subfolder in your Chrome download directory.

### Status Badge

A badge in the top-right corner of the popup reflects the current state:

| Badge | Meaning |
|---|---|
| `Idle` | No operation in progress. |
| `Analyzing` | Fetching reel metadata from the backend. |
| `Ready` | Metadata loaded; ready to download. |
| `Downloading` | Download request sent. |
| `Downloaded` | Download completed successfully. |
| `Error` | Something went wrong (see the error message below). |

---

## Backend API Reference

Base URL (local): `http://localhost:4000`  
Base URL (production): `https://reelsaver-pro-api.onrender.com`

### `GET /health`

Liveness check. Returns `200 OK` if the server is running.

**Response:**
```json
{ "status": "ok" }
```

---

### `POST /analyze`

Fetches reel metadata and available stream formats.

**Request body:**
```json
{ "url": "https://www.instagram.com/reel/XXXXXXXXXXX/" }
```

**Success response (`200`):**
```json
{
  "status": "success",
  "title": "Reel title from Instagram",
  "duration": 30,
  "thumbnail": "https://...",
  "formats": [
    { "type": "video", "quality": "720p", "ext": "mp4", "url": "https://..." },
    { "type": "audio", "quality": "mp3",  "ext": "mp3", "url": "https://..." }
  ]
}
```

**Error response (`400` / `422`):**
```json
{ "status": "error", "message": "Invalid Instagram reel URL." }
```

---

### `POST /download`

Resolves the direct downloadable stream URL for a given type and quality.

**Request body:**
```json
{
  "url": "https://www.instagram.com/reel/XXXXXXXXXXX/",
  "type": "video",
  "quality": "best"
}
```

| Field | Required | Values |
|---|---|---|
| `url` | Yes | A valid Instagram Reel URL. |
| `type` | No (default: `video`) | `video` or `audio` |
| `quality` | No (default: `best`) | `best`, `720p`, `480p` |

**Success response (`200`):**
```json
{
  "status": "success",
  "type": "video",
  "quality": "best",
  "downloadUrl": "https://...",
  "ext": "mp4"
}
```

**Error response (`400` / `422`):**
```json
{ "status": "error", "message": "No video stream found for this reel." }
```

---

## Configuration

### API Base URL

By default the extension connects to the production Render deployment:

```
https://reelsaver-pro-api.onrender.com
```

To point to a local backend, update `DEFAULT_API_BASE` in `extension/popup.js`:

```js
const DEFAULT_API_BASE = 'http://localhost:4000';
```

The currently active API host is always shown at the bottom of the **Paste Reel URL** card in the popup.

### Backend Port

Set the `PORT` environment variable before starting the server:

```bash
PORT=8080 npm start
```

---

## Quality Options

| Selection | Behavior |
|---|---|
| **Best** | Picks the highest-resolution video format available. |
| **720p** | Picks the best format at or below 720p. Falls back to the highest available if no 720p stream exists. |
| **480p** | Picks the best format at or below 480p. Falls back to the highest available if no 480p stream exists. |

Audio downloads always use the highest available audio bitrate regardless of the quality setting.

---

## Download History

The extension stores the last **10** download entries in `localStorage` under the key `reelsaver_history`. Each entry contains:

```json
{
  "title": "Reel title",
  "type": "video",
  "quality": "best",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

History is displayed in the **Recent Downloads** section of the popup and persists across popup open/close cycles.

---

## Permissions

The extension requests the following Chrome permissions:

| Permission | Reason |
|---|---|
| `activeTab` | Read the URL of the currently active tab for auto-detect mode. |
| `tabs` | Query tabs to detect Instagram Reel pages. |
| `downloads` | Trigger native Chrome file downloads. |
| `storage` | (Declared for future use.) |

Host permissions are scoped to:
- `https://www.instagram.com/*` — for the content script.
- `https://reelsaver-pro-api.onrender.com/*` — for the production backend.
- `http://localhost:4000/*` and `http://127.0.0.1:4000/*` — for local development.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Chrome Extension | Manifest V3, Vanilla JS (ES modules), HTML, CSS |
| Backend | Node.js, Express 4 |
| Media extraction | yt-dlp (subprocess) |
| CORS | cors npm package |
| Deployment | Render (Node.js web service) |

---

## Deployment (Render)

The backend is deployable as a standard Node.js web service on [Render](https://render.com).

**Build command:**
```bash
npm install && pip install yt-dlp
```

**Start command:**
```bash
npm start
```

> **Important:** Render's default environment does not include `yt-dlp`. You must install it as part of your build or start command (see above). If you see the error `Unable to execute yt-dlp ... ENOENT`, it means none of the command candidates were found in the environment.

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Port the Express server listens on. Render sets this automatically. |

---

## Troubleshooting

### `Backend not reachable at http://localhost:4000`
The extension cannot connect to the local backend. Make sure you have started it:
```bash
cd backend && npm install && npm start
```
Check that nothing else is using port 4000, or change the port.

### `Unable to execute yt-dlp ... ENOENT`
`yt-dlp` is not installed or not in your PATH. Install it using one of the methods in the [Prerequisites](#prerequisites) section.

### `Unable to analyze reel`
- The reel may be private or age-restricted — `yt-dlp` cannot access private content without authentication.
- The URL may be malformed. Only `https://www.instagram.com/reel/...` and `https://www.instagram.com/reels/...` patterns are accepted.
- Your `yt-dlp` version may be outdated. Run `yt-dlp -U` to update.

### Auto-detect not working
- Make sure you are on an Instagram Reel page (the URL must contain `/reel/` or `/reels/`).
- The **Auto Detect** toggle must be enabled.
- Reload the extension after loading it for the first time.

### Downloads saved with wrong extension
The file extension is determined by the stream format returned by `yt-dlp`. Video files default to `.mp4` and audio files default to `.mp3`.

---

## License

See [LICENSE](../LICENSE) for details.
