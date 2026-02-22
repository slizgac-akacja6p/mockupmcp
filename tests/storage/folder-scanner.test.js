import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join, sep } from 'path';
import { tmpdir } from 'os';
import { scanProjectFiles } from '../../src/storage/folder-scanner.js';

describe('scanProjectFiles', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mockupmcp-scanner-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('finds proj_xxx.json in root directory', async () => {
    const dir = await mkdtemp(join(tmpDir, 'root-'));
    await writeFile(join(dir, 'proj_abc123.json'), JSON.stringify({ id: 'proj_abc123' }));

    const results = await scanProjectFiles(dir);

    assert.equal(results.length, 1);
    assert.equal(results[0].relativePath, 'proj_abc123.json');
    assert.equal(results[0].absolutePath, join(dir, 'proj_abc123.json'));
  });

  it('finds proj_xxx.json in nested subdirectories', async () => {
    const dir = await mkdtemp(join(tmpDir, 'nested-'));
    const nested = join(dir, 'MGGS', 'Audiobook Maker');
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, 'proj_abc.json'), JSON.stringify({ id: 'proj_abc' }));

    const results = await scanProjectFiles(dir);

    assert.equal(results.length, 1);
    // relativePath must use OS separator and reflect the full nested path.
    const expectedRelative = join('MGGS', 'Audiobook Maker', 'proj_abc.json');
    assert.equal(results[0].relativePath, expectedRelative);
    assert.equal(results[0].absolutePath, join(nested, 'proj_abc.json'));
  });

  it('skips exports/ directory', async () => {
    const dir = await mkdtemp(join(tmpDir, 'exports-'));
    const exportsDir = join(dir, 'exports');
    await mkdir(exportsDir, { recursive: true });
    await writeFile(join(exportsDir, 'proj_hidden.json'), JSON.stringify({ id: 'proj_hidden' }));
    await writeFile(join(dir, 'proj_visible.json'), JSON.stringify({ id: 'proj_visible' }));

    const results = await scanProjectFiles(dir);

    assert.equal(results.length, 1);
    assert.equal(results[0].relativePath, 'proj_visible.json');
  });

  it('skips custom excluded directories when provided', async () => {
    const dir = await mkdtemp(join(tmpDir, 'custom-exclude-'));
    const skipDir = join(dir, 'archive');
    await mkdir(skipDir, { recursive: true });
    await writeFile(join(skipDir, 'proj_old.json'), JSON.stringify({ id: 'proj_old' }));
    await writeFile(join(dir, 'proj_new.json'), JSON.stringify({ id: 'proj_new' }));

    const results = await scanProjectFiles(dir, new Set(['archive']));

    assert.equal(results.length, 1);
    assert.equal(results[0].relativePath, 'proj_new.json');
  });

  it('skips hidden directories (starting with .)', async () => {
    const dir = await mkdtemp(join(tmpDir, 'hidden-'));
    const hiddenDir = join(dir, '.hidden');
    await mkdir(hiddenDir, { recursive: true });
    await writeFile(join(hiddenDir, 'proj_secret.json'), JSON.stringify({ id: 'proj_secret' }));
    await writeFile(join(dir, 'proj_public.json'), JSON.stringify({ id: 'proj_public' }));

    const results = await scanProjectFiles(dir);

    assert.equal(results.length, 1);
    assert.equal(results[0].relativePath, 'proj_public.json');
  });

  it('skips non-JSON files (e.g. README.md)', async () => {
    const dir = await mkdtemp(join(tmpDir, 'non-json-'));
    await writeFile(join(dir, 'README.md'), '# readme');
    await writeFile(join(dir, 'proj_real.json'), JSON.stringify({ id: 'proj_real' }));

    const results = await scanProjectFiles(dir);

    assert.equal(results.length, 1);
    assert.equal(results[0].relativePath, 'proj_real.json');
  });

  it('skips JSON files without proj_ prefix (e.g. package.json)', async () => {
    const dir = await mkdtemp(join(tmpDir, 'no-prefix-'));
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'test' }));
    await writeFile(join(dir, 'config.json'), JSON.stringify({}));
    await writeFile(join(dir, 'proj_valid.json'), JSON.stringify({ id: 'proj_valid' }));

    const results = await scanProjectFiles(dir);

    assert.equal(results.length, 1);
    assert.equal(results[0].relativePath, 'proj_valid.json');
  });

  it('returns empty array for empty directory', async () => {
    const dir = await mkdtemp(join(tmpDir, 'empty-'));

    const results = await scanProjectFiles(dir);

    assert.deepEqual(results, []);
  });

  it('returns empty array for nonexistent directory', async () => {
    const nonexistent = join(tmpDir, 'does-not-exist-at-all');

    const results = await scanProjectFiles(nonexistent);

    assert.deepEqual(results, []);
  });

  it('relativePath is relative to baseDir', async () => {
    const dir = await mkdtemp(join(tmpDir, 'relpath-'));
    const sub = join(dir, 'sub');
    await mkdir(sub, { recursive: true });
    await writeFile(join(sub, 'proj_x.json'), JSON.stringify({ id: 'proj_x' }));

    const results = await scanProjectFiles(dir);

    // Must not start with sep or contain the baseDir prefix.
    assert.ok(!results[0].relativePath.startsWith(sep), 'relativePath must not be absolute');
    assert.ok(!results[0].relativePath.includes(dir), 'relativePath must not contain baseDir');
    assert.equal(results[0].relativePath, join('sub', 'proj_x.json'));
  });

  it('absolutePath is the full path to the file', async () => {
    const dir = await mkdtemp(join(tmpDir, 'abspath-'));
    const expected = join(dir, 'proj_full.json');
    await writeFile(expected, JSON.stringify({ id: 'proj_full' }));

    const results = await scanProjectFiles(dir);

    assert.equal(results[0].absolutePath, expected);
  });

  it('finds multiple project files across mixed directory structure', async () => {
    const dir = await mkdtemp(join(tmpDir, 'multi-'));
    const subA = join(dir, 'teamA');
    const subB = join(dir, 'teamB', 'nested');
    await mkdir(subA, { recursive: true });
    await mkdir(subB, { recursive: true });

    await writeFile(join(dir, 'proj_root.json'), JSON.stringify({ id: 'proj_root' }));
    await writeFile(join(subA, 'proj_a.json'), JSON.stringify({ id: 'proj_a' }));
    await writeFile(join(subB, 'proj_b.json'), JSON.stringify({ id: 'proj_b' }));
    // These should be ignored.
    await writeFile(join(subA, 'notes.txt'), 'notes');
    await writeFile(join(subB, 'settings.json'), '{}');

    const results = await scanProjectFiles(dir);
    const relatives = results.map((r) => r.relativePath).sort();

    assert.equal(results.length, 3);
    assert.deepEqual(relatives, [
      join('proj_root.json'),
      join('teamA', 'proj_a.json'),
      join('teamB', 'nested', 'proj_b.json'),
    ].sort());
  });
});
