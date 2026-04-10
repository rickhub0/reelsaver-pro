/**
 * Content script keeps lightweight page context info available if needed later.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getCurrentReelUrl') {
    const reelUrl = window.location.href.split('?')[0].replace(/\/$/, '');
    sendResponse({ reelUrl });
  }
});
