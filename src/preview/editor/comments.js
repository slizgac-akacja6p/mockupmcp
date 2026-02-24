// Editor comments module — render pins for unresolved comments
// and provide a panel to view comment details.

export async function initComments(apiClient) {
  // Set up event listeners for comment pin clicks.
  // Each pin can be clicked to highlight the associated element on the canvas.
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('comment-pin')) {
      const elementId = e.target.dataset.elementId;
      const commentId = e.target.dataset.commentId;

      if (elementId) {
        // Highlight the element on canvas by triggering selection.
        const event = new CustomEvent('selectElement', { detail: { elementId } });
        document.dispatchEvent(event);
      }

      // Optionally, show/focus the comment in a sidebar panel.
      const event = new CustomEvent('focusComment', { detail: { commentId } });
      document.dispatchEvent(event);
    }
  });
}

export function renderCommentPins(comments = [], screen) {
  // Render overlay pins for unresolved comments on screen elements.
  // Returns HTML string for comment pin divs.
  const unresolved = comments.filter(c => !c.resolved);
  const html = [];

  for (const comment of unresolved) {
    if (!comment.element_id || !screen) continue;

    // Find element on canvas to determine pin position.
    // This will be positioned by the editor after elements are rendered.
    html.push(
      `<div class="comment-pin" data-element-id="${escapeHtml(comment.element_id)}" data-comment-id="${escapeHtml(comment.id)}" ` +
      `style="position: absolute; width: 20px; height: 20px; border-radius: 50%; ` +
      `background: #FCD34D; color: #111; font-size: 11px; font-weight: 600; ` +
      `display: flex; align-items: center; justify-content: center; cursor: pointer; ` +
      `border: 1px solid #F59E0B; z-index: 1000; pointer-events: auto;">${comment.pin_number}</div>`
    );
  }

  return html.join('');
}

export function renderCommentPanel(comments = [], localize) {
  // Render comment list panel in sidebar.
  const unresolved = comments.filter(c => !c.resolved);

  if (unresolved.length === 0) {
    return `<div class="comments-panel-empty">${localize('noComments', 'No comments')}</div>`;
  }

  const html = unresolved.map(c => {
    const author = c.author === 'ai' ? 'AI' : 'User';
    return `
      <div class="comment-item" data-comment-id="${escapeHtml(c.id)}">
        <div class="comment-pin-badge">${c.pin_number}</div>
        <div class="comment-content">
          <div class="comment-text">${escapeHtml(c.text)}</div>
          <div class="comment-meta">${author} • ${new Date(c.created_at).toLocaleDateString()}</div>
        </div>
        <button class="comment-resolve-btn" data-comment-id="${escapeHtml(c.id)}"
          title="${localize('resolveComment', 'Resolve')}">✓</button>
      </div>
    `;
  }).join('');

  return `<div class="comments-panel">${html}</div>`;
}

function escapeHtml(str) {
  // Prevent XSS in comment text.
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function attachCommentResolveHandlers(apiClient, projectId, screenId) {
  // Attach click handlers to resolve buttons in comment panel.
  document.querySelectorAll('.comment-resolve-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      try {
        await apiClient.patch(`/api/screens/${projectId}/${screenId}/comments/${commentId}/resolve`, {});
        // Trigger reload of comment panel.
        const event = new CustomEvent('commentsUpdated');
        document.dispatchEvent(event);
      } catch (err) {
        console.error('Failed to resolve comment:', err);
      }
    });
  });
}
