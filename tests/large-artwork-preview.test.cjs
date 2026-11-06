const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {imageCache,cacheImage}=require('../.build/image-sets.js');

test('large embedded artwork is decoded only once into a short, reusable preview URL',()=>{
 const saved={Image:global.Image,URL:global.URL};
 const created=[],revoked=[];
 let next=0;
 global.Image=class ImageStub {
  set src(value){this.currentSrc=value;}
  addEventListener(){}
 };
 global.URL={
  createObjectURL(blob){created.push(blob);return 'blob:card-studio/'+(++next);},
  revokeObjectURL(url){revoked.push(url);}
 };
 try{
  imageCache.clear();
  // A realistic high-resolution image uses several megabytes of data.
  const bytes=Buffer.alloc(6*1024*1024,23);
  const src='data:image/png;base64,'+bytes.toString('base64');
  const one=cacheImage(src);
  assert.equal(one.displayUrl,'blob:card-studio/1');
  assert.equal(one.im.currentSrc,one.displayUrl,'decoder uses the same blob URL as the stage');
  assert.equal(created.length,1);
  assert.equal(created[0].type,'image/png');
  assert.equal(created[0].size,bytes.length,'image bytes remain intact');
  const same=cacheImage(src);
  assert.strictEqual(same,one,'repeated redraws reuse one decoded asset');
  assert.equal(created.length,1,'no repeated Base64 decoding or Blob allocation');
  assert.ok(one.displayUrl.length<100,'preview markup contains a short URL, not 8 MB of Base64');
  assert.ok(!one.displayUrl.includes(src.slice(0,100)));
  imageCache.clear();
  assert.deepEqual(revoked,['blob:card-studio/1'],'cache clear releases the browser URL');
  assert.equal(imageCache.size,0);
  assert.equal(cacheImage(src).displayUrl,'blob:card-studio/2');
  assert.equal(imageCache.delete(src),true);
  assert.deepEqual(revoked,['blob:card-studio/1','blob:card-studio/2'],'cache deletion releases URL');
 }finally{
  imageCache.clear();
  if(saved.Image===undefined)delete global.Image;else global.Image=saved.Image;
  if(saved.URL===undefined)delete global.URL;else global.URL=saved.URL;
 }
});

test('small, remote and unsupported image sources keep their original URI',()=>{
 const saved={Image:global.Image,URL:global.URL};
 let allocations=0;
 global.Image=class ImageStub{set src(value){this.currentSrc=value;}addEventListener(){}};
 global.URL={createObjectURL(){allocations++;return 'blob:unexpected';},revokeObjectURL(){}};
 try{
  imageCache.clear();
  const small='data:image/png;base64,'+Buffer.from('png').toString('base64');
  const remote='https://images.example.org/image.jpg';
  const svg='data:image/svg+xml;base64,'+Buffer.alloc(300000,66).toString('base64');
  assert.equal(cacheImage(small).displayUrl,small);
  assert.equal(cacheImage(remote).displayUrl,remote);
  assert.equal(cacheImage(svg).displayUrl,svg);
  assert.equal(allocations,0);
 }finally{
  imageCache.clear();
  if(saved.Image===undefined)delete global.Image;else global.Image=saved.Image;
  if(saved.URL===undefined)delete global.URL;else global.URL=saved.URL;
 }
});
test('card preview uses the cached image URL without changing saved image data',()=>{
 const preview=fs.readFileSync(path.join(__dirname,'../src/preview.ts'),'utf8');
 const imageSets=fs.readFileSync(path.join(__dirname,'../src/image-sets.ts'),'utf8');
 assert.match(preview,/src="\$\{im\.displayUrl\}"/);
 assert.doesNotMatch(preview,/src="\$\{src\}" style="left:/);
 assert.match(imageSets,/export const getImageData=.*getImageRef.*\.data/);
});
