import './style.css';

const app = document.querySelector('#app');
const storageKey = 'innerly.credentials';
const state = {
  credentials: readCredentials(),
  entries: [],
  activeId: null,
  mode: 'signin',
  query: '',
  busy: false,
  editing: false,
  notice: '',
  error: '',
};

function readCredentials() {
  try { return JSON.parse(sessionStorage.getItem(storageKey) || 'null'); }
  catch { return null; }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function authHeader() {
  if (!state.credentials) return {};
  return { Authorization: `Bearer ${state.credentials.token}` };
}

async function api(path, options = {}) {
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}${path}`, {
    ...options,
    headers: {
      ...authHeader(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401) {
      signOut();
      throw new Error('Your session ended. Please sign in again.');
    }
    const message = response.status >= 500
      ? 'The server could not complete the request. Check the backend console for details.'
      : await response.text().catch(() => '');
    const error = new Error(message || `Something went wrong (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : response.text();
}

function signOut() {
  state.credentials = null;
  state.entries = [];
  state.activeId = null;
  sessionStorage.removeItem(storageKey);
  render();
}

function formatDate(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function todayLabel() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
}

function initials(name) { return (name || 'Y').trim().slice(0, 1).toUpperCase(); }

function filteredEntries() {
  const query = state.query.trim().toLowerCase();
  const entries = [...state.entries].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return query ? entries.filter((entry) => `${entry.title} ${entry.content}`.toLowerCase().includes(query)) : entries;
}

function entryPreview(entry) {
  const content = (entry.content || '').replace(/\s+/g, ' ').trim();
  return content.length > 96 ? `${content.slice(0, 96)}…` : content || 'A quiet page, waiting for your words.';
}

function renderAuth() {
  const signup = state.mode === 'signup';
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-art" aria-label="A quiet place to write">
        <div class="art-top"><a class="brand brand-light" href="#"><span class="brand-mark">i.</span> innerly</a><span class="art-index">A SPACE OF YOUR OWN</span></div>
        <div class="art-copy"><span class="eyebrow">MAKE ROOM FOR YOU</span><h1>Some thoughts<br>deserve a place<br>to land.</h1><p>A little space to notice the days, keep the moments, and hear yourself think.</p></div>
        <div class="art-bottom"><span class="sun-mark">✳</span><span>One page at a time.</span><span class="art-note">EST. TODAY</span></div>
      </section>
      <section class="auth-panel"><div class="auth-mobile-brand"><a class="brand" href="#"><span class="brand-mark">i.</span> innerly</a></div>
        <div class="auth-card"><span class="eyebrow">YOUR PRIVATE JOURNAL</span><h2>${signup ? 'Start your journal.' : 'Welcome back.'}</h2><p class="auth-intro">${signup ? 'Make a little room for your thoughts.' : 'Your pages are right where you left them.'}</p>
          ${state.error ? `<div class="alert alert-error" role="alert">${escapeHtml(state.error)}</div>` : ''}
          <form id="auth-form" class="form-stack">
            ${signup ? '<label>Your name<input name="username" autocomplete="username" placeholder="e.g. Sam" required minlength="3" /></label>' : '<label>Your name<input name="username" autocomplete="username" placeholder="The name you signed up with" required /></label>'}
            <label>Password<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${signup ? 'At least 6 characters' : 'Your password'}" required ${signup ? 'minlength="6"' : ''} /></label>
            ${signup ? '<label>Email <span class="optional">OPTIONAL</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" /></label>' : ''}
            <button class="button button-primary button-wide" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Please wait…' : signup ? 'Create your journal' : 'Open my journal'} <span aria-hidden="true">↗</span></button>
          </form>
          <p class="auth-switch">${signup ? 'Already have a journal?' : 'New around here?'} <button class="text-button" id="toggle-auth">${signup ? 'Sign in' : 'Create an account'}</button></p>
          <p class="privacy-note"><span>✳</span> Your journal is private to your account.</p>
        </div>
        <span class="panel-foot">A softer place to keep the day.</span>
      </section>
    </main>`;
  document.querySelector('#toggle-auth').addEventListener('click', () => { state.mode = signup ? 'signin' : 'signup'; state.error = ''; render(); });
  document.querySelector('#auth-form').addEventListener('submit', handleAuth);
}

async function handleAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const username = String(form.get('username') || '').trim();
  const password = String(form.get('password') || '');
  state.busy = true; state.error = ''; renderAuth();
  let accountCreated = false;
  try {
    if (state.mode === 'signup') {
      await api('/public/signup', { method: 'POST', body: JSON.stringify({ userName: username, email: form.get('email') || '', password }) });
      accountCreated = true;
    }
    const login = await api('/public/login', { method: 'POST', body: JSON.stringify({ userName: username, password }) });
    state.credentials = { username, token: login.token };
    sessionStorage.setItem(storageKey, JSON.stringify(state.credentials));
    await api('/user/me');
    state.busy = false; state.error = ''; state.notice = state.mode === 'signup' ? 'Your journal is ready.' : '';
    await loadEntries();
  } catch (error) {
    state.busy = false;
    if (state.credentials) { state.credentials = null; sessionStorage.removeItem(storageKey); }
    if (accountCreated) {
      state.mode = 'signin';
      state.error = 'Your account was created, but automatic sign-in failed. Sign in with the same name and password.';
    } else if (error.status === 409) {
      state.mode = 'signin';
      state.error = 'That name is already registered. Sign in instead.';
    } else {
      state.error = error.message || (state.mode === 'signup' ? 'We couldn’t create your account.' : 'We couldn’t sign you in. Check your name and password.');
    }
    render();
  }
}

async function loadEntries() {
  try {
    const data = await api('/journal');
    state.entries = Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.message.includes('session ended')) return;
    state.entries = [];
    state.error = 'Could not load your pages. Check that the journal service is running.';
  }
  render();
}

function render() {
  if (!state.credentials) { renderAuth(); return; }
  const entries = filteredEntries();
  const active = state.entries.find((entry) => String(entry.id) === String(state.activeId));
  app.innerHTML = `
    <div class="workspace">
      <aside class="sidebar"><a class="brand" href="#"><span class="brand-mark">i.</span> innerly</a>
        <div class="side-label">YOUR SPACE</div><button class="nav-item active" id="all-pages"><span>▤</span> All pages <span class="nav-count">${state.entries.length}</span></button>
        <div class="side-bottom"><div class="profile"><span class="avatar">${escapeHtml(initials(state.credentials.username))}</span><span class="profile-name">${escapeHtml(state.credentials.username)}<small>My journal</small></span><button id="signout" class="signout-button" type="button">Sign out</button></div></div>
      </aside>
      <main class="main-area"><header class="topbar"><div class="breadcrumb">Your space <span>/</span> <strong>${active ? 'Reading page' : 'All pages'}</strong></div><div class="top-actions"><label class="search-box"><span>⌕</span><input id="search" type="search" placeholder="Find a thought…" value="${escapeHtml(state.query)}" aria-label="Search journal entries"/><kbd>⌘ K</kbd></label><button class="button button-primary new-entry" id="new-entry">＋ <span>New page</span></button></div></header>
        <section class="content-area">${state.error ? `<div class="alert alert-error" role="alert">${escapeHtml(state.error)}</div>` : ''}${state.notice ? `<div class="alert alert-success">${escapeHtml(state.notice)}</div>` : ''}
          ${active ? renderEditor(active) : renderList(entries)}
        </section>
      </main>
    </div>
    <dialog id="entry-dialog" class="entry-dialog"><form id="entry-form" method="dialog"><div class="dialog-head"><div><span class="eyebrow">A NEW PAGE</span><h2>What’s on your mind?</h2></div><button class="icon-button" type="button" id="close-dialog" aria-label="Close">×</button></div><label class="dialog-title-label" for="entry-title">Give this page a title</label><input id="entry-title" name="title" maxlength="120" placeholder="A thought, a moment, a small thing…" required/><label class="dialog-title-label" for="entry-content">Let it out</label><textarea id="entry-content" name="content" rows="9" placeholder="Start wherever you are…"></textarea><div class="dialog-actions"><span class="privacy-note">✳ Just for you</span><button class="button button-primary" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Saving…' : 'Save page'} <span>↗</span></button></div></form></dialog>`;
  document.querySelector('#signout').addEventListener('click', signOut);
  document.querySelector('#all-pages').addEventListener('click', () => { state.activeId = null; state.error = ''; render(); });
  document.querySelector('#new-entry').addEventListener('click', openNewEntry);
  document.querySelector('#empty-new')?.addEventListener('click', openNewEntry);
  document.querySelector('#search').addEventListener('input', (event) => { state.query = event.target.value; const pos = event.target.selectionStart; render(); const input = document.querySelector('#search'); input.focus(); input.setSelectionRange(pos, pos); });
  document.querySelectorAll('[data-entry-id]').forEach((button) => button.addEventListener('click', () => { state.activeId = button.dataset.entryId; state.editing = false; state.notice = ''; render(); }));
  const dialog = document.querySelector('#entry-dialog');
  document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  document.querySelector('#entry-form').addEventListener('submit', saveNewEntry);
  if (active) bindEditor(active);
}

function renderList(entries) {
  const count = state.entries.length;
  const recent = state.entries.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
  return `<div class="page-heading"><div><span class="eyebrow">${todayLabel()}</span><h1>Your pages<span class="heading-period">.</span></h1><p>A place for everything on your mind.</p></div><div class="page-count"><span>${String(count).padStart(2, '0')}</span><small>${count === 1 ? 'PAGE KEPT' : 'PAGES KEPT'}</small></div></div>
    ${count === 0 ? `<section class="empty-state"><div class="empty-illustration"><span class="empty-sun">✳</span><span class="empty-page"></span></div><span class="eyebrow">A FRESH PAGE</span><h2>Begin with today.</h2><p>The first line doesn’t have to be perfect.<br>It just has to be yours.</p><button class="button button-primary" id="empty-new">Write your first page <span>↗</span></button></section>` : `<div class="list-toolbar"><span>${state.query ? `${entries.length} ${entries.length === 1 ? 'result' : 'results'}` : 'RECENTLY KEPT'}</span>${recent ? `<span>LAST PAGE · ${escapeHtml(formatDate(recent.date))}</span>` : ''}</div><div class="entry-grid">${entries.length ? entries.map((entry, index) => `<button class="entry-card" data-entry-id="${escapeHtml(entry.id)}" style="--delay:${Math.min(index, 8) * 35}ms"><span class="entry-card-top"><span class="entry-date">${escapeHtml(formatDate(entry.date))}</span><span class="entry-arrow">↗</span></span><span class="entry-title">${escapeHtml(entry.title || 'Untitled page')}</span><span class="entry-preview">${escapeHtml(entryPreview(entry))}</span><span class="entry-card-foot"><span>${Math.max(1, (entry.content || '').trim().split(/\s+/).filter(Boolean).length)} WORDS</span><span class="entry-dot">✳</span></span></button>`).join('') : `<div class="no-results">No pages match “${escapeHtml(state.query)}”.</div>`}</div>`}
    <div class="list-footer"><span>✳</span> A good day to begin again.</div>`;
}

function renderEditor(entry) {
  const content = state.editing
    ? `<form id="edit-form" class="edit-form"><label class="dialog-title-label" for="edit-title">Page title</label><input id="edit-title" name="title" maxlength="120" value="${escapeHtml(entry.title || '')}" required/><label class="dialog-title-label" for="edit-content">Your words</label><textarea id="edit-content" name="content" rows="12">${escapeHtml(entry.content || '')}</textarea><div class="edit-actions"><button class="button button-quiet" type="button" id="cancel-edit">Cancel</button><button class="button button-primary" type="submit">Save changes <span>↗</span></button></div></form>`
    : `<div class="reader-content">${escapeHtml(entry.content || '').replace(/\n/g, '<br>')}</div>`;
  return `<article class="editor-view"><button class="back-link" id="back-link">← <span>All pages</span></button><div class="editor-meta"><span class="eyebrow">KEPT ON ${escapeHtml(formatDate(entry.date).toUpperCase())}</span><div><button class="icon-button" id="edit-entry" title="Edit page" aria-label="Edit page">✎</button><button class="icon-button danger-icon" id="delete-entry" title="Delete page" aria-label="Delete page">⌫</button></div></div>${state.editing ? '' : `<h1 class="reader-title">${escapeHtml(entry.title || 'Untitled page')}</h1><div class="reader-rule"><span>✳</span></div>`}${content}<div class="reader-foot">END OF PAGE <span>✳</span></div></article>`;
}

function bindEditor(entry) {
  document.querySelector('#back-link').addEventListener('click', () => { state.activeId = null; render(); });
  document.querySelector('#edit-entry').addEventListener('click', () => { state.editing = !state.editing; render(); });
  if (state.editing) {
    document.querySelector('#cancel-edit').addEventListener('click', () => { state.editing = false; render(); });
    document.querySelector('#edit-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      updateEntry(entry, String(form.get('title') || '').trim(), String(form.get('content') || '').trim());
    });
  }
  document.querySelector('#delete-entry').addEventListener('click', async () => {
    if (!confirm('Delete this page? This cannot be undone.')) return;
    try { await api(`/journal/id/${encodeURIComponent(entry.id)}`, { method: 'DELETE' }); state.entries = state.entries.filter((item) => String(item.id) !== String(entry.id)); state.activeId = null; state.notice = 'Page deleted.'; render(); }
    catch (error) { state.error = error.message; render(); }
  });
}

async function updateEntry(entry, title, content) {
  try {
    const updated = await api(`/journal/id/${encodeURIComponent(entry.id)}`, { method: 'PUT', body: JSON.stringify({ title, content }) });
    Object.assign(entry, updated || { title, content }); state.editing = false; state.notice = 'Your changes are saved.'; render();
  } catch (error) { state.error = error.message; render(); }
}

function openNewEntry() { document.querySelector('#entry-dialog').showModal(); document.querySelector('#entry-title').focus(); }

async function saveNewEntry(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const title = String(form.get('title') || '').trim();
  const content = String(form.get('content') || '').trim();
  if (!title) return;
  state.busy = true; render();
  try {
    const created = await api('/journal', { method: 'POST', body: JSON.stringify({ title, content }) });
    if (created && typeof created === 'object') state.entries.unshift(created);
    else await loadEntries();
    state.busy = false; state.activeId = created?.id ? String(created.id) : null; state.notice = 'A new page, kept.'; render();
  } catch (error) { state.busy = false; state.error = error.message; render(); }
}

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('#search')?.focus(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n' && state.credentials) { event.preventDefault(); openNewEntry(); }
});

if (state.credentials) {
  api('/user/me').then(loadEntries).catch(() => { state.credentials = null; sessionStorage.removeItem(storageKey); render(); });
} else render();
