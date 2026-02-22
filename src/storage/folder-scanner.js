import { readdir } from 'fs/promises';
import { join, relative } from 'path';

/**
 * Recursively scan baseDir for project JSON files.
 * Returns array of { relativePath, absolutePath } for each .json file
 * whose name starts with "proj_".
 *
 * @param {string} baseDir - Root directory to scan
 * @param {Set<string>} [excludeDirs] - Directory names to skip (default: 'exports')
 * @returns {Promise<Array<{relativePath: string, absolutePath: string}>>}
 */
export async function scanProjectFiles(baseDir, excludeDirs = new Set(['exports'])) {
  const results = [];
  await _scan(baseDir, baseDir, excludeDirs, results);
  return results;
}

async function _scan(currentDir, baseDir, excludeDirs, results) {
  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    // Directory doesn't exist or not readable — skip silently.
    return;
  }

  for (const entry of entries) {
    // Skip hidden files and directories (dotfiles).
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      await _scan(join(currentDir, entry.name), baseDir, excludeDirs, results);
    } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name.startsWith('proj_')) {
      const absolutePath = join(currentDir, entry.name);
      const relativePath = relative(baseDir, absolutePath);
      results.push({ relativePath, absolutePath });
    }
  }
}
