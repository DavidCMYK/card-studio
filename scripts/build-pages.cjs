/** Prepare a minimal static website for Cloudflare Pages Git deployments. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
const assets = [
  'index.html',
  'styles.css',
  'dist/app.js',
  'vendor/jszip.min.js',
];

// Verify the build finished before replacing the previous deployment folder.
for (const file of assets) {
  const source = path.join(root, file);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Cannot publish Card Studio: missing ${file}. Run npm run build first.`);
  }
}

// index.html uses these relative paths; keep the same directory layout.
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const file of assets.slice(1)) {
  if (!html.includes(`./${file}`)) {
    throw new Error(`index.html no longer references expected asset: ${file}`);
  }
}

fs.rmSync(output, { recursive: true, force: true });
for (const file of assets) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}

console.log(`Cloudflare Pages: prepared ${assets.length} static files in public/`);
