/**
 * Handles extension-level actions such as browser downloads.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'startDownload') {
    return false;
  }

  chrome.downloads.download(
    {
      url: message.url,
      filename: message.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ status: 'success', downloadId });
    }
  );

  return true;
});
