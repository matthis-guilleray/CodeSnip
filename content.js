// CodeSnip - Content Script v1.1
// 1. Detects search queries → shows matching snippet panel
// 2. Detects code blocks on ANY page → shows "Save to CodeSnip" hover button

(function () {
  'use strict';

  const PANEL_ID   = 'codesnip-panel';
  const MODAL_ID   = 'codesnip-save-modal';
  const BTN_CLASS  = 'codesnip-save-btn';
  const WRAP_CLASS = 'codesnip-code-wrap';

  // ── Utilities ────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function guessLanguage(el) {
    const targets = [el, el.querySelector('code'), el.closest('pre'), el.closest('[class*="language-"]')].filter(Boolean);
    for (const t of targets) {
      const cls = t.className || '';
      const m = cls.match(/language-(\w+)|lang-(\w+)|highlight-source-(\w+)/);
      if (m) return (m[1] || m[2] || m[3]).toLowerCase();
    }
    const dl = el.closest('[data-language]');
    if (dl) return dl.dataset.language.toLowerCase();

    // W3Schools specific class hints
    const cls = el.className || '';
    if (cls.includes('jsHigh'))     return 'javascript';
    if (cls.includes('htmlHigh'))   return 'html';
    if (cls.includes('cssHigh'))    return 'css';
    if (cls.includes('pythonHigh')) return 'python';
    if (cls.includes('sqlHigh'))    return 'sql';

    // Fallback: scan nearest heading text
    const heading = el.closest('div,section')?.querySelector('h2,h3,h4');
    if (heading) {
      const ht = heading.textContent.toLowerCase();
      if (ht.includes('javascript')) return 'javascript';
      if (ht.includes('python'))     return 'python';
      if (ht.includes('html'))       return 'html';
      if (ht.includes('css'))        return 'css';
      if (ht.includes('sql'))        return 'sql';
      if (ht.includes('java'))       return 'java';
      if (ht.includes('c++') || ht.includes('cpp')) return 'cpp';
    }
    return 'text';
  }

  function getCodeText(el) {
    return (el.innerText || el.textContent || '').trim();
  }

  // ── Search panel ─────────────────────────────────────────

  function getSearchQuery() {
    const url = new URL(window.location.href);
    return (url.searchParams.get('q') || url.searchParams.get('query') || '').toLowerCase();
  }

  function matchSnippets(query, snippets) {
    return snippets.filter(s =>
      s.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
        .some(kw => query.includes(kw))
    );
  }

  function renderPanel(snippets) {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
    if (!snippets.length) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    panel.innerHTML = `
      <div class="cs-header">
        <span class="cs-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M8 6L2 12L8 18" stroke="#A78BFA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M16 6L22 12L16 18" stroke="#A78BFA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 3L10 21" stroke="#7C3AED" stroke-width="2" stroke-linecap="round"/>
          </svg>
          CodeSnip
        </span>
        <span class="cs-count">${snippets.length} match${snippets.length > 1 ? 'es' : ''}</span>
        <button class="cs-close" id="cs-close-btn">✕</button>
      </div>
    `;

    snippets.forEach((snippet, i) => {
      const card = document.createElement('div');
      card.className = 'cs-card';
      card.innerHTML = `
        <div class="cs-card-header">
          <span class="cs-title">${escapeHtml(snippet.title || 'Snippet')}</span>
          <span class="cs-lang">${escapeHtml(snippet.language || 'text')}</span>
        </div>
        <pre class="cs-pre"><code class="cs-code">${escapeHtml(snippet.code)}</code></pre>
        <div class="cs-card-footer">
          <span class="cs-keywords">${escapeHtml(snippet.keywords)}</span>
          <button class="cs-copy" data-index="${i}">Copy</button>
        </div>
      `;
      panel.appendChild(card);
    });

    document.body.appendChild(panel);

    panel.querySelectorAll('.cs-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(snippets[parseInt(btn.dataset.index)].code).then(() => {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
        });
      });
    });

    document.getElementById('cs-close-btn').addEventListener('click', () => panel.remove());
  }

  function initSearchPanel() {
    const query = getSearchQuery();
    if (!query) return;
    browser.storage.local.get('snippets').then(r => {
      renderPanel(matchSnippets(query, r.snippets || []));
    });
  }

  // ── Save modal ───────────────────────────────────────────

  const LANGUAGES = ['javascript','typescript','python','bash','css','html','rust','go','java','cpp','c','sql','json','yaml','text'];

  function openSaveModal(code, detectedLang) {
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.innerHTML = `
      <div class="csm-backdrop"></div>
      <div class="csm-box" role="dialog" aria-modal="true">
        <div class="csm-header">
          <span class="csm-logo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M8 6L2 12L8 18" stroke="#A78BFA" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M16 6L22 12L16 18" stroke="#A78BFA" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M14 3L10 21" stroke="#7C3AED" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Save to CodeSnip
          </span>
          <button class="csm-close" aria-label="Close">✕</button>
        </div>
        <div class="csm-body">
          <div class="csm-row">
            <label class="csm-label">
              <span>Title</span>
              <input type="text" id="csm-title" placeholder="e.g. Async fetch helper" autocomplete="off" />
            </label>
            <label class="csm-label">
              <span>Language</span>
              <select id="csm-language">
                ${LANGUAGES.map(l => `<option value="${l}"${l === detectedLang ? ' selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
          </div>
          <label class="csm-label">
            <span>Keywords <em>comma-separated — matched against your searches</em></span>
            <input type="text" id="csm-keywords" placeholder="e.g. fetch, async, http request" autocomplete="off" />
          </label>
          <label class="csm-label">
            <span>Code</span>
            <textarea id="csm-code" rows="8" spellcheck="false">${escapeHtml(code)}</textarea>
          </label>
          <p class="csm-error hidden" id="csm-error">⚠ Keywords and code are required.</p>
          <div class="csm-actions">
            <button class="csm-btn-cancel">Cancel</button>
            <button class="csm-btn-save">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="7 3 7 8 15 8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              </svg>
              Save Snippet
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.csm-backdrop').addEventListener('click', close);
    overlay.querySelector('.csm-close').addEventListener('click', close);
    overlay.querySelector('.csm-btn-cancel').addEventListener('click', close);

    // Escape key closes
    const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    overlay.querySelector('.csm-btn-save').addEventListener('click', () => {
      const title    = overlay.querySelector('#csm-title').value.trim();
      const keywords = overlay.querySelector('#csm-keywords').value.trim();
      const language = overlay.querySelector('#csm-language').value;
      const codeVal  = overlay.querySelector('#csm-code').value.trim();
      const errEl    = overlay.querySelector('#csm-error');

      if (!keywords || !codeVal) { errEl.classList.remove('hidden'); return; }
      errEl.classList.add('hidden');

      const saveBtn = overlay.querySelector('.csm-btn-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      browser.storage.local.get('snippets').then(r => {
        const snippets = r.snippets || [];
        snippets.push({ id: Date.now().toString(), title: title || 'Untitled', keywords, language, code: codeVal });
        return browser.storage.local.set({ snippets });
      }).then(() => {
        showToast('✓ Snippet saved to CodeSnip');
        close();
      }).catch(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Snippet';
        errEl.textContent = 'Failed to save. Try again.';
        errEl.classList.remove('hidden');
      });
    });

    setTimeout(() => overlay.querySelector('#csm-title').focus(), 60);
  }

  // ── Toast ─────────────────────────────────────────────────

  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'codesnip-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('visible')); });
    setTimeout(() => {
      t.classList.remove('visible');
      setTimeout(() => t.remove(), 350);
    }, 2500);
  }

  // ── Code block hover buttons ─────────────────────────────

  function wrapCodeBlock(el) {
    if (
      el.closest(`.${WRAP_CLASS}`) ||
      el.closest(`#${PANEL_ID}`) ||
      el.closest(`#${MODAL_ID}`) ||
      el.dataset.codesnipWrapped
    ) return;

    const text = getCodeText(el);
    if (text.length < 12) return; // skip tiny inline snippets

    el.dataset.codesnipWrapped = '1';

    const wrapper = document.createElement('div');
    wrapper.className = WRAP_CLASS;
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);

    const btn = document.createElement('button');
    btn.className = BTN_CLASS;
    btn.title = 'Save to CodeSnip';
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M8 6L2 12L8 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M16 6L22 12L16 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M14 3L10 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      Save snippet
    `;
    wrapper.appendChild(btn);

    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      openSaveModal(getCodeText(el), guessLanguage(el));
    });
  }

  function findAndWrapCodeBlocks() {
    const selectors = [
      // Standard
      'pre code',
      'pre:not(:has(code))',
      // Highlight.js / Prism
      '.highlight code',
      '[class*="language-"]:not(#codesnip-panel *):not(#codesnip-save-modal *)',
      '[class*="hljs"]:not(#codesnip-panel *):not(#codesnip-save-modal *)',
      // W3Schools
      'div.w3-code',
      'div.w3-example div.w3-code',
      // Generic "example" code boxes used by many tutorial sites
      '.example-code',
      '.code-example',
      '.code-block',
      'div[class*="codeblock"]',
      'div[class*="code-box"]',
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => {
      // For pre > code, wrap the pre so the button sits on the block
      const target = el.tagName === 'CODE' && el.closest('pre') ? el.closest('pre') : el;
      wrapCodeBlock(target);
    });
  }

  function observeNewCodeBlocks() {
    new MutationObserver(mutations => {
      let should = false;
      for (const m of mutations)
        for (const node of m.addedNodes)
          if (node.nodeType === 1 && (
            node.tagName === 'PRE' ||
            node.querySelector?.('pre,code,.w3-code,[class*="language-"]')
          )) should = true;
      if (should) setTimeout(findAndWrapCodeBlocks, 250);
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Bootstrap ────────────────────────────────────────────

  function init() {
    initSearchPanel();
    findAndWrapCodeBlocks();
    observeNewCodeBlocks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // SPA URL change → re-run search panel
  let lastHref = location.href;
  new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      setTimeout(initSearchPanel, 500);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // ── Context-menu message from background script ──────────

  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type !== 'CODESNIP_SAVE_SELECTION') return;
    const text = (msg.text || '').trim();
    if (!text) return;
    // Open the save modal with the selected text and no pre-detected language
    openSaveModal(text, 'text');
  });


})();
