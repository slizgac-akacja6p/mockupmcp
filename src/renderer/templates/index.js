// Template registry — same pattern as component registry.
// Each template exports: generate(screenWidth, screenHeight, style, contentHints) -> element[]
// and description: string.

import * as login      from './login.js';
import * as dashboard  from './dashboard.js';
import * as settings   from './settings.js';
import * as list       from './list.js';
import * as form       from './form.js';
import * as profile    from './profile.js';
import * as onboarding from './onboarding.js';

const templates = {
  login,
  dashboard,
  settings,
  list,
  form,
  profile,
  onboarding,
};

export function getTemplate(name) {
  return templates[name] || null;
}

export function getAvailableTemplates() {
  return Object.keys(templates);
}
