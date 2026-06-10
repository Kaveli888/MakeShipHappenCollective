// ShipMind Chrome extension service worker
// Manifest V3 — service workers are ephemeral, so context menus must be
// registered on every install AND startup.

const INGEST_URL = 'http://127.0.0.1:8765/ingest';
const FETCH_TIMEOUT_MS = 1500;

const MENU_ITEMS = [
  { id: 'shipmind-send-link', title: 'Send link to ShipMind', contexts: ['link'] },
  { id: 'shipmind-send-page', title: 'Send page to ShipMind', contexts: ['page'] },
  { id: 'shipmind-send-selection', title: 'Send selection to ShipMind as note', contexts: ['selection'] }
];

function registerMenus() {
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU_ITEMS) {
      chrome.contextMenus.create(item);
    }
  });
}

chrome.runtime.onInstalled.addListener(registerMenus);
chrome.runtime.onStartup.addListener(registerMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  let payload = null;

  if (info.menuItemId === 'shipmind-send-link') {
    payload = {
      kind: 'link',
      url: info.linkUrl || '',
      title: (tab && tab.title) || info.linkUrl || ''
    };
  } else if (info.menuItemId === 'shipmind-send-page') {
    payload = {
      kind: 'page',
      url: (tab && tab.url) || info.pageUrl || '',
      title: (tab && tab.title) || ''
    };
  } else if (info.menuItemId === 'shipmind-send-selection') {
    payload = {
      kind: 'selection',
      url: (tab && tab.url) || info.pageUrl || '',
      title: (tab && tab.title) || '',
      text: info.selectionText || ''
    };
  }

  if (payload) {
    handleSend(payload);
  }
});

async function handleSend(payload) {
  let token = '';
  try {
    const stored = await chrome.storage.local.get('ingestToken');
    token = (stored && stored.ingestToken) || '';
  } catch (_) {
    token = '';
  }

  if (!token) {
    notify(
      'ShipMind not configured',
      "Click the toolbar icon to set up your token."
    );
    return;
  }

  const ok = await tryIngest(payload, token);
  if (ok) {
    notify('Sent to ShipMind ✓', payload.title || payload.url || '');
    return;
  }

  // Fallback: deep link via shipmind:// custom scheme
  fallbackDeepLink(payload);
}

async function tryIngest(payload, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const body = { kind: payload.kind, url: payload.url, title: payload.title };
  if (payload.kind === 'selection') {
    body.text = payload.text || '';
  }

  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    return res.ok;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function fallbackDeepLink(payload) {
  const params = new URLSearchParams();
  params.set('kind', payload.kind);
  if (payload.url) params.set('url', payload.url);
  if (payload.title) params.set('title', payload.title);
  if (payload.text) params.set('text', payload.text);

  const deepLink = 'shipmind://add?' + params.toString();
  chrome.tabs.create({ url: deepLink, active: false }, (tab) => {
    if (tab && typeof tab.id === 'number') {
      setTimeout(() => {
        chrome.tabs.remove(tab.id, () => void chrome.runtime.lastError);
      }, 2000);
    }
  });
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: title,
      message: message || ''
    });
  } catch (_) {
    // Notifications may not be granted — silently ignore.
  }
}
