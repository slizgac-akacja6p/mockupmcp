// Section registry — all available semantic layout sections.

import * as navbar from './navbar.js';
import * as hero from './hero_with_cta.js';
import * as loginForm from './login_form.js';
import * as cardGrid3 from './card_grid_3.js';
import * as cardGrid2 from './card_grid_2.js';
import * as settingsPanel from './settings_panel.js';
import * as profileHeader from './profile_header.js';
import * as searchBar from './search_bar.js';
import * as featureList from './feature_list.js';
import * as footer from './footer.js';

const registry = {
  navbar,
  hero_with_cta: hero,
  login_form: loginForm,
  card_grid_3: cardGrid3,
  card_grid_2: cardGrid2,
  settings_panel: settingsPanel,
  profile_header: profileHeader,
  search_bar: searchBar,
  feature_list: featureList,
  footer,
};

/**
 * Get a section generator by type name.
 * Each section module exports generate(screenWidth, sectionY, props) and defaults().
 *
 * @param {string} type - Section type key (e.g., 'navbar', 'hero_with_cta')
 * @returns {object|null} - Section module with generate() and defaults(), or null if not found
 */
export function getSection(type) {
  return registry[type] || null;
}

/**
 * Get list of all available section types.
 *
 * @returns {string[]} - Array of section type names
 */
export function getAvailableSections() {
  return Object.keys(registry);
}
