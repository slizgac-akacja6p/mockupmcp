// ESM loader hook — redirects screenshot.js imports to a no-op stub.
// Used by prompts.test.js to avoid Puppeteer dependency in unit tests.
export function resolve(specifier, context, nextResolve) {
  if (typeof specifier === 'string' && specifier.endsWith('/renderer/screenshot.js')) {
    return {
      url: new URL('./_screenshot-stub.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
