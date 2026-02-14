(function () {
  'use strict';

  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  const clearBtn = document.getElementById('clearAll');

  function copyText(text) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }

  function render(credentials) {
    if (!credentials || credentials.length === 0) {
      listEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    listEl.innerHTML = credentials.map((entry, index) => {
      const safeTitle = escapeHtml(entry.title || entry.hostname || entry.url);
      const safeUser = escapeHtml(entry.username);
      const safeUrl = escapeHtml(entry.url);
      const date = entry.savedAt ? new Date(entry.savedAt).toLocaleString() : '';
      return `
        <div class="entry" data-index="${index}">
          <div class="site" title="${safeUrl}">${safeTitle}</div>
          <div class="row">
            <span class="label">Username</span>
            <span class="value" title="${safeUser}">${safeUser}</span>
            <button type="button" class="copy-btn" data-copy="${escapeAttr(entry.username || '')}">Copy</button>
          </div>
          <div class="row">
            <span class="label">Password</span>
            <span class="value">••••••••</span>
            <button type="button" class="copy-btn" data-copy="${escapeAttr(entry.password || '')}">Copy</button>
          </div>
          ${date ? `<div class="row"><span class="label">Saved</span><span class="value">${escapeHtml(date)}</span></div>` : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-copy') || '';
        const ok = await copyText(text);
        if (ok) {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 1500);
        }
      });
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeAttr(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function load() {
    chrome.storage.local.get({ credentials: [] }, (result) => {
      render(result.credentials);
    });
  }

  clearBtn.addEventListener('click', () => {
    if (!confirm('Delete all saved credentials? This cannot be undone.')) return;
    chrome.storage.local.set({ credentials: [] }, () => {
      render([]);
    });
  });

  load();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.credentials) {
      render(changes.credentials.newValue || []);
    }
  });
})();
