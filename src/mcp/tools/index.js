import { ProjectStore } from '../../storage/project-store.js';
import { config } from '../../config.js';
import { registerProjectTools } from './project-tools.js';
import { registerScreenTools } from './screen-tools.js';
import { registerElementTools } from './element-tools.js';
import { registerExportTools } from './export-tools.js';

export function registerAllTools(server) {
  const store = new ProjectStore(config.dataDir);
  registerProjectTools(server, store);
  registerScreenTools(server, store);
  registerElementTools(server, store);
  registerExportTools(server, store);
  console.error('[MockupMCP] 14 tools registered');
}
