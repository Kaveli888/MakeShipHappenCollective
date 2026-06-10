const HEALTH_URL = 'http://127.0.0.1:8765/health';

const tokenEl = document.getElementById('token');
const saveBtn = document.getElementById('save');
const testBtn = document.getElementById('test');
const statusEl = document.getElementById('status');
const savedEl = document.getElementById('saved');

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || '';
}

function setSaved(text) {
  savedEl.textContent = text || '';
  if (text) {
    setTimeout(() => {
      savedEl.textContent = '';
    }, 2000);
  }
}

async function load() {
  try {
    const stored = await chrome.storage.local.get('ingestToken');
    tokenEl.value = (stored && stored.ingestToken) || '';
  } catch (_) {
    // ignore
  }
}

saveBtn.addEventListener('click', async () => {
  const token = tokenEl.value.trim();
  try {
    await chrome.storage.local.set({ ingestToken: token });
    setSaved('Saved.');
  } catch (e) {
    setSaved('Could not save: ' + (e && e.message ? e.message : 'unknown error'));
  }
});

testBtn.addEventListener('click', async () => {
  const token = tokenEl.value.trim();
  if (!token) {
    setStatus('Enter a token first.', 'err');
    return;
  }
  setStatus('Testing…', '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Authorization': 'Bearer ' + token },
      signal: controller.signal
    });
    if (res.ok) {
      setStatus('Connected', 'ok');
    } else {
      setStatus('ShipMind responded with HTTP ' + res.status, 'err');
    }
  } catch (_) {
    setStatus("Could not reach ShipMind — make sure it's open", 'err');
  } finally {
    clearTimeout(timer);
  }
});

load();
