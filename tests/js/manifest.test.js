import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const manifestPath = path.resolve(__dirname, '../../avatar-live/model-parts/manifest.json');
const hasManifest = fs.existsSync(manifestPath);
const suite = hasManifest ? describe : describe.skip;

suite('model-parts manifest (local build)', () => {
  const manifest = hasManifest ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
  const dir = path.dirname(manifestPath);

  it('has files that exist, are <25MiB, and sum to the model size', () => {
    expect(manifest.parts).toBe(manifest.files.length);
    let total = 0;
    for (const entry of manifest.files) {
      expect(entry.file.startsWith(`part-${manifest.sha256.slice(0, 8)}-`)).toBe(true);
      expect(entry.size).toBeLessThanOrEqual(25 * 1024 * 1024);
      const st = fs.statSync(path.join(dir, entry.file));
      expect(st.size).toBe(entry.size);
      total += entry.size;
    }
    expect(total).toBe(manifest.size);
  });
});
