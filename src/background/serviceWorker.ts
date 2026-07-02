import { handleMessage } from './messageRouter';
import { syncDirtyRecords } from '../sync/syncQueue';

chrome.runtime.onInstalled.addListener(() => console.info('Question Bank Overlay installed'));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error: unknown) => {
      const messageText = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      sendResponse({ ok: false, error: messageText });
    });
  return true;
});

chrome.runtime.onStartup.addListener(() => {
  syncDirtyRecords().catch((error: unknown) => console.warn('Startup sync delayed', error));
});
