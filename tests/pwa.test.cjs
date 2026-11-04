const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {iconPng}=require('../scripts/icon-maker.cjs');
const root=path.join(__dirname,'..');

test('PWA manifest has secure install configuration and required icon sizes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'./');
 assert.equal(manifest.scope,'./');
 assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
 assert.ok(manifest.icons.every(i=>i.type==='image/png'));
});
test('generated application icons are valid PNGs at their declared dimensions',()=>{
 for(const size of [192,512]){
  const png=iconPng(size);
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),size);
  assert.equal(png.readUInt32BE(20),size);
  assert.ok(png.length>500);
 }
});
test('service worker shell is limited to static assets, not user JSON files',()=>{
 const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 for(const file of ['index.html','mobile.css','dist/app.js','manifest.webmanifest','icons/card-192.png','icons/card-512.png'])
  assert.ok(sw.includes('./'+file),'app shell includes '+file);
 assert.match(sw,/request\.method!=='GET'/);
 assert.match(sw,/url\.origin!==self\.location\.origin/);
 assert.doesNotMatch(sw,/cardstudio\.json/,'private project files must never be cached as shell resources');
});
