# Login Credentials Saver – Chrome Extension

A Chrome extension that saves the username and password you enter on any website when a login succeeds. View and copy saved credentials on a dedicated page, opened by keyboard shortcut or by clicking the extension icon.

## Features

- **Auto-save on success** – Saves credentials only when the login succeeds (after the page navigates away from the login form).
- **Credentials page** – No popup; credentials are shown on a full page in a new tab.
- **Keyboard shortcut** – Press **Ctrl+Shift+L** (Windows/Linux) or **Cmd+Shift+L** (Mac) to open the saved credentials page. You can change it at `chrome://extensions/shortcuts`.
- **Or click the icon** – Clicking the extension icon also opens the credentials page.
- **Copy to clipboard** – Use the “Copy” buttons next to username or password on the credentials page.
- **Local only** – Data is stored in Chrome’s local storage on this device only (not synced to your Google account).

## Installation (developer / unpacked)

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the folder that contains this project (e.g. `keylogging-extension`).
5. Use **Ctrl+Shift+L** (or **Cmd+Shift+L** on Mac) to open the credentials page, or click the extension icon.

## How it works

- The extension injects a script on every page. When you submit a login form, it stores the credentials as “pending.”
- If the site then navigates to another page (e.g. dashboard), the extension treats that as a successful login and moves the pending entry into the saved list.
- Saved entries are shown on the credentials page (`credentials.html`). Use **Clear all** there to remove everything.

## Security notice

- **Passwords are stored in Chrome’s local storage** on your computer. Anyone with access to your Chrome profile (or this extension’s data) could see them.
- Use only on a trusted, secure device. Do not use on shared or public computers.
- Prefer your browser’s built-in password manager or a dedicated password manager for sensitive accounts when possible.

## Permissions

- **Storage** – To save and read credentials locally.
- **Access to all websites** – So the extension can run on any page and capture login forms when you submit them.

## Files

- `manifest.json` – Extension manifest (Manifest V3), including keyboard command.
- `background.js` – Opens the credentials page when you use the shortcut or click the icon.
- `content.js` – Runs on web pages; captures form submit and promotes to saved on successful login.
- `credentials.html` / `credentials.css` / `credentials.js` – Full-page UI to list and copy saved credentials.
