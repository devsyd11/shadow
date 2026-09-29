(function () {
  'use strict';

  const USERNAME_FIELD_HINTS = [
    'user', 'username', 'email', 'login', 'account', 'name', 'mail', 'uid'
  ];
  const PASSWORD_FIELD_HINTS = ['password', 'pass', 'pwd', 'passwd'];

  function getFieldHint(field) {
    const attrs = [
      (field.name || '').toLowerCase(),
      (field.id || '').toLowerCase(),
      (field.placeholder || '').toLowerCase(),
      (field.getAttribute('autocomplete') || '').toLowerCase()
    ].join(' ');
    return attrs;
  }

  function looksLikeUsername(input) {
    if (!input || input.type === 'password') return false;
    const type = (input.type || 'text').toLowerCase();
    if (type !== 'text' && type !== 'email' && type !== 'tel') return false;
    const hint = getFieldHint(input);
    return USERNAME_FIELD_HINTS.some(h => hint.includes(h));
  }

  function looksLikePassword(input) {
    if (!input) return false;
    if (input.type === 'password') return true;
    const hint = getFieldHint(input);
    return PASSWORD_FIELD_HINTS.some(h => hint.includes(h));
  }

  function findUsernameField(form) {
    const inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type])');
    for (const input of inputs) {
      if (looksLikeUsername(input)) return input;
    }
    const passwordInput = form.querySelector('input[type="password"]');
    if (passwordInput) {
      const prev = passwordInput.previousElementSibling;
      if (prev && (prev.tagName === 'INPUT' || prev.tagName === 'INPUT')) {
        const t = (prev.type || 'text').toLowerCase();
        if (t === 'text' || t === 'email' || t === '') return prev;
      }
    }
    return null;
  }

  function findPasswordField(form) {
    const pwd = form.querySelector('input[type="password"]');
    if (pwd) return pwd;
    const inputs = form.querySelectorAll('input');
    for (const input of inputs) {
      if (looksLikePassword(input)) return input;
    }
    return null;
  }

  const PENDING_MAX_AGE_MS = 30000;

  function saveCredential(form) {
    const passwordField = findPasswordField(form);
    if (!passwordField || !passwordField.value) return;

    const usernameField = findUsernameField(form);
    const username = usernameField ? usernameField.value.trim() : '';
    const password = passwordField.value;

    if (!password) return;

    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const title = document.title || hostname;
    const formPageUrl = window.location.href;
    const savedAt = new Date().toISOString();

    const entry = {
      url: origin,
      hostname,
      title,
      username: username || '(no username)',
      password,
      savedAt
    };

    const pending = {
      origin,
      formPageUrl,
      hostname,
      title,
      username: entry.username,
      password,
      savedAt,
      submittedAt: savedAt
    };

    chrome.storage.local.get({ credentials: [] }, (r) => {
      const list = r.credentials || [];
      list.unshift(entry);
      chrome.storage.local.set({
        credentials: list.slice(0, 500),
        pendingLogin: pending
      }, () => {
        console.log('[Shadow] Credential saved for', hostname);
        chrome.runtime.sendMessage({ type: 'NEW_CREDENTIAL', entry }, () => {});
      });
    });
  }

  function tryAttachCookiesToLastCredential() {
    chrome.storage.local.get({ pendingLogin: null }, (result) => {
      const pending = result.pendingLogin;
      if (!pending) return;

      if (pending.origin !== window.location.origin) return;

      const age = Date.now() - new Date(pending.submittedAt).getTime();
      if (age > PENDING_MAX_AGE_MS) {
        chrome.storage.local.remove('pendingLogin');
        return;
      }

      chrome.runtime.sendMessage({
        type: 'ATTACH_COOKIES',
        origin: pending.origin,
        hostname: pending.hostname,
        savedAt: pending.savedAt
      }, () => {});
    });
  }

  setTimeout(tryAttachCookiesToLastCredential, 2000);
  setTimeout(tryAttachCookiesToLastCredential, 4500);

  function onFormSubmit(e) {
    const form = e.target;
    if (form.tagName !== 'FORM') return;
    if (!form.querySelector('input[type="password"]') && !form.querySelector('input[name*="password" i]')) return;
    saveCredential(form);
  }

  document.addEventListener('submit', onFormSubmit, true);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'FORM') {
          node.addEventListener('submit', onFormSubmit, true);
        }
        const forms = node.querySelectorAll ? node.querySelectorAll('form') : [];
        forms.forEach(f => f.addEventListener('submit', onFormSubmit, true));
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
