import { readFile, writeFile, rename, mkdir, unlink, rm } from 'fs/promises';
import { mkdirSync } from 'fs';
import { join, dirname, relative, sep } from 'path';
import { generateId, validateId } from './id-generator.js';
import { scanProjectFiles } from './folder-scanner.js';
import { resolveOverlaps } from '../renderer/layout.js';

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
    const project = JSON.parse(raw);
    // Migration fallback: ensure all screens have versioning fields.
    if (project.screens) {
      for (const screen of project.screens) {
        screen.version ??= 1;
        screen.parent_screen_id ??= null;
        screen.status ??= 'draft';
        screen.comments ??= [];
      }
    }
    return project;
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
          screens: (project.screens || []).map((s) => ({ id: s.id, name: s.name, status: s.status, version: s.version })),
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

  async addScreen(projectId, name, width, height, background = '#FFFFFF', style = null, color_scheme = null, inheritStyle = undefined) {
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
      color_scheme,
      elements: [],
      version: 1,
      parent_screen_id: null,
      status: 'draft',
    };
    // Only persist inheritStyle when explicitly set (backward compat: absent = true)
    if (inheritStyle !== undefined) {
      screen.inheritStyle = inheritStyle;
    }
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

  async updateScreen(projectId, screenId, updates) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    // Merge updates into screen (allow partial updates).
    Object.assign(screen, updates);

    await this._save(project);
    return screen;
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

    // Resolve unintentional overlaps after bulk element insertion
    screen.elements = resolveOverlaps(screen.elements, screen.width);

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

  async bulkAddElements(projectId, screenId, elements) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);

    const added = [];
    for (const el of elements) {
      const { type, x = 0, y = 0, width = 100, height = 40, properties = {}, z_index = 0 } = el;
      const element = {
        id: generateId('el'),
        type,
        x,
        y,
        width,
        height,
        z_index,
        properties,
      };
      screen.elements.push(element);
      added.push(element);
    }

    // Resolve unintentional overlaps after bulk element insertion
    screen.elements = resolveOverlaps(screen.elements, screen.width);
    // Update added references to reflect resolved positions
    for (const el of added) {
      const resolved = screen.elements.find(e => e.id === el.id);
      if (resolved) { el.x = resolved.x; el.y = resolved.y; }
    }

    await this._save(project);
    return added;
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

  // --- Comment methods ---

  async addComment(projectId, screenId, { element_id = null, text, author = 'user' }) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    if (!screen) throw new Error(`Screen not found: ${screenId}`);
    screen.comments ??= [];
    const unresolvedPins = screen.comments.filter(c => !c.resolved).map(c => c.pin_number || 0);
    const nextPin = unresolvedPins.length > 0 ? Math.max(...unresolvedPins) + 1 : 1;
    const comment = {
      id: generateId('cmt'),
      element_id: element_id || null,
      text,
      author,
      resolved: false,
      pin_number: nextPin,
      created_at: new Date().toISOString()
    };
    screen.comments.push(comment);
    await this._save(project);
    return comment;
  }

  async listComments(projectId, screenId, { include_resolved = false } = {}) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    if (!screen) throw new Error(`Screen not found: ${screenId}`);
    screen.comments ??= [];
    if (include_resolved) return screen.comments;
    return screen.comments.filter(c => !c.resolved);
  }

  async resolveComment(projectId, screenId, commentId) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = project.screens.find(s => s.id === screenId);
    if (!screen) throw new Error(`Screen not found: ${screenId}`);
    screen.comments ??= [];
    const comment = screen.comments.find(c => c.id === commentId);
    if (!comment) throw new Error(`Comment not found: ${commentId}`);
    comment.resolved = true;
    await this._save(project);
    return comment;
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

  // --- Bulk creation methods ---

  async createScreenFull(projectId, screenDef) {
    // Validate project exists before any mutations.
    const project = await this.getProject(projectId);

    const { name, width, height, background = '#FFFFFF', style = null, inheritStyle, elements = [], links = [] } = screenDef;

    // Pre-validate everything (atomicity: fail-all).
    // Check all element types and links refs exist before creating anything.
    const elementRefs = new Set();
    for (const el of elements) {
      if (!el.type) throw new Error('Element missing type');
      if (el.ref) elementRefs.add(el.ref);
    }

    for (const link of links) {
      if (!link.ref || !elementRefs.has(link.ref)) {
        throw new Error(`Link ref "${link.ref}" does not exist in elements`);
      }
    }

    // Resolve dimensions from project viewport if not provided.
    const resolvedWidth = width ?? project.viewport.width;
    const resolvedHeight = height ?? project.viewport.height;

    // Create screen.
    const screen = {
      id: generateId('scr'),
      name,
      width: resolvedWidth,
      height: resolvedHeight,
      background,
      style,
      elements: [],
      version: 1,
      parent_screen_id: null,
      status: 'draft',
    };
    if (inheritStyle !== undefined) {
      screen.inheritStyle = inheritStyle;
    }

    // Create elements and build refMap.
    const refMap = {};
    for (const el of elements) {
      const element = {
        id: generateId('el'),
        type: el.type,
        x: el.x ?? 0,
        y: el.y ?? 0,
        width: el.width ?? 100,
        height: el.height ?? 40,
        z_index: el.z_index ?? 0,
        properties: el.properties ?? {},
      };
      if (el.ref) refMap[el.ref] = element.id;
      screen.elements.push(element);
    }

    // Apply links: replace ref with actual element_id.
    for (const link of links) {
      const targetElementId = refMap[link.ref];
      const element = screen.elements.find((e) => e.id === targetElementId);
      if (element) {
        element.properties.link_to = {
          screen_id: link.target_screen_id,
          transition: link.transition ?? 'push',
        };
      }
    }

    // Resolve unintentional overlaps before persisting
    screen.elements = resolveOverlaps(screen.elements, screen.width);

    project.screens.push(screen);
    await this._save(project);

    return { screen, refMap };
  }

  async createProjectFull(projectDef) {
    // Pre-validate required fields before any mutations (atomicity: fail-all).
    if (!projectDef || typeof projectDef !== 'object') {
      throw new Error('Project definition must be an object');
    }
    if (!projectDef.name) {
      throw new Error('Project JSON missing name field');
    }
    if (!Array.isArray(projectDef.screens)) {
      throw new Error('Project JSON missing or invalid screens array');
    }

    const {
      name,
      description = '',
      viewport = { width: 393, height: 852, preset: 'mobile' },
      style = 'wireframe',
      folder = null,
      screens = [],
      links = [],
    } = projectDef;

    // Pre-validate all screens and elements (atomicity: fail-all).
    const screenRefs = new Set();
    const allElementRefs = {}; // { screenRef_elementRef: exists? }

    for (const screenDef of screens) {
      if (screenDef.ref && screenRefs.has(screenDef.ref)) {
        throw new Error(`Duplicate screen ref: "${screenDef.ref}"`);
      }
      if (screenDef.ref) screenRefs.add(screenDef.ref);

      for (const el of screenDef.elements || []) {
        if (!el.type) throw new Error('Element missing type');
        const refKey = `${screenDef.ref || '__unnamed'}.${el.ref || '__unnamed'}`;
        allElementRefs[refKey] = true;
      }
    }

    // Validate link references.
    for (const link of links) {
      if (!link.screen_ref || !screenRefs.has(link.screen_ref)) {
        throw new Error(`Link screen_ref "${link.screen_ref}" does not exist in screens`);
      }
      if (!link.target_screen_ref || !screenRefs.has(link.target_screen_ref)) {
        throw new Error(`Link target_screen_ref "${link.target_screen_ref}" does not exist in screens`);
      }
      // For now, element_ref validation is lenient (allow optional).
    }

    // Create project.
    const project = await this.createProject(name, description, viewport, style, folder);

    // Screen ref -> screen ID map.
    const screenRefMap = {};
    // Element ref -> element ID map (key: screenRef.elementRef).
    const elementRefMap = {};

    for (const screenDef of screens) {
      const { name: screenName, width, height, background = '#FFFFFF', style: screenStyle = null, inheritStyle: screenInheritStyle, elements = [] } = screenDef;

      const resolvedWidth = width ?? project.viewport.width;
      const resolvedHeight = height ?? project.viewport.height;

      const screen = {
        id: generateId('scr'),
        name: screenName,
        width: resolvedWidth,
        height: resolvedHeight,
        background,
        style: screenStyle,
        elements: [],
        version: 1,
        parent_screen_id: null,
        status: 'draft',
      };

      if (screenInheritStyle !== undefined) {
        screen.inheritStyle = screenInheritStyle;
      }
      if (screenDef.ref) screenRefMap[screenDef.ref] = screen.id;

      // Create elements.
      for (const el of elements) {
        const element = {
          id: generateId('el'),
          type: el.type,
          x: el.x ?? 0,
          y: el.y ?? 0,
          width: el.width ?? 100,
          height: el.height ?? 40,
          z_index: el.z_index ?? 0,
          properties: el.properties ?? {},
        };
        if (el.ref) {
          const refKey = `${screenDef.ref || '__unnamed'}.${el.ref}`;
          elementRefMap[refKey] = element.id;
        }
        screen.elements.push(element);
      }

      // Resolve unintentional overlaps per screen
      screen.elements = resolveOverlaps(screen.elements, screen.width);

      project.screens.push(screen);
    }

    // Apply links: resolve screen and element refs to IDs.
    for (const link of links) {
      const screenId = screenRefMap[link.screen_ref];
      const screen = project.screens.find((s) => s.id === screenId);
      if (!screen) continue;

      // If element_ref specified, apply to that element; otherwise apply to first element.
      let targetElement;
      if (link.element_ref) {
        const refKey = `${link.screen_ref}.${link.element_ref}`;
        const elementId = elementRefMap[refKey];
        targetElement = screen.elements.find((e) => e.id === elementId);
      } else if (screen.elements.length > 0) {
        targetElement = screen.elements[0];
      }

      if (targetElement) {
        targetElement.properties.link_to = {
          screen_id: screenRefMap[link.target_screen_ref],
          transition: link.transition ?? 'push',
        };
      }
    }

    await this._save(project);

    return { project, screenRefMap, elementRefMap };
  }

  async importProject(projectJson, nameOverride = null, folder = null) {
    if (!projectJson.name) throw new Error('Project JSON missing name field');
    if (!Array.isArray(projectJson.screens)) throw new Error('Project JSON missing or invalid screens array');

    // Create new project with imported data.
    const newProject = await this.createProject(
      nameOverride || projectJson.name,
      projectJson.description || '',
      projectJson.viewport || { width: 393, height: 852, preset: 'mobile' },
      projectJson.style || 'wireframe',
      folder
    );

    // Maps to track ID rewrites.
    const screenIdMap = {}; // oldScreenId -> newScreenId
    const elementIdMap = {}; // oldElementId -> newElementId

    // Pre-generate all new screen IDs to ensure screenIdMap is complete before link processing.
    for (const oldScreen of projectJson.screens) {
      screenIdMap[oldScreen.id] = generateId('scr');
    }

    // Import screens with new IDs.
    for (const oldScreen of projectJson.screens) {
      const newScreenId = screenIdMap[oldScreen.id];

      const newScreen = {
        id: newScreenId,
        name: oldScreen.name,
        width: oldScreen.width,
        height: oldScreen.height,
        background: oldScreen.background || '#FFFFFF',
        style: oldScreen.style || null,
        elements: [],
      };

      // Import elements with new IDs.
      for (const oldElement of oldScreen.elements || []) {
        const newElementId = generateId('el');
        elementIdMap[oldElement.id] = newElementId;

        const newElement = {
          id: newElementId,
          type: oldElement.type,
          x: oldElement.x,
          y: oldElement.y,
          width: oldElement.width,
          height: oldElement.height,
          z_index: oldElement.z_index || 0,
          properties: structuredClone(oldElement.properties || {}),
        };

        // Rewrite link_to references to new screen IDs.
        if (newElement.properties.link_to && newElement.properties.link_to.screen_id) {
          const oldTargetScreenId = newElement.properties.link_to.screen_id;
          newElement.properties.link_to.screen_id = screenIdMap[oldTargetScreenId] || oldTargetScreenId;
        }

        newScreen.elements.push(newElement);
      }

      newProject.screens.push(newScreen);
    }

    await this._save(newProject);

    return { project: newProject };
  }

  // --- Versioning ---

  async createScreenVersion(projectId, sourceScreenId) {
    this._validateId(sourceScreenId);
    const project = await this.getProject(projectId);
    const source = this._findScreen(project, sourceScreenId);

    // Clone with new ID and bump version.
    const newScreen = structuredClone(source);
    newScreen.id = generateId('scr');
    newScreen.version = (source.version || 1) + 1;
    newScreen.parent_screen_id = source.id;
    newScreen.status = 'draft';
    newScreen.name = `${source.name} v${newScreen.version}`;

    // Regenerate all element IDs so the new version has independent elements.
    newScreen.elements = source.elements.map((el) => ({
      ...structuredClone(el),
      id: generateId('el'),
    }));

    // Carry over unresolved comments so reviewers can track outstanding feedback.
    // Resolved comments are not copied — they were already addressed in the source version.
    newScreen.comments = (source.comments || [])
      .filter(c => !c.resolved)
      .map(c => ({ ...structuredClone(c), id: generateId('cmt') }));

    project.screens.push(newScreen);
    await this._save(project);
    return newScreen;
  }
}
