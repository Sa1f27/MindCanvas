# MindCanvas — Demo Setup Guide

## Your machine (run this before the demo)

### 1. Start the backend + frontend
```bash
docker compose up -d
```
Wait ~60 seconds for the backend to fully start.

### 2. Start the Cloudflare tunnel
```bash
cloudflared tunnel --url http://localhost:3030
```
Copy the URL it prints — looks like:
```
https://enclosed-pockets-institutes-convert.trycloudflare.com
```
Keep this terminal open for the entire demo.

### 3. Share with friends
- Send them the Cloudflare URL (they can open it directly in any browser — no install needed)
- If they want to export their own browsing history, also send them the **extension zip** (see below)

---

## Creating the extension zip

1. Right-click the `extension` folder in File Explorer
2. **Send to → Compressed (zipped) folder**
3. Share the zip file (WhatsApp, email, USB, etc.)

---

## Friend instructions — installing the extension

1. Unzip the file you received
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the unzipped `extension` folder
6. The MindCanvas icon will appear in your Chrome toolbar

---

## Friend instructions — using the extension

1. Click the **MindCanvas icon** in the Chrome toolbar
2. In the **Server URL** field, paste the Cloudflare link you were given
   - Example: `https://enclosed-pockets-institutes-convert.trycloudflare.com`
3. Click **Save** — status should change to **Connected**
4. Click **Export History (24h)** to send your browsing history to the graph
5. Click **Open Dashboard** to see your knowledge graph

---

## Notes

- The Cloudflare URL changes every time you restart the tunnel — share the new URL each session
- The tunnel only works while your laptop is on and the terminal is open
- Friends can also just open the Cloudflare URL in their browser without the extension — use **Load Sample Data** in the control panel for a demo with pre-built data
