// Split model.vrm into <25MiB parts with a content hash in filenames.
// Usage:
//   node split-model.js           split into avatar-live/model-parts (+ dist if present)
//   node split-model.js --watch   re-run whenever model.vrm changes
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PART = 20 * 1024 * 1024;
const root = __dirname;
const modelPath = path.join(root, 'model.vrm');
const localOut = path.join(root, 'model-parts');
const distOut = path.join(root, 'dist', 'model-parts');

function splitModel(src, outDir) {
  const model = fs.readFileSync(src);
  const sha = crypto.createHash('sha256').update(model).digest('hex');
  const tag = sha.slice(0, 8);
  const count = Math.max(1, Math.ceil(model.length / PART));

  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(outDir)) {
    if (/^part-.*\.bin$/.test(name)) fs.unlinkSync(path.join(outDir, name));
  }

  const files = [];
  for (let i = 0; i < count; i++) {
    const chunk = model.subarray(i * PART, (i + 1) * PART);
    const name = `part-${tag}-${i}.bin`;
    fs.writeFileSync(path.join(outDir, name), chunk);
    files.push({ file: name, size: chunk.length });
  }

  const manifest = {
    sha256: sha,
    partSize: PART,
    parts: count,
    size: model.length,
    files,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

function run() {
  if (!fs.existsSync(modelPath)) {
    console.error('model.vrm not found at', modelPath);
    process.exit(1);
  }
  const manifest = splitModel(modelPath, localOut);
  console.log(
    `local: ${manifest.parts} parts, ${(manifest.size / 1e6).toFixed(1)} MB, sha ${manifest.sha256.slice(0, 8)}`
  );
  if (fs.existsSync(path.join(root, 'dist'))) {
    splitModel(modelPath, distOut);
    console.log('dist: model parts refreshed');
  }
}

if (process.argv.includes('--watch')) {
  run();
  let timer = null;
  fs.watch(modelPath, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { run(); } catch (e) { console.error(e.message); }
    }, 400);
  });
  console.log('watching model.vrm for changes… (Ctrl+C to stop)');
} else {
  run();
}

module.exports = { splitModel };
