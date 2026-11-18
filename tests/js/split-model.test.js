import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { splitModel } from '../../avatar-live/split-model.js';

let tmp;
let src;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'split-model-'));
  src = path.join(tmp, 'model.vrm');
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('splitModel', () => {
  it('splits into <25MiB hash-named parts and writes a consistent manifest', () => {
    const size = 21 * 1024 * 1024 + 123;
    fs.writeFileSync(src, Buffer.alloc(size, 7));
    const out = path.join(tmp, 'parts');
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, 'part-old-9.bin'), 'stale');

    const manifest = splitModel(src, out);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');

    expect(manifest.parts).toBe(2);
    expect(manifest.size).toBe(size);
    expect(manifest.sha256).toBe(hash);
    expect(manifest.files).toHaveLength(2);
    expect(fs.existsSync(path.join(out, 'part-old-9.bin'))).toBe(false);

    let total = 0;
    for (const entry of manifest.files) {
      expect(entry.file.startsWith(`part-${hash.slice(0, 8)}-`)).toBe(true);
      expect(entry.size).toBeLessThanOrEqual(20 * 1024 * 1024);
      expect(fs.statSync(path.join(out, entry.file)).size).toBe(entry.size);
      total += entry.size;
    }
    expect(total).toBe(size);
    expect(JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'))).toEqual(manifest);
  });

  it('handles a model smaller than one part', () => {
    fs.writeFileSync(src, Buffer.alloc(1024, 1));
    const out = path.join(tmp, 'parts');
    const manifest = splitModel(src, out);
    expect(manifest.parts).toBe(1);
    expect(manifest.files[0].size).toBe(1024);
  });
});
