/**
 * Approval panel for the in-browser editor.
 *
 * Renders 3 action buttons (Accept / Accept with Comments / Reject) below
 * the right panel so a reviewer can sign off on a screen without leaving
 * the editor.  The "Accept with comments" action requires at least one
 * unresolved comment on the current screen — the button is disabled when
 * none exist so reviewers can't accidentally submit a misleading approval.
 *
 * After a successful submission the module dispatches a custom DOM event
 * `approvalSubmitted` so other parts of the editor (e.g. the sidebar status
 * badge added in M21) can react without a hard dependency on this module.
 *
 * Pure helpers (buildApprovalHtml, buildRejectDialogHtml) are exported for
 * testability in Node.js without a browser.  initApproval() is the single
 * DOM-aware entry point.
 */

// i18n helper — safe fallback when the module hasn't loaded yet or in Node.js tests.
const _t = (key, fallback) =>
  typeof globalThis.window !== 'undefined' && typeof window.t === 'function'
    ? window.t(key, fallback)
    : (fallback ?? key);

// ---------------------------------------------------------------------------
// Pure helpers (testable in Node.js)
// ---------------------------------------------------------------------------

/**
 * Build the HTML string for the approval panel container.
 * All content is server-controlled static markup — no user strings are
 * interpolated into HTML attributes or content here.
 *
 * @returns {string}
 */
export function buildApprovalHtml() {
  return `
<div id="approval-panel" style="
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--border-default);
  background: var(--surface-1);
  flex-shrink: 0;
">
  <div style="
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 4px;
  ">Approval</div>
  <div style="display: flex; flex-direction: column; gap: 6px;">
    <button id="approval-btn-accept" style="
      background: #16A34A;
      color: #fff;
      border: none;
      border-radius: var(--radius-md);
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: not-allowed;
      text-align: center;
      transition: opacity 0.15s;
      opacity: 0.45;
    " disabled></button>
    <button id="approval-btn-accept-comments" style="
      background: #2563EB;
      color: #fff;
      border: none;
      border-radius: var(--radius-md);
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: not-allowed;
      text-align: center;
      transition: opacity 0.15s;
      opacity: 0.45;
    " disabled></button>
    <button id="approval-btn-reject" style="
      background: #DC2626;
      color: #fff;
      border: none;
      border-radius: var(--radius-md);
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: not-allowed;
      text-align: center;
      transition: opacity 0.15s;
      opacity: 0.45;
    " disabled></button>
  </div>
  <div id="approval-reject-dialog" style="display: none; flex-direction: column; gap: 6px; margin-top: 4px;">
    <label style="font-size: 11px; color: var(--text-secondary);"></label>
    <textarea id="approval-reject-reason" rows="3" style="
      background: var(--surface-2);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-family: var(--font-ui);
      font-size: 12px;
      padding: 6px 8px;
      resize: vertical;
      box-sizing: border-box;
      width: 100%;
    "></textarea>
    <div style="display: flex; gap: 6px;">
      <button id="approval-btn-reject-confirm" style="
        flex: 1;
        background: #DC2626;
        color: #fff;
        border: none;
        border-radius: var(--radius-md);
        padding: 6px 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      "></button>
      <button id="approval-btn-reject-cancel" style="
        flex: 1;
        background: var(--surface-3);
        color: var(--text-primary);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 6px 8px;
        font-size: 12px;
        cursor: pointer;
      "></button>
    </div>
  </div>
</div>`.trim();
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let _projectId = null;
let _screenId = null;

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

/**
 * POST an approval action to the backend.
 *
 * @param {string} projectId
 * @param {string} screenId
 * @param {'accept'|'accept_with_comments'|'reject'} action
 * @param {string} [reason='']
 * @returns {Promise<object>} Parsed response JSON
 */
export async function submitApproval(projectId, screenId, action, reason = '') {
  const body = { action };
  if (reason) body.reason = reason;
  const res = await fetch(`/api/projects/${projectId}/screens/${screenId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Approval request failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Fetch unresolved comments for the current screen.
 * Returns an empty array on any network error to avoid breaking the panel.
 *
 * @param {string} projectId
 * @param {string} screenId
 * @returns {Promise<Array>}
 */
async function fetchUnresolvedComments(projectId, screenId) {
  try {
    const res = await fetch(
      `/api/projects/${projectId}/screens/${screenId}/comments?include_resolved=false`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    // Support both { comments: [...] } and plain array responses
    return Array.isArray(data) ? data : (data.comments ?? []);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Show a toast notification using the existing #toast-container.
 * Falls back silently if the container is absent.
 *
 * @param {string} msg
 */
function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  // textContent is safe — no HTML parsing
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

/**
 * Set all three primary approval buttons to enabled/disabled.
 *
 * @param {boolean} enabled
 */
function setButtonsEnabled(enabled) {
  const ids = ['approval-btn-accept', 'approval-btn-accept-comments', 'approval-btn-reject'];
  for (const id of ids) {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '1' : '0.45';
      btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }
  }
}

/**
 * Collapse the reject dialog and clear its textarea.
 */
function closeRejectDialog() {
  const dialog = document.getElementById('approval-reject-dialog');
  const textarea = document.getElementById('approval-reject-reason');
  if (dialog) dialog.style.display = 'none';
  if (textarea) textarea.value = '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the approval panel.
 *
 * Reads project/screen IDs from the #editor-canvas data attributes so the
 * module stays self-contained — callers don't need to pass any arguments.
 *
 * Steps:
 * 1. Inject the panel HTML into #editor-right-panel (below the tab contents).
 * 2. Populate all button/label text via i18n so the panel respects the locale.
 * 3. Enable the Accept and Reject buttons immediately.
 * 4. Fetch unresolved comments to conditionally enable Accept-with-comments.
 * 5. Wire up click handlers for all three actions.
 */
export async function initApproval() {
  const canvas = document.getElementById('editor-canvas');
  if (!canvas) return;

  _projectId = canvas.dataset.projectId;
  _screenId = canvas.dataset.screenId;
  if (!_projectId || !_screenId) return;

  // Inject panel HTML once — guard against double-init on hot reload
  const existing = document.getElementById('approval-panel');
  if (!existing) {
    const rightPanel = document.getElementById('editor-right-panel');
    if (!rightPanel) return;

    const wrapper = document.createElement('div');
    // Safe: buildApprovalHtml() returns controlled static markup —
    // no user-supplied strings are interpolated into the HTML.
    // eslint-disable-next-line no-unsanitized/property
    wrapper.innerHTML = buildApprovalHtml();
    rightPanel.appendChild(wrapper.firstElementChild);
  }

  // Populate localised button/label text using textContent (safe, no HTML)
  const btnAccept = document.getElementById('approval-btn-accept');
  const btnAcceptComments = document.getElementById('approval-btn-accept-comments');
  const btnReject = document.getElementById('approval-btn-reject');
  const rejectLabel = document.querySelector('#approval-reject-dialog label');
  const rejectTextarea = document.getElementById('approval-reject-reason');
  const btnRejectConfirm = document.getElementById('approval-btn-reject-confirm');
  const btnRejectCancel = document.getElementById('approval-btn-reject-cancel');

  if (btnAccept) btnAccept.textContent = _t('approval.accept', 'Accept');
  if (btnAcceptComments) btnAcceptComments.textContent = _t('approval.acceptWithComments', 'Accept with Comments');
  if (btnReject) btnReject.textContent = _t('approval.reject', 'Reject');
  if (rejectLabel) rejectLabel.textContent = _t('approval.rejectReason', 'Reason for rejection');
  if (rejectTextarea) rejectTextarea.placeholder = _t('approval.rejectReasonPlaceholder', 'Describe what needs to change...');
  if (btnRejectConfirm) btnRejectConfirm.textContent = _t('approval.reject', 'Reject');
  if (btnRejectCancel) btnRejectCancel.textContent = 'Cancel';

  // Accept and Reject have no preconditions — enable immediately
  if (btnAccept) {
    btnAccept.disabled = false;
    btnAccept.style.opacity = '1';
    btnAccept.style.cursor = 'pointer';
  }
  if (btnReject) {
    btnReject.disabled = false;
    btnReject.style.opacity = '1';
    btnReject.style.cursor = 'pointer';
  }

  // Accept with Comments requires at least one unresolved comment to prevent
  // a misleading "accepted" status when reviewers haven't actually left notes
  const unresolved = await fetchUnresolvedComments(_projectId, _screenId);
  const hasUnresolved = unresolved.length > 0;
  if (btnAcceptComments) {
    btnAcceptComments.disabled = !hasUnresolved;
    btnAcceptComments.style.opacity = hasUnresolved ? '1' : '0.45';
    btnAcceptComments.style.cursor = hasUnresolved ? 'pointer' : 'not-allowed';
    btnAcceptComments.title = hasUnresolved
      ? _t('approval.acceptWithComments', 'Accept with Comments')
      : _t('approval.noUnresolvedComments', 'No unresolved comments to submit with');
  }

  // --- Accept ---
  btnAccept?.addEventListener('click', async () => {
    closeRejectDialog();
    setButtonsEnabled(false);
    try {
      const result = await submitApproval(_projectId, _screenId, 'accept');
      showToast(_t('approval.success.accepted', 'Screen accepted'));
      dispatchApprovalEvent(result.status ?? 'accepted');
    } catch (err) {
      console.error('[approval] accept failed', err);
      showToast(_t('toast.error', 'Error'));
    } finally {
      setButtonsEnabled(true);
    }
  });

  // --- Accept with Comments ---
  btnAcceptComments?.addEventListener('click', async () => {
    // Guard in case the button is visually enabled but logically disabled
    if (btnAcceptComments.disabled) return;
    closeRejectDialog();
    setButtonsEnabled(false);
    try {
      const result = await submitApproval(_projectId, _screenId, 'accept_with_comments');
      showToast(_t('approval.success.acceptedWithComments', 'Accepted with comments — iteration needed'));
      dispatchApprovalEvent(result.status ?? 'accepted_with_comments');
    } catch (err) {
      console.error('[approval] accept_with_comments failed', err);
      showToast(_t('toast.error', 'Error'));
    } finally {
      setButtonsEnabled(true);
      // Re-check after submit in case comment state changed during the session
      const fresh = await fetchUnresolvedComments(_projectId, _screenId);
      const still = fresh.length > 0;
      if (btnAcceptComments) {
        btnAcceptComments.disabled = !still;
        btnAcceptComments.style.opacity = still ? '1' : '0.45';
        btnAcceptComments.style.cursor = still ? 'pointer' : 'not-allowed';
      }
    }
  });

  // --- Reject (toggle dialog) ---
  btnReject?.addEventListener('click', () => {
    const dialog = document.getElementById('approval-reject-dialog');
    if (!dialog) return;
    // Toggle: close if already open, open if closed
    if (dialog.style.display === 'flex') {
      closeRejectDialog();
    } else {
      dialog.style.display = 'flex';
      document.getElementById('approval-reject-reason')?.focus();
    }
  });

  // --- Reject confirm (send) ---
  btnRejectConfirm?.addEventListener('click', async () => {
    const textarea = document.getElementById('approval-reject-reason');
    const reason = textarea?.value?.trim() ?? '';
    // Require at least one character so the backend always receives useful context
    if (!reason) {
      textarea?.focus();
      return;
    }
    setButtonsEnabled(false);
    try {
      const result = await submitApproval(_projectId, _screenId, 'reject', reason);
      closeRejectDialog();
      showToast(_t('approval.success.rejected', 'Screen rejected'));
      dispatchApprovalEvent(result.status ?? 'rejected');
    } catch (err) {
      console.error('[approval] reject failed', err);
      showToast(_t('toast.error', 'Error'));
    } finally {
      setButtonsEnabled(true);
    }
  });

  // --- Reject cancel ---
  btnRejectCancel?.addEventListener('click', () => {
    closeRejectDialog();
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Dispatch a custom DOM event so sibling modules (sidebar badge, etc.) can
 * react to the outcome without a direct import dependency on this module.
 *
 * @param {string} status - 'accepted' | 'accepted_with_comments' | 'rejected'
 */
function dispatchApprovalEvent(status) {
  document.dispatchEvent(
    new CustomEvent('approvalSubmitted', {
      detail: { status, screenId: _screenId },
      bubbles: true,
    }),
  );
}
