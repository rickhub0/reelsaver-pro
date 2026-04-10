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

## 2) Load extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `reelsaver-pro/extension`

Backend default API URL: `http://localhost:4000`.
