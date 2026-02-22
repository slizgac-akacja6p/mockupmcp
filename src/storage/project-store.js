import { readFile, writeFile, rename, mkdir, unlink, rm } from 'fs/promises';
import { mkdirSync } from 'fs';
import { join, dirname, relative, sep } from 'path';
import { generateId, validateId } from './id-generator.js';
import { scanProjectFiles } from './folder-scanner.js';

export class ProjectStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.exportsDir = join(dataDir, 'exports');

    // In-memory index: projectId → relativePath (from dataDir).
    // Populated by _buildIndex() during init() and kept current on each write/delete.
    this._pathIndex = new Map();

    // Auto-create exports directory on construction so callers don't have to await init().
    mkdirSync(this.exportsDir, { recursive: true });
  }

  async init() {
    await mkdir(this.exportsDir, { recursive: true });
    await this._buildIndex();
  }

  // --- Internal helpers ---

  // Scan dataDir for all proj_*.json files and populate the in-memory path index.
  async _buildIndex() {
    this._pathIndex.clear();
    const files = await scanProjectFiles(this.dataDir);
    for (const { relativePath, absolutePath } of files) {
      try {
        const raw = await readFile(absolutePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.id && data.id.startsWith('proj_')) {
          this._pathIndex.set(data.id, relativePath);
        }
      } catch (err) {
        // Skip unreadable/invalid files but log for diagnostics.
        console.error(`[ProjectStore] Skipping ${absolutePath}: ${err.message}`);
      }
    }
  }

  // Returns the absolute path for a project that is already in the index, or null.
  _resolvePath(projectId) {
    const rel = this._pathIndex.get(projectId);
    if (rel) return join(this.dataDir, rel);
    return null;
  }

  // Returns the absolute path for a project.
  // Falls back to dataDir root for projects not yet in the index (i.e., brand-new).
  _path(projectId) {
    const resolved = this._resolvePath(projectId);
    if (resolved) return resolved;
    return join(this.dataDir, `${projectId}.json`);
  }

  // Prevents path traversal attacks by requiring the standard ID format.
  _validateId(id) {
    if (!validateId(id)) {
      throw new Error(`Invalid ID format: "${id}"`);
    }
  }

  _findScreen(project, screenId) {
    const screen = project.screens.find((s) => s.id === screenId);
    if (!screen) {
      throw new Error(`Screen ${screenId} not found in project ${project.id}`);
    }
    return screen;
  }

  // Atomic write: write to a temp file first, then rename to avoid partial writes on crash.
  // Also ensures the target directory exists and keeps the path index current.
  async _save(project) {
    project.updated_at = new Date().toISOString();
    const filePath = this._path(project.id);
    await mkdir(dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(project, null, 2), 'utf-8');
    await rename(tmpPath, filePath);
    this._pathIndex.set(project.id, relative(this.dataDir, filePath));
  }

  // --- Project methods ---

  async createProject(name, description = '', viewport = { width: 393, height: 852, preset: 'mobile' }, style = 'wireframe', folder = null) {
    const id = generateId('proj');
    const now = new Date().toISOString();
    const project = {
      id,
      name,
      description,
      style,
      created_at: now,
      updated_at: now,
      viewport,
      screens: [],
    };

    if (folder) {
      const resolvedFolder = join(this.dataDir, folder);
      // Prevent path traversal outside dataDir (e.g. folder = "../../etc").
      if (!resolvedFolder.startsWith(this.dataDir + sep) && resolvedFolder !== this.dataDir) {
        throw new Error(`Invalid folder path: "${folder}"`);
      }
      // Pre-register the index entry so _path() resolves to the correct subfolder.
      const relPath = join(folder, `${id}.json`);
      this._pathIndex.set(id, relPath);
    }

    await this._save(project);
    return project;
  }

  async getProject(projectId) {
    this._validateId(projectId);
    let filePath = this._path(projectId);
    let raw;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Lazy rebuild: the file may have been added or moved since the last index build.
        await this._buildIndex();
        filePath = this._path(projectId);
        try {
          raw = await readFile(filePath, 'utf-8');
        } catch (err2) {
          if (err2.code === 'ENOENT') throw new Error(`Project ${projectId} not found`);
          throw err2;
        }
      } else {
        throw err;
      }
    }
    return JSON.parse(raw);
  }

  async listProjects() {
    // Always rebuild before listing so callers see files added outside the store.
    await this._buildIndex();
    const summaries = [];
    for (const [projectId, relPath] of this._pathIndex) {
      try {
        const raw = await readFile(join(this.dataDir, relPath), 'utf-8');
        const project = JSON.parse(raw);
        // Derive folder from the relative path: everything except the filename.
        const pathParts = relPath.split('/');
        const folder = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null;
        summaries.push({
          id: project.id,
          name: project.name,
          screens: project.screens.length,
          updated_at: project.updated_at,
          folder,
        });
      } catch {
        // Skip files that have become unreadable since the index was built.
      }
    }
    return summaries;
  }

  // Returns the full project hierarchy as a nested tree of folders and projects.
  // Each node: { folders: [...], projects: [...] }
  // Each project entry: { id, name, style, screens: [{ id, name }] }
  async listProjectsTree() {
    await this._buildIndex();
    const root = { folders: [], projects: [] };

    for (const [, relPath] of this._pathIndex) {
      try {
        const raw = await readFile(join(this.dataDir, relPath), 'utf-8');
        const project = JSON.parse(raw);
        const parts = relPath.split('/');

        const projectEntry = {
          id: project.id,
          name: project.name,
          style: project.style,
          screens: (project.screens || []).map((s) => ({ id: s.id, name: s.name })),
        };

        if (parts.length === 1) {
          root.projects.push(projectEntry);
        } else {
          // Walk (or create) folder nodes to place the project in the right subtree.
          let current = root;
          const folderParts = parts.slice(0, -1);
          let pathSoFar = '';
          for (const folderName of folderParts) {
            pathSoFar = pathSoFar ? pathSoFar + '/' + folderName : folderName;
            let folder = current.folders.find((f) => f.name === folderName);
            if (!folder) {
              folder = { name: folderName, path: pathSoFar, folders: [], projects: [] };
              current.folders.push(folder);
            }
            current = folder;
          }
          current.projects.push(projectEntry);
        }
      } catch {
        // Skip unreadable files.
      }
    }

    return root;
  }

  async deleteProject(projectId) {
    this._validateId(projectId);
    const filePath = this._path(projectId);
    try {
      await unlink(filePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Project ${projectId} not found`);
      }
      throw err;
    }
    this._pathIndex.delete(projectId);
    // Clean up exported screenshots for this project.
    const exportDir = join(this.exportsDir, projectId);
    await rm(exportDir, { recursive: true, force: true }).catch(() => {});
  }

  // --- Screen methods ---

  async addScreen(projectId, name, width, height, background = '#FFFFFF', style = null) {
    const project = await this.getProject(projectId);

    // Fall back to project viewport dimensions when caller omits explicit size.
    const resolvedWidth = width ?? project.viewport.width;
    const resolvedHeight = height ?? project.viewport.height;

    const screen = {
      id: generateId('scr'),
      name,
      width: resolvedWidth,
      height: resolvedHeight,
      background,
      style,
      elements: [],
    };
    project.screens.push(screen);
    await this._save(project);
    return screen;
  }

  async listScreens(projectId) {
    const project = await this.getProject(projectId);
    return project.screens.map((s) => ({
      id: s.id,
      name: s.name,
      width: s.width,
      height: s.height,
      elements: s.elements.length,
    }));
  }

  async deleteScreen(projectId, screenId) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const index = project.screens.findIndex((s) => s.id === screenId);
    if (index === -1) {
      throw new Error(`Screen ${screenId} not found in project ${projectId}`);
    }
    project.screens.splice(index, 1);
    await this._save(project);
  }

  async duplicateScreen(projectId, screenId, newName) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const source = this._findScreen(project, screenId);

    const newScreen = {
      ...structuredClone(source),
      id: generateId('scr'),
      name: newName || `${source.name} (copy)`,
      elements: source.elements.map((el) => ({
        ...structuredClone(el),
        id: generateId('el'),
      })),
    };

    project.screens.push(newScreen);
    await this._save(project);
    return newScreen;
  }

  async bulkMoveElements(projectId, screenId, updates) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    for (const update of updates) {
      const el = screen.elements.find((e) => e.id === update.id);
      if (!el) continue;
      if (update.x !== undefined) el.x = update.x;
      if (update.y !== undefined) el.y = update.y;
      if (update.width !== undefined) el.width = update.width;
      if (update.height !== undefined) el.height = update.height;
    }

    await this._save(project);
    return screen;
  }

  async applyTemplate(projectId, screenId, elements, clear = true) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    if (clear) {
      screen.elements = [];
    }

    for (const el of elements) {
      screen.elements.push({
        ...el,
        id: generateId('el'),
      });
    }

    await this._save(project);
    return screen;
  }

  // --- Element methods ---

  async addElement(projectId, screenId, type, x, y, width, height, properties = {}, zIndex = 0) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    const element = {
      id: generateId('el'),
      type,
      x,
      y,
      width,
      height,
      z_index: zIndex,
      properties,
    };
    screen.elements.push(element);
    await this._save(project);
    return element;
  }

  async updateElement(projectId, screenId, elementId, properties) {
    this._validateId(screenId);
    this._validateId(elementId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    const element = screen.elements.find((e) => e.id === elementId);
    if (!element) {
      throw new Error(`Element ${elementId} not found in screen ${screenId}`);
    }

    // Spread new properties over existing ones so callers can do partial updates.
    element.properties = { ...element.properties, ...properties };
    await this._save(project);
    return element;
  }

  async deleteElement(projectId, screenId, elementId) {
    this._validateId(screenId);
    this._validateId(elementId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    const index = screen.elements.findIndex((e) => e.id === elementId);
    if (index === -1) {
      throw new Error(`Element ${elementId} not found in screen ${screenId}`);
    }
    screen.elements.splice(index, 1);
    await this._save(project);
  }

  async moveElement(projectId, screenId, elementId, x, y, width, height, zIndex) {
    this._validateId(screenId);
    this._validateId(elementId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    const element = screen.elements.find((e) => e.id === elementId);
    if (!element) {
      throw new Error(`Element ${elementId} not found in screen ${screenId}`);
    }

    // Only update fields that were explicitly provided (undefined = keep existing).
    if (x !== undefined) element.x = x;
    if (y !== undefined) element.y = y;
    if (width !== undefined) element.width = width;
    if (height !== undefined) element.height = height;
    if (zIndex !== undefined) element.z_index = zIndex;

    await this._save(project);
    return element;
  }

  async listElements(projectId, screenId) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    return screen.elements;
  }

  // --- Link methods ---

  async addLink(projectId, screenId, elementId, targetScreenId, transition = 'push') {
    this._validateId(screenId);
    this._validateId(elementId);
    this._validateId(targetScreenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    const targetExists = project.screens.some((s) => s.id === targetScreenId);
    if (!targetExists) {
      throw new Error(`Target screen ${targetScreenId} not found in project ${projectId}`);
    }

    const element = screen.elements.find((e) => e.id === elementId);
    if (!element) {
      throw new Error(`Element ${elementId} not found in screen ${screenId}`);
    }

    element.properties.link_to = { screen_id: targetScreenId, transition };
    await this._save(project);
    return element;
  }

  async removeLink(projectId, screenId, elementId) {
    this._validateId(screenId);
    this._validateId(elementId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    const element = screen.elements.find((e) => e.id === elementId);
    if (!element) {
      throw new Error(`Element ${elementId} not found in screen ${screenId}`);
    }
    delete element.properties.link_to;
    await this._save(project);
    return element;
  }

  async getLinksForProject(projectId) {
    const project = await this.getProject(projectId);
    const links = [];
    for (const screen of project.screens) {
      for (const el of screen.elements) {
        if (el.properties.link_to) {
          links.push({
            from_screen: screen.id,
            from_screen_name: screen.name,
            from_element: el.id,
            from_element_type: el.type,
            to_screen: el.properties.link_to.screen_id,
            to_screen_name:
              project.screens.find((s) => s.id === el.properties.link_to.screen_id)?.name ||
              'Unknown',
            transition: el.properties.link_to.transition,
          });
        }
      }
    }
    return links;
  }

  // --- Group methods ---

  async groupElements(projectId, screenId, elementIds, name = 'Group') {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    if (elementIds.length < 2) {
      throw new Error('Group requires at least 2 elements');
    }

    for (const elId of elementIds) {
      if (!screen.elements.find((e) => e.id === elId)) {
        throw new Error(`Element ${elId} not found in screen ${screenId}`);
      }
    }

    if (!screen.groups) screen.groups = [];

    const group = {
      id: generateId('grp'),
      name,
      element_ids: [...elementIds],
    };
    screen.groups.push(group);
    await this._save(project);
    return group;
  }

  async ungroupElements(projectId, screenId, groupId) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    if (!screen.groups) throw new Error(`Group ${groupId} not found`);

    const idx = screen.groups.findIndex((g) => g.id === groupId);
    if (idx === -1) throw new Error(`Group ${groupId} not found in screen ${screenId}`);

    screen.groups.splice(idx, 1);
    await this._save(project);
  }

  async moveGroup(projectId, screenId, groupId, deltaX, deltaY) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    if (!screen.groups) throw new Error(`Group ${groupId} not found`);

    const group = screen.groups.find((g) => g.id === groupId);
    if (!group) throw new Error(`Group ${groupId} not found in screen ${screenId}`);

    for (const elId of group.element_ids) {
      const el = screen.elements.find((e) => e.id === elId);
      if (el) {
        el.x += deltaX;
        el.y += deltaY;
      }
    }
    await this._save(project);
    return screen;
  }

  // --- Export ---

  async saveExport(projectId, screenId, buffer, format = 'png') {
    this._validateId(projectId);
    this._validateId(screenId);

    const exportDir = join(this.exportsDir, projectId);
    await mkdir(exportDir, { recursive: true });

    const filePath = join(exportDir, `${screenId}.${format}`);
    await writeFile(filePath, buffer);
    return filePath;
  }
}
