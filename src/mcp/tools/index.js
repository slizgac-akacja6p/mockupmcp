import { ProjectStore } from '../../storage/project-store.js';
import { config } from '../../config.js';
import { registerProjectTools } from './project-tools.js';
import { registerScreenTools } from './screen-tools.js';
import { registerElementTools } from './element-tools.js';
import { registerExportTools } from './export-tools.js';
import { registerTemplateTools } from './template-tools.js';
import { registerLayoutTools } from './layout-tools.js';
import { registerGroupTools } from './group-tools.js';

export function registerAllTools(server, store) {
  if (!store) store = new ProjectStore(config.dataDir);
  registerProjectTools(server, store);
  registerScreenTools(server, store);
  registerElementTools(server, store);
  registerExportTools(server, store);
  registerTemplateTools(server, store);
  registerLayoutTools(server, store);
  registerGroupTools(server, store);
  console.error('[MockupMCP] 24 tools registered');
}
