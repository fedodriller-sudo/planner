# Planner

A private daily planner PWA for iPhone. Dark theme, blue **P** logo.

## Features

- Plan your day with preset activities (Swimming, Cycling, Coding, etc.)
- Add custom activities via **+ More** — they stay in your list
- Set start and end times for each activity
- Notifications when an activity starts and ends
- Works offline after first load

## Install on your iPhone

### Option A — Local server (quick test)

1. On your Mac, run:
   ```bash
   python3 planner/serve.py
   ```
2. Make sure your iPhone is on the **same Wi-Fi** as your Mac.
3. Open Safari on your iPhone and go to the URL shown (e.g. `http://192.168.x.x:8080`).
4. Tap **Share** (box with arrow) → **Add to Home Screen**.
5. Open Planner from your home screen and tap **Allow** when asked for notifications.

> **Note:** iOS requires HTTPS for service workers on non-localhost URLs. If notifications don't work over HTTP, use Option B.

### Option B — GitHub Pages (recommended, free HTTPS)

1. Push the `planner/` folder to a GitHub repo.
2. Enable GitHub Pages (Settings → Pages → deploy from `planner` folder or root).
3. Open the `https://yourname.github.io/...` URL in Safari on your iPhone.
4. **Share → Add to Home Screen**.

### Requirements

- iOS **16.4+** for home-screen app notifications
- Safari (not Chrome) for "Add to Home Screen"
- Allow notifications when prompted

## Usage

1. Open Planner → **Plan your day!**
2. Tap an activity (or **+ More** for a custom one)
3. Set **From** and **To** times
4. Tap **Confirm activity**
5. Your plan shows at the top; you'll get a notification when each block starts and ends
