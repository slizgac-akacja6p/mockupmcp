import { ProjectStore } from '../../storage/project-store.js';
import { config } from '../../config.js';

export function registerAllTools(server) {
  const store = new ProjectStore(config.dataDir);

  // Tool registrations will be added in Task 7
  // For now, just create the store instance
  console.error('[MockupMCP] Tool registry initialized');
}
