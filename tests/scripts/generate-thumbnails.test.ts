/**
 * TDD: generate-thumbnails CLI
 * Runs in node env (no DOM needed — pure file I/O with sharp).
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import sharp from 'sharp';
import { generateThumbnails } from '../../scripts/generate-thumbnails';

const SIZES = [64, 128, 256, 512] as const;

/** Create a unique tmp directory for test isolation. */
async function makeTmpDir(): Promise<string> {
  const dir = path.join(os.tmpdir(), `thumb-test-${crypto.randomBytes(6).toString('hex')}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Create a small solid-color PNG fixture using sharp (no committed fixture file). */
async function createFixturePng(dir: string): Promise<string> {
  const file = path.join(dir, 'fixture.png');
  await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 200, g: 150, b: 100 },
    },
  })
    .png()
    .toFile(file);
  return file;
}

describe('generateThumbnails', () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    // Clean up all tmp dirs created during the test.
    for (const d of tmpDirs) {
      await fs.rm(d, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it('produces four .webp files at the four named sizes', async () => {
    const tmp = await makeTmpDir();
    tmpDirs.push(tmp);
    const fixture = await createFixturePng(tmp);
    const outDir = path.join(tmp, 'out');

    await generateThumbnails(fixture, outDir);

    for (const size of SIZES) {
      const file = path.join(outDir, `fixture-${size}.webp`);
      const stat = await fs.stat(file);
      expect(stat.isFile(), `fixture-${size}.webp must exist`).toBe(true);
    }
  });

  it('output dimensions match the requested sizes', async () => {
    const tmp = await makeTmpDir();
    tmpDirs.push(tmp);
    const fixture = await createFixturePng(tmp);
    const outDir = path.join(tmp, 'out');

    await generateThumbnails(fixture, outDir);

    for (const size of SIZES) {
      const file = path.join(outDir, `fixture-${size}.webp`);
      const meta = await sharp(file).metadata();
      expect(meta.width, `width at ${size}`).toBe(size);
      expect(meta.height, `height at ${size}`).toBe(size);
    }
  });

  it('throws on missing input file', async () => {
    const tmp = await makeTmpDir();
    tmpDirs.push(tmp);
    const outDir = path.join(tmp, 'out');

    await expect(
      generateThumbnails(path.join(tmp, 'nonexistent.png'), outDir),
    ).rejects.toThrow();
  });

  it('is idempotent: rerunning overwrites without accumulating stale files', async () => {
    const tmp = await makeTmpDir();
    tmpDirs.push(tmp);
    const fixture = await createFixturePng(tmp);
    const outDir = path.join(tmp, 'out');

    await generateThumbnails(fixture, outDir);
    // Run a second time — should not throw or accumulate extra files.
    await generateThumbnails(fixture, outDir);

    const files = await fs.readdir(outDir);
    const webpFiles = files.filter((f) => f.endsWith('.webp'));
    // Exactly 4 webp files — no duplicates or stale sizes.
    expect(webpFiles).toHaveLength(SIZES.length);
  });
});
