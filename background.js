// CodeSnip – Background Script
// Registers the right-click context menu item and forwards the selected
// text to the active tab's content script so the save modal can open.

browser.contextMenus.create({
  id: 'codesnip-save-selection',
  title: 'Save to CodeSnip',
  contexts: ['selection'],
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'codesnip-save-selection') return;

  const selectedText = info.selectionText || '';
  if (!selectedText.trim()) return;

  browser.tabs.sendMessage(tab.id, {
    type: 'CODESNIP_SAVE_SELECTION',
    text: selectedText,
  }).catch(() => {
    // Content script may not be injected yet on some pages — ignore silently
  });
});
