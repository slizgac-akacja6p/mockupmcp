// Bridge between the renderer component registry and the editor UI.
// Keeps the editor decoupled from renderer internals — all component
// metadata flows through these two thin accessors.
//
// In the browser the data is pre-injected as window.__COMPONENT_META__
// by the server (buildEditorPage). In Node.js tests we fall back to a
// dynamic import of the renderer so the same module works in both envs.

let _cache = null;

// Browser path: read pre-injected data synchronously on module load.
// eslint-disable-next-line no-undef
if (typeof window !== 'undefined' && window.__COMPONENT_META__) {
  // eslint-disable-next-line no-undef
  _cache = window.__COMPONENT_META__;
}

/**
 * Ensure the component metadata cache is populated.
 * In the browser this is a no-op (data was injected at page load).
 * In Node.js this triggers a dynamic import of the renderer registry.
 *
 * Must be called (and awaited) before getComponentDefaults / getComponentTypes.
 */
export async function loadComponentMeta() {
  if (_cache) return;

  // Node.js fallback — dynamic import so this file has no static dependency
  // on server-side modules (which would 404 in the browser).
  const { getComponent, getAvailableTypes } = await import('../../renderer/components/index.js');
  const types = getAvailableTypes();
  const defaults = {};
  for (const t of types) {
    const comp = getComponent(t);
    if (comp && typeof comp.defaults === 'function') {
      defaults[t] = comp.defaults();
    }
  }
  _cache = { types, defaults };
}

/**
 * Return the default property bag for a component type.
 * Returns an empty object when the type is unknown or has no defaults().
 *
 * @param {string} type
 * @returns {Record<string, unknown>}
 */
export function getComponentDefaults(type) {
  if (!_cache) return {};
  return _cache.defaults[type] || {};
}

/**
 * Return all registered component type names.
 *
 * @returns {string[]}
 */
export function getComponentTypes() {
  if (!_cache) return [];
  return _cache.types;
}
