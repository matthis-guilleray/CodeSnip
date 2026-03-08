// CodeSnip - Popup Script

const viewList = document.getElementById('view-list');
const viewForm = document.getElementById('view-form');
const snippetsList = document.getElementById('snippets-list');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const btnAdd = document.getElementById('btn-add');
const btnBack = document.getElementById('btn-back');
const btnCancel = document.getElementById('btn-cancel');
const btnSave = document.getElementById('btn-save');
const formTitle = document.getElementById('form-title');
const formError = document.getElementById('form-error');
const fTitle = document.getElementById('f-title');
const fKeywords = document.getElementById('f-keywords');
const fLanguage = document.getElementById('f-language');
const fCode = document.getElementById('f-code');

let snippets = [];
let editingId = null;

// ── Storage helpers ──────────────────────────────────────
function loadSnippets() {
  return browser.storage.local.get('snippets').then(r => {
    snippets = r.snippets || [];
  });
}

function saveSnippets() {
  return browser.storage.local.set({ snippets });
}

// ── Render list ──────────────────────────────────────────
function renderList(filter = '') {
  const filtered = filter
    ? snippets.filter(s =>
        s.title.toLowerCase().includes(filter) ||
        s.keywords.toLowerCase().includes(filter) ||
        s.language.toLowerCase().includes(filter)
      )
    : snippets;

  snippetsList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(snippet => {
    const item = document.createElement('div');
    item.className = 'snippet-item';
    item.innerHTML = `
      <span class="si-lang">${escapeHtml(snippet.language)}</span>
      <div class="si-info">
        <div class="si-title">${escapeHtml(snippet.title || 'Untitled')}</div>
        <div class="si-keywords">${escapeHtml(snippet.keywords)}</div>
      </div>
      <div class="si-actions">
        <button class="btn-icon edit" data-id="${snippet.id}" title="Edit">✎</button>
        <button class="btn-icon delete" data-id="${snippet.id}" title="Delete">✕</button>
      </div>
    `;
    snippetsList.appendChild(item);
  });

  snippetsList.querySelectorAll('.btn-icon.edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openEditForm(btn.dataset.id);
    });
  });

  snippetsList.querySelectorAll('.btn-icon.delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteSnippet(btn.dataset.id);
    });
  });
}

// ── Views ────────────────────────────────────────────────
function showList() {
  viewForm.classList.remove('active');
  viewList.classList.add('active');
  editingId = null;
  renderList(searchInput.value.toLowerCase());
}

function showForm() {
  viewList.classList.remove('active');
  viewForm.classList.add('active');
}

function openAddForm() {
  editingId = null;
  formTitle.textContent = 'New Snippet';
  fTitle.value = '';
  fKeywords.value = '';
  fLanguage.value = 'javascript';
  fCode.value = '';
  formError.classList.add('hidden');
  showForm();
}

function openEditForm(id) {
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;
  editingId = id;
  formTitle.textContent = 'Edit Snippet';
  fTitle.value = snippet.title || '';
  fKeywords.value = snippet.keywords || '';
  fLanguage.value = snippet.language || 'javascript';
  fCode.value = snippet.code || '';
  formError.classList.add('hidden');
  showForm();
}

// ── CRUD ─────────────────────────────────────────────────
function saveForm() {
  const keywords = fKeywords.value.trim();
  const code = fCode.value.trim();

  if (!keywords || !code) {
    formError.classList.remove('hidden');
    return;
  }
  formError.classList.add('hidden');

  if (editingId) {
    const idx = snippets.findIndex(s => s.id === editingId);
    if (idx !== -1) {
      snippets[idx] = {
        ...snippets[idx],
        title: fTitle.value.trim() || 'Untitled',
        keywords,
        language: fLanguage.value,
        code,
      };
    }
  } else {
    snippets.push({
      id: Date.now().toString(),
      title: fTitle.value.trim() || 'Untitled',
      keywords,
      language: fLanguage.value,
      code,
    });
  }

  saveSnippets().then(() => showList());
}

function deleteSnippet(id) {
  snippets = snippets.filter(s => s.id !== id);
  saveSnippets().then(() => renderList(searchInput.value.toLowerCase()));
}

// ── Utilities ────────────────────────────────────────────
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Export ───────────────────────────────────────────────
const btnExport       = document.getElementById('btn-export');
const exportDropdown  = document.getElementById('export-dropdown');
const exportJson      = document.getElementById('export-json');
const exportMd        = document.getElementById('export-md');

function toggleExportDropdown(e) {
  e.stopPropagation();
  exportDropdown.classList.toggle('hidden');
}

function closeExportDropdown() {
  exportDropdown.classList.add('hidden');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAsJson() {
  if (!snippets.length) return;
  const data = JSON.stringify(snippets, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`codesnip-${date}.json`, data, 'application/json');
  closeExportDropdown();
}

function exportAsMarkdown() {
  if (!snippets.length) return;
  const date  = new Date().toISOString().slice(0, 10);
  const lines = [`# CodeSnip Export — ${date}\n`];

  // Group by language
  const byLang = {};
  snippets.forEach(s => {
    const lang = s.language || 'text';
    if (!byLang[lang]) byLang[lang] = [];
    byLang[lang].push(s);
  });

  Object.entries(byLang).forEach(([lang, group]) => {
    lines.push(`## ${lang.charAt(0).toUpperCase() + lang.slice(1)}\n`);
    group.forEach(s => {
      lines.push(`### ${s.title || 'Untitled'}`);
      lines.push(`**Keywords:** \`${s.keywords}\`\n`);
      lines.push(`\`\`\`${lang}`);
      lines.push(s.code);
      lines.push('```\n');
    });
  });

  downloadFile(`codesnip-${date}.md`, lines.join('\n'), 'text/markdown');
  closeExportDropdown();
}

btnExport.addEventListener('click', toggleExportDropdown);
exportJson.addEventListener('click', exportAsJson);
exportMd.addEventListener('click', exportAsMarkdown);
document.addEventListener('click', closeExportDropdown);


btnAdd.addEventListener('click', openAddForm);
btnBack.addEventListener('click', showList);
btnCancel.addEventListener('click', showList);
btnSave.addEventListener('click', saveForm);
searchInput.addEventListener('input', () => renderList(searchInput.value.toLowerCase()));

// ── Init ─────────────────────────────────────────────────
loadSnippets().then(() => renderList());
