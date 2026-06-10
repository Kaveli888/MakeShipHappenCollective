# ShipMind Chrome Extension

Send any link, page, or selection in Chrome to your local ShipMind app with one right-click.

## Install (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Click the ShipMind toolbar icon (or open the extension's **Options** page) and paste your ShipMind token.
   - Find your token in **ShipMind → Settings → Browser Extension**.
5. Right-click any link, page, or text selection → choose a "Send to ShipMind" item.

## How it works

- Posts to `http://127.0.0.1:8765/ingest` with `Authorization: Bearer <token>`.
- If the local app is closed or unreachable, falls back to opening `shipmind://add?...` in a throwaway tab (auto-closed after 2 seconds), which the desktop app picks up via its custom URL scheme.
- A short timeout (1.5s) keeps things snappy when ShipMind isn't running.
