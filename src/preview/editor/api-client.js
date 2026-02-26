// REST API client for the editor frontend.
// Thin fetch wrapper — keeps HTTP concerns out of the UI layer and makes
// the request/response contract easy to mock in unit tests.

// Throws a descriptive error for non-2xx responses so callers get a clear
// failure signal instead of silently receiving an error body.
async function handleResponse(res) {
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res;
}

export async function getProject(projectId) {
  const res = await fetch(`/api/projects/${projectId}`);
  await handleResponse(res);
  return res.json();
}

export async function getScreen(projectId, screenId) {
  const res = await fetch(`/api/projects/${projectId}/screens/${screenId}`);
  await handleResponse(res);
  return res.json();
}

// Returns raw HTML text — the screen fragment endpoint serves markup, not JSON.
export async function getScreenFragment(projectId, screenId) {
  const res = await fetch(`/api/screen-fragment/${projectId}/${screenId}`);
  await handleResponse(res);
  return res.text();
}

// Shorthand for positional updates (x, y, width, height) used by drag and resize.
// Under the hood it hits the same PATCH endpoint as updateElement but keeps the
// call sites in editor.js self-documenting about intent.
export async function moveElement(projectId, screenId, elementId, updates) {
  const res = await fetch(
    `/api/projects/${projectId}/screens/${screenId}/elements/${elementId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
  );
  await handleResponse(res);
  return res.json();
}

export async function updateElement(projectId, screenId, elementId, updates) {
  const res = await fetch(
    `/api/projects/${projectId}/screens/${screenId}/elements/${elementId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
  );
  await handleResponse(res);
  return res.json();
}

export async function addElement(projectId, screenId, data) {
  const res = await fetch(
    `/api/projects/${projectId}/screens/${screenId}/elements`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  await handleResponse(res);
  return res.json();
}

// DELETE returns 204 No Content on success — no response body to parse.
export async function deleteElement(projectId, screenId, elementId) {
  const res = await fetch(
    `/api/projects/${projectId}/screens/${screenId}/elements/${elementId}`,
    { method: 'DELETE' },
  );
  await handleResponse(res);
}

export async function updateProject(projectId, updates) {
  const res = await fetch(
    `/api/projects/${projectId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
  );
  await handleResponse(res);
  return res.json();
}

export async function updateScreen(projectId, screenId, updates) {
  const res = await fetch(
    `/api/projects/${projectId}/screens/${screenId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
  );
  await handleResponse(res);
  return res.json();
}

// --- Comment operations ---

export async function addComment(projectId, screenId, { text, author = 'user', element_id = null }) {
  const res = await fetch(
    `/api/screens/${projectId}/${screenId}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, author, element_id }),
    },
  );
  await handleResponse(res);
  return res.json();
}

export async function listComments(projectId, screenId, { include_resolved = false } = {}) {
  const res = await fetch(
    `/api/screens/${projectId}/${screenId}/comments?include_resolved=${include_resolved}`,
  );
  await handleResponse(res);
  return res.json();
}

export async function resolveComment(projectId, screenId, commentId) {
  const res = await fetch(
    `/api/screens/${projectId}/${screenId}/comments/${commentId}/resolve`,
    { method: 'PATCH' },
  );
  await handleResponse(res);
  return res.json();
}
