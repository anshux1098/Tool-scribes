# ToolScribe — Browser Extension (Manifest V3)

> **The Curator & Vault Copilot for your browser.**  
> 1-click clipping to your ToolScribe vault, contextual radar on software domains, and automated "Dust Collector" usage tracking.

---

## ✨ Features

1. **1-Click "Clip to Vault & Collection" (`Alt+S` or `Option+S`)**:
   - Reads page title, clean domain, metadata, favicon, and tags directly from your active browser tab with zero server latency.
   - Choose which personal collection to store it in, add your private note/gotcha, and hit **Save**.
2. **Passive "Dust Collector" & Real Usage Tracker**:
   - The background service worker matches visited domains against tools in your personal Vault.
   - Debounced once per 24 hours to preserve battery and privacy.
   - Accurately illuminates which tools are actually active vs. gathering dust on your dashboard.
3. **Contextual "ToolScribe Radar"**:
   - When browsing developer tools, SaaS pricing pages, or GitHub repositories, a discreet floating pill surfaces community ratings, gotchas, and top open-source alternatives.

---

## 🚀 How to Install & Test (Developer Mode)

You can load and use the extension immediately in any Chromium browser (Chrome, Arc, Brave, Edge, Opera):

1. Open your browser and navigate to the extensions page:
   - **Chrome / Brave / Arc**: `chrome://extensions`
   - **Edge**: `edge://extensions`
2. In the top-right corner, toggle **"Developer mode"** to **ON**.
3. Click the **"Load unpacked"** button in the top-left toolbar.
4. Select the `extension/` folder located inside this repository (`Tool-scribes-main/extension`).
5. The **ToolScribe** extension icon will now appear in your browser extension toolbar! Pin it for quick 1-click access.

---

## ⚙️ Configuration & Supabase Connection

1. Click the ToolScribe icon in your toolbar (or press `Alt+S`).
2. Click the gear icon (**Settings**) in the popup header.
3. Verify your Supabase URL (defaults to your project URL) and paste your Supabase Public Anon Key.
4. Click **Save Configuration**. The status badge will change to a green **Connected** pill.

---

## 📦 Packaging for the Chrome Web Store

When you are ready to release the extension publicly:

1. Compress the contents of the `extension/` directory into a `.zip` file:
   ```bash
   cd extension
   # Windows PowerShell:
   Compress-Archive -Path * -DestinationPath ../toolscribe-extension.zip
   ```
2. Log into the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Click **"New Item"** and upload `toolscribe-extension.zip`.
4. Fill in the store listing, upload 2–3 screenshots, and submit for review.
