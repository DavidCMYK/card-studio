const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const live = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
const staging = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.test.jsonc'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('the staging Worker cannot overwrite the live Worker', () => {
  assert.equal(live.name, 'card-studio');
  assert.equal(staging.name, 'card-studio-mobile-test');
  assert.notEqual(staging.name, live.name);
  assert.equal(staging.workers_dev, true);
  assert.deepEqual(staging.assets, live.assets);
  assert.match(pkg.scripts['deploy:test'], /--config wrangler\.test\.jsonc/);
  assert.match(pkg.scripts['deploy:test'], /build:pages/);
});
