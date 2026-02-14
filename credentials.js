(function () {
  'use strict';

  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  const clearBtn = document.getElementById('clearAll');
  const searchInput = document.getElementById('search');
  const recordCountEl = document.getElementById('recordCount');
  const telegramTokenEl = document.getElementById('telegramToken');
  const telegramChatIdEl = document.getElementById('telegramChatId');
  const telegramSaveBtn = document.getElementById('telegramSave');
  const telegramTestBtn = document.getElementById('telegramTest');
  const telegramStatusEl = document.getElementById('telegramStatus');

  let allCredentials = [];

  function copyText(text) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }

  function filterCredentials(credentials, query) {
    if (!query || !query.trim()) return credentials;
    const q = query.trim().toLowerCase();
    return credentials.filter(
      (c) =>
        (c.hostname && c.hostname.toLowerCase().includes(q)) ||
        (c.url && c.url.toLowerCase().includes(q)) ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.username && c.username.toLowerCase().includes(q))
    );
  }

  function render(credentials) {
    allCredentials = credentials || [];
    const query = searchInput ? searchInput.value : '';
    const filtered = filterCredentials(allCredentials, query);

    if (filtered.length === 0) {
      listEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      emptyEl.querySelector('p').textContent = allCredentials.length === 0
        ? 'No saved credentials yet.'
        : 'No matches for your search.';
    } else {
      emptyEl.classList.add('hidden');
      listEl.classList.remove('hidden');
      listEl.innerHTML = filtered
        .map((entry, index) => {
          const site = entry.hostname || entry.url || '';
          const safeSite = escapeHtml(site);
          const safeUser = escapeHtml(entry.username || '');
          const date = entry.savedAt ? new Date(entry.savedAt).toLocaleString() : '';
          return `
            <tr class="entry" data-index="${index}">
              <td class="cell-site" title="${escapeAttr(entry.url || '')}">${safeSite}</td>
              <td class="cell-username" title="${safeUser}">${safeUser}</td>
              <td class="cell-password">
                <div class="cell-password-wrap">
                  <span class="cell-password-masked">••••••••</span>
                  <button type="button" class="copy-btn" data-copy="${escapeAttr(entry.password || '')}">Copy</button>
                </div>
              </td>
              <td class="cell-saved">${escapeHtml(date)}</td>
            </tr>
          `;
        })
        .join('');

      listEl.querySelectorAll('.copy-btn').forEach((btn) => {
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

    if (recordCountEl) {
      recordCountEl.textContent = `Showing ${filtered.length} record(s)`;
    }
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

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      render(allCredentials);
    });
  }

  clearBtn.addEventListener('click', () => {
    if (!confirm('Delete all saved credentials? This cannot be undone.')) return;
    chrome.storage.local.set({ credentials: [] }, () => {
      allCredentials = [];
      render([]);
    });
  });

  function showTelegramStatus(message, isError) {
    if (!telegramStatusEl) return;
    telegramStatusEl.textContent = message;
    telegramStatusEl.className = 'telegram-status ' + (isError ? 'error' : 'success');
  }

  chrome.storage.local.get({ telegramBotToken: '', telegramChatId: '' }, (st) => {
    if (telegramTokenEl) telegramTokenEl.value = st.telegramBotToken || '';
    if (telegramChatIdEl) telegramChatIdEl.value = st.telegramChatId || '';
  });

  if (telegramSaveBtn) {
    telegramSaveBtn.addEventListener('click', () => {
      const token = (telegramTokenEl && telegramTokenEl.value) || '';
      const chatId = (telegramChatIdEl && telegramChatIdEl.value) || '';
      chrome.storage.local.set({ telegramBotToken: token, telegramChatId: chatId }, () => {
        showTelegramStatus('Telegram settings saved.');
      });
    });
  }

  if (telegramTestBtn) {
    telegramTestBtn.addEventListener('click', () => {
      if (!telegramStatusEl) return;
      const token = (telegramTokenEl && telegramTokenEl.value) || '';
      const chatId = (telegramChatIdEl && telegramChatIdEl.value) || '';
      if (!token || !chatId) {
        showTelegramStatus('Enter Bot Token and Chat ID, then click Save before testing.', true);
        return;
      }
      chrome.storage.local.set({ telegramBotToken: token, telegramChatId: chatId }, () => {
        telegramStatusEl.textContent = 'Sending test message…';
        telegramStatusEl.className = 'telegram-status';
        chrome.runtime.sendMessage({ type: 'TELEGRAM_TEST' }, (response) => {
          if (chrome.runtime.lastError) {
            showTelegramStatus('Error: ' + chrome.runtime.lastError.message, true);
            return;
          }
          if (response && response.ok) {
            showTelegramStatus('Test message sent. Check your Telegram.');
          } else {
            const reason = (response && response.reason) || 'Unknown error';
            showTelegramStatus(reason === 'not_configured' ? 'Save Bot Token and Chat ID first.' : reason, true);
          }
        });
      });
    });
  }

  load();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.credentials) {
      render(changes.credentials.newValue || []);
    }
  });
})();
