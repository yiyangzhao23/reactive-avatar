// Build the deployable static site into dist/.
// Splits model.vrm into <25MiB parts (Cloudflare Pages per-file limit).
const fs = require('fs');
const path = require('path');
const { splitModel } = require('./split-model.js');

const root = __dirname;
const dist = path.join(root, 'dist');
const PART = 20 * 1024 * 1024;

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const files = [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
];
for (const f of files) fs.copyFileSync(path.join(root, f), path.join(dist, f));
fs.cpSync(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });

const manifest = splitModel(path.join(root, 'model.vrm'), path.join(dist, 'model-parts'));
const count = manifest.parts;

fs.writeFileSync(path.join(dist, '_headers'), [
  '/*',
  '  Permissions-Policy: camera=(self), display-capture=(self), microphone=(self)',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Content-Security-Policy: default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'wasm-unsafe-eval\' https://cdn.jsdelivr.net https://storage.googleapis.com; connect-src \'self\' blob: https://generativelanguage.googleapis.com https://api.deepseek.com https://opencode.ai https://cdn.jsdelivr.net https://storage.googleapis.com; img-src \'self\' data: blob:; media-src \'self\' data: blob:; style-src \'self\' \'unsafe-inline\'; worker-src \'self\' blob:',
  '',
].join('\n'));

function size(dir) {
  return fs.readdirSync(dir).reduce((n, name) => {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    return n + (st.isDirectory() ? size(p) : st.size);
  }, 0);
}
console.log(`dist ready: ${count} model parts, ${(size(dist) / 1e6).toFixed(1)} MB total`);
