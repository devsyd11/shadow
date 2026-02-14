'use strict';

function openCredentialsPage() {
  const url = chrome.runtime.getURL('credentials.html');
  chrome.tabs.create({ url });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-credentials') {
    openCredentialsPage();
  }
});
