import { readFile, writeFile, rename, mkdir, readdir, unlink, rm } from 'fs/promises';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { generateId, validateId } from './id-generator.js';

export class ProjectStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.projectsDir = join(dataDir, 'projects');
    this.exportsDir = join(dataDir, 'exports');

    // Auto-create subdirectories on construction.
    mkdirSync(this.projectsDir, { recursive: true });
    mkdirSync(this.exportsDir, { recursive: true });
  }

  async init() {
    await mkdir(this.projectsDir, { recursive: true });
    await mkdir(this.exportsDir, { recursive: true });
  }

  // --- Internal helpers ---

  _path(projectId) {
    return join(this.projectsDir, `${projectId}.json`);
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
  async _save(project) {
    project.updated_at = new Date().toISOString();
    const filePath = this._path(project.id);
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(project, null, 2), 'utf-8');
    await rename(tmpPath, filePath);
  }

  // --- Project methods ---

  async createProject(name, description = '', viewport = { width: 393, height: 852, preset: 'mobile' }, style = 'wireframe') {
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
    await this._save(project);
    return project;
  }

  async getProject(projectId) {
    this._validateId(projectId);
    let raw;
    try {
      raw = await readFile(this._path(projectId), 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Project ${projectId} not found`);
      }
      throw err;
    }
    return JSON.parse(raw);
  }

  async listProjects() {
    let files;
    try {
      files = await readdir(this.projectsDir);
    } catch {
      // Directory doesn't exist yet — return empty list rather than crashing.
      return [];
    }
    const summaries = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const projectId = f.slice(0, -5); // strip .json
          const project = await this.getProject(projectId);
          return {
            id: project.id,
            name: project.name,
            screens: project.screens.length,
            updated_at: project.updated_at,
          };
        })
    );
    return summaries;
  }

  async deleteProject(projectId) {
    this._validateId(projectId);
    try {
      await unlink(this._path(projectId));
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Project ${projectId} not found`);
      }
      throw err;
    }
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
      elements: source.elements.map(el => ({
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
      const el = screen.elements.find(e => e.id === update.id);
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

    const targetExists = project.screens.some(s => s.id === targetScreenId);
    if (!targetExists) {
      throw new Error(`Target screen ${targetScreenId} not found in project ${projectId}`);
    }

    const element = screen.elements.find(e => e.id === elementId);
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
    const element = screen.elements.find(e => e.id === elementId);
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
            to_screen_name: project.screens.find(s => s.id === el.properties.link_to.screen_id)?.name || 'Unknown',
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
      if (!screen.elements.find(e => e.id === elId)) {
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

    const idx = screen.groups.findIndex(g => g.id === groupId);
    if (idx === -1) throw new Error(`Group ${groupId} not found in screen ${screenId}`);

    screen.groups.splice(idx, 1);
    await this._save(project);
  }

  async moveGroup(projectId, screenId, groupId, deltaX, deltaY) {
    this._validateId(screenId);
    const project = await this.getProject(projectId);
    const screen = this._findScreen(project, screenId);
    if (!screen.groups) throw new Error(`Group ${groupId} not found`);

    const group = screen.groups.find(g => g.id === groupId);
    if (!group) throw new Error(`Group ${groupId} not found in screen ${screenId}`);

    for (const elId of group.element_ids) {
      const el = screen.elements.find(e => e.id === elId);
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
