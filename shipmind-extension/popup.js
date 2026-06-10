const stateEl = document.getElementById('state');
const openBtn = document.getElementById('open');

async function refresh() {
  try {
    const stored = await chrome.storage.local.get('ingestToken');
    const token = (stored && stored.ingestToken) || '';
    if (token) {
      stateEl.textContent = 'Configured. Right-click any link, page, or selection.';
      stateEl.className = 'ok';
    } else {
      stateEl.textContent = 'Not configured — paste your token in settings.';
      stateEl.className = 'err';
    }
  } catch (_) {
    stateEl.textContent = 'Not configured — paste your token in settings.';
    stateEl.className = 'err';
  }
}

openBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

refresh();
