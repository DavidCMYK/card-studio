/** Prepare a minimal static website for Cloudflare Pages Git deployments. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {writeIcons} = require('./icon-maker.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
const assets = [
  'index.html',
  'styles.css',
  'mobile.css',
  'dist/app.js',
  'vendor/jszip.min.js',
  'manifest.webmanifest',
  'service-worker.js',
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
for (const file of assets.slice(1).filter(file=>file!=='service-worker.js')) {
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

const commit = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA ||
  execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME ||
  execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim();
writeIcons(output);
const worker=path.join(output,'service-worker.js');
fs.writeFileSync(worker,fs.readFileSync(worker,'utf8').replace('__CACHE_VERSION__',commit));
fs.writeFileSync(path.join(output,'build-info.json'),JSON.stringify({commit,branch},null,2)+'\n');
console.log(`Cloudflare Pages: prepared ${assets.length} static files in public/ (${branch} @ ${commit.slice(0,10)})`);
