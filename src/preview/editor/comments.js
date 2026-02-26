// Editor comments module — render pins for unresolved comments,
// provide a panel to view/create comments, and handle resolve actions.

import * as api from './api-client.js';

// Module-level state for the comment panel controller.
let _projectId = null;
let _screenId = null;
let _localize = (key, fallback) => fallback ?? key;

export async function initComments({ projectId, screenId, localize }) {
  _projectId = projectId;
  _screenId = screenId;
  if (localize) _localize = localize;

  // Set up event listeners for comment pin clicks.
  // Each pin can be clicked to highlight the associated element on the canvas.
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('comment-pin')) {
      const elementId = e.target.dataset.elementId;
      const commentId = e.target.dataset.commentId;

      if (elementId) {
        const event = new CustomEvent('selectElement', { detail: { elementId } });
        document.dispatchEvent(event);
      }

      const event = new CustomEvent('focusComment', { detail: { commentId } });
      document.dispatchEvent(event);
    }
  });

  // Listen for commentsUpdated events (fired after resolve or add) to refresh the panel.
  document.addEventListener('commentsUpdated', () => {
    refreshCommentPanel();
  });

  // Initial load of comments into the panel.
  await refreshCommentPanel();
}

/**
 * Fetch comments from the API and re-render the panel contents.
 */
async function refreshCommentPanel() {
  const container = document.getElementById('comments-container');
  if (!container || !_projectId || !_screenId) return;

  try {
    const comments = await api.listComments(_projectId, _screenId);
    // Build panel DOM using safe helpers — all user text goes through escapeHtml.
    const wrapper = document.createElement('div');
    appendCommentForm(wrapper);
    appendCommentList(wrapper, comments);
    container.textContent = '';
    while (wrapper.firstChild) container.appendChild(wrapper.firstChild);
    attachCommentFormHandler();
    attachCommentResolveHandlers();
  } catch (err) {
    console.error('[comments] failed to refresh panel:', err);
  }
}

/**
 * Build the inline "add comment" form and append it to parent.
 */
function appendCommentForm(parent) {
  const form = document.createElement('div');
  form.className = 'comment-form';

  const textarea = document.createElement('textarea');
  textarea.id = 'comment-new-text';
  textarea.className = 'comment-textarea';
  textarea.placeholder = _localize('comments.placeholder', 'Write a comment...');
  textarea.rows = 2;

  const btn = document.createElement('button');
  btn.id = 'comment-add-btn';
  btn.className = 'comment-add-btn';
  btn.disabled = true;
  btn.textContent = _localize('comments.add', 'Add comment');

  form.appendChild(textarea);
  form.appendChild(btn);
  parent.appendChild(form);
}

/**
 * Build the comment list and append to parent. Uses DOM methods for safety.
 */
function appendCommentList(parent, comments) {
  const unresolved = (comments || []).filter(c => !c.resolved);

  if (unresolved.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'comments-panel-empty';
    empty.textContent = _localize('noComments', 'No comments yet');
    parent.appendChild(empty);
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'comments-panel';

  for (const c of unresolved) {
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.dataset.commentId = c.id;

    const badge = document.createElement('div');
    badge.className = 'comment-pin-badge';
    badge.textContent = String(c.pin_number);

    const content = document.createElement('div');
    content.className = 'comment-content';

    const text = document.createElement('div');
    text.className = 'comment-text';
    text.textContent = c.text;

    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    const author = c.author === 'ai' ? 'AI' : 'User';
    meta.textContent = `${author} \u2022 ${new Date(c.created_at).toLocaleDateString()}`;

    content.appendChild(text);
    content.appendChild(meta);

    const resolveBtn = document.createElement('button');
    resolveBtn.className = 'comment-resolve-btn';
    resolveBtn.dataset.commentId = c.id;
    resolveBtn.title = _localize('resolveComment', 'Resolve');
    resolveBtn.textContent = '\u2713';

    item.appendChild(badge);
    item.appendChild(content);
    item.appendChild(resolveBtn);
    panel.appendChild(item);
  }

  parent.appendChild(panel);
}

/**
 * Wire up the add-comment form submit and textarea validation.
 */
function attachCommentFormHandler() {
  const textarea = document.getElementById('comment-new-text');
  const addBtn = document.getElementById('comment-add-btn');
  if (!textarea || !addBtn) return;

  // Enable button only when there is non-whitespace text.
  textarea.addEventListener('input', () => {
    addBtn.disabled = !textarea.value.trim();
  });

  addBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;

    addBtn.disabled = true;
    try {
      await api.addComment(_projectId, _screenId, { text, author: 'user' });
      // Trigger full refresh so the new comment appears in the list and pin overlay.
      const event = new CustomEvent('commentsUpdated');
      document.dispatchEvent(event);
    } catch (err) {
      console.error('[comments] failed to add comment:', err);
      addBtn.disabled = false;
    }
  });
}

export function renderCommentPins(comments = [], screen) {
  // Render overlay pins for unresolved comments on screen elements.
  const unresolved = comments.filter(c => !c.resolved);
  const html = [];

  for (const comment of unresolved) {
    if (!comment.element_id || !screen) continue;

    html.push(
      `<div class="comment-pin" data-element-id="${escapeAttr(comment.element_id)}" data-comment-id="${escapeAttr(comment.id)}" ` +
      `style="position: absolute; width: 20px; height: 20px; border-radius: 50%; ` +
      `background: #FCD34D; color: #111; font-size: 11px; font-weight: 600; ` +
      `display: flex; align-items: center; justify-content: center; cursor: pointer; ` +
      `border: 1px solid #F59E0B; z-index: 1000; pointer-events: auto;">${comment.pin_number}</div>`
    );
  }

  return html.join('');
}

// Legacy export kept for backward compatibility — panel rendering now uses DOM methods.
export function renderCommentPanel(comments = [], localize) {
  const unresolved = (comments || []).filter(c => !c.resolved);
  if (unresolved.length === 0) {
    return `<div class="comments-panel-empty">${escapeAttr(localize('noComments', 'No comments yet'))}</div>`;
  }
  return `<div class="comments-panel">${unresolved.map(c => {
    const author = c.author === 'ai' ? 'AI' : 'User';
    return `<div class="comment-item" data-comment-id="${escapeAttr(c.id)}">` +
      `<div class="comment-pin-badge">${c.pin_number}</div>` +
      `<div class="comment-content">` +
      `<div class="comment-text">${escapeAttr(c.text)}</div>` +
      `<div class="comment-meta">${author} \u2022 ${new Date(c.created_at).toLocaleDateString()}</div>` +
      `</div>` +
      `<button class="comment-resolve-btn" data-comment-id="${escapeAttr(c.id)}" title="${escapeAttr(localize('resolveComment', 'Resolve'))}">\u2713</button>` +
      `</div>`;
  }).join('')}</div>`;
}

/**
 * Escape a string for safe insertion into HTML attributes and text content.
 */
function escapeAttr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function attachCommentResolveHandlers() {
  document.querySelectorAll('.comment-resolve-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      try {
        await api.resolveComment(_projectId, _screenId, commentId);
        const event = new CustomEvent('commentsUpdated');
        document.dispatchEvent(event);
      } catch (err) {
        console.error('[comments] failed to resolve comment:', err);
      }
    });
  });
}
