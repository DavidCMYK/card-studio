const test=require('node:test');
const assert=require('node:assert/strict');
const {depthMergedShadowPasses}=require('../.build/shadow.js');

function image(width,height,filled=[]){
 const data=new Uint8ClampedArray(width*height*4);
 for(const [x,y,r,g,b,a] of filled){data.set([r,g,b,a],(y*width+x)*4)}
 return {width,height,data};
}
function stubCanvas(source){
 let current=source;
 return {width:source.width,height:source.height,getContext(){return {
  getImageData(){return current},putImageData(value){current=value}
 }}};
}
global.ImageData=class ImageData{constructor(width,height){this.width=width;this.height=height;this.data=new Uint8ClampedArray(width*height*4)}};
global.document={createElement(){return stubCanvas(image(1,1))}};

function placed(a,filledMask=0){
 const pixel=image(1,1,[[0,0,0,0,0,a]]), source=image(1,1,[[0,0,255,0,0,filledMask]]);
 return {x:0,y:0,shadow:{canvas:stubCanvas(pixel),pixels:source,pad:0,ratio:1},alpha:{pixels:source,pad:0,ratio:1}};
}
function alpha(pass){return pass?.canvas.getContext('2d').getImageData().data[3]??0}
function composedOpacity(passes){let cover=0;for(const pass of passes){const a=alpha(pass)/255;cover=a+cover*(1-a)}return cover}

test('real shadow pass data: two 50%-opaque shadows merge to 50%, not 75% or 100%',()=>{
 const passes=depthMergedShadowPasses(1,1,1,[placed(128),placed(128)]);
 assert.equal(alpha(passes[0]),128);
 assert.equal(passes[1],null,'second shadow must contribute zero new opacity');
 assert.ok(Math.abs(composedOpacity(passes)-128/255)<0.001);
});

test('real shadow pass data: a single 50%-opaque shadow remains 50% above any background',()=>{
 const passes=depthMergedShadowPasses(1,1,1,[{x:0,y:0,shadow:null,alpha:{pixels:image(1,1,[[0,0,255,255,255,255]]),pad:0,ratio:1}},placed(128)]);
 assert.equal(passes[0],null);
 assert.equal(alpha(passes[1]),128);
});

test('opaque intervening artwork resets shadow coverage for the next shadow',()=>{
 const solid={x:0,y:0,shadow:null,alpha:{pixels:image(1,1,[[0,0,0,0,255,255]]),pad:0,ratio:1}};
 const passes=depthMergedShadowPasses(1,1,1,[placed(128),solid,placed(128)]);
 assert.equal(alpha(passes[0]),128);
 assert.equal(alpha(passes[2]),128,'higher shadow must still cast onto lower artwork');
});

test('semi-transparent intervening artwork attenuates prior shadow coverage',()=>{
 const semi={x:0,y:0,shadow:null,alpha:{pixels:image(1,1,[[0,0,0,0,255,128]]),pad:0,ratio:1}};
 const passes=depthMergedShadowPasses(1,1,1,[placed(128),semi,placed(128)]);
 assert.equal(alpha(passes[0]),128);
 assert.ok(alpha(passes[2])>=84&&alpha(passes[2])<=87,'new shadow must only add the missing fraction');
});

test('different shadow opacities use the highest one and preserve transparent gaps',()=>{
 const first=image(3,1,[[0,0,0,0,0,77],[1,0,0,0,0,179]]),second=image(3,1,[[0,0,0,0,0,179],[1,0,0,0,0,51]]);
 const s=source=>({x:0,y:0,shadow:{canvas:stubCanvas(source),pixels:image(3,1),pad:0,ratio:1},alpha:{pixels:image(3,1),pad:0,ratio:1}});
 const passes=depthMergedShadowPasses(3,1,1,[s(first),s(second)]);
 const contribution=passes[1].canvas.getContext('2d').getImageData().data;
 assert.ok(contribution[3]>0,'stronger second shadow should contribute where needed');
 assert.equal(contribution[7],0,'weaker second shadow contributes nothing to stronger first');
 assert.equal(contribution[11],0,'fully transparent pixel remains transparent');
});
