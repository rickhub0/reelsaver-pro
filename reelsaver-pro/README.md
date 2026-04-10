# ReelSaver Pro

Chrome Extension (Manifest V3) + Node.js backend to download Instagram Reels using:

1. Paste URL mode
2. Auto-detect from current Instagram tab

## 1) Run backend

```bash
cd backend
npm install
npm run start
```

Requires `yt-dlp` installed and available in PATH.

Fallback supported by backend:
- `yt-dlp`
- `python3 -m yt_dlp`
- `python -m yt_dlp`
- `py -m yt_dlp`

## 2) Load extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `reelsaver-pro/extension`

Backend default API URL: `https://reelsaver-pro-api.onrender.com` (production).

For local development backend URL is `http://localhost:4000`.

## 3) Render deployment note

If you see `Unable to execute yt-dlp ... ENOENT` on Render, install `yt-dlp` in your Render service image/environment or provide Python with `yt_dlp` package.
