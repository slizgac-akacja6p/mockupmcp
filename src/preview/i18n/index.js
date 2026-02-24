// i18n module — exposes window.t(), window.setLanguage(), window.initI18n()
// Loaded as a plain browser script (not ESM) so it must use IIFE + window globals.
// Locale files are served by Express at /i18n/:lang.json.
(function () {
  let locale = {};

  async function setLanguage(lang) {
    try {
      const res = await fetch(`/i18n/${lang}.json`);
      if (!res.ok) throw new Error(`Failed to load locale: ${lang}`);
      locale = await res.json();
      localStorage.setItem('editor-lang', lang);
      document.documentElement.lang = lang;
    } catch (e) {
      console.error('[i18n]', e);
    }
  }

  function t(key, fallback) {
    return locale[key] ?? fallback ?? key;
  }

  async function initI18n() {
    const lang = localStorage.getItem('editor-lang') ?? 'en';
    await setLanguage(lang);
    return lang;
  }

  window.t = t;
  window.setLanguage = setLanguage;
  window.initI18n = initI18n;
  window.i18n = { t, setLanguage, initI18n };
})();
