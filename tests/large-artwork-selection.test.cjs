const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('large-image first press does not rebuild image tags or guides',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/editor.ts'),'utf8');
 const stage=fs.readFileSync(path.join(__dirname,'../src/preview.ts'),'utf8');
 const cache=fs.readFileSync(path.join(__dirname,'../src/image-sets.ts'),'utf8');
 assert.match(source,/const LARGE_INLINE_IMAGE_CHARS=250000;/);
 assert.match(source,/function markSelectedInStage\(node:HTMLElement,id:string\)/);
 assert.match(source,/if\(deferSelection\)\{\s*markSelectedInStage\(node as HTMLElement,id\);\s*deferSelectionRedraw\(\);\s*\}else renderStage\(\)/);
 assert.match(source,/if\(drag\.deferSelection&&pixelDistance<SELECTION_DRAG_SLOP_PX\)return;/);
 assert.match(source,/if\(defer\)\{deferSelectionRedraw\(\);return;\}/);
 assert.match(source,/cancelSelectionRedraw\(\);\s*const now=Date\.now\(\),previous=lastEditPointer;/);
 assert.match(stage,/st\.innerHTML=html\+guideOverlay\(S\.template,S\.mode,S\.zoom\)/);
 assert.match(stage,/src="\$\{src\}" style="left:/);
 assert.doesNotMatch(cache,/createObjectURL/,'do not bring back blob URLs');
});
