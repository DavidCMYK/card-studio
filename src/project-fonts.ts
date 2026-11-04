/** Portable fonts: embed licensed font binaries in the project JSON. */
import {S} from './model';
import type {EmbeddedFont} from './types';

const MAX_FONT_BYTES=12*1024*1024;
const MAX_PROJECT_FONT_BYTES=48*1024*1024;
let activeFaces:FontFace[]=[];
let activePromise:Promise<void>=Promise.resolve();
let generation=0;
let onReady=()=>{};
export const onFontsReady=(handler:()=>void)=>{onReady=handler};
export const usedFontFamilies=():string[]=>{
 const names=new Set<string>();
 for(const e of S.template.elements)if(e.kind==='text'&&e.font)names.add(e.font.trim());
 for(const c of S.cards){
  for(const e of c.extraElements||[])if(e.kind==='text'&&e.font)names.add(e.font.trim());
  for(const entry of Object.values(c.overrides||{}))if(entry.font)names.add(String(entry.font).trim());
 }
 return [...names].filter(Boolean);
};
export const bundledFontFamilies=()=>[...new Set((S.fonts||[]).map(f=>f.family))];
/** Standard fonts are not guaranteed identical everywhere; all non-bundled fonts may be substituted. */
export const unbundledFontFamilies=()=>usedFontFamilies().filter(name=>!(S.fonts||[]).some(f=>f.family.toLowerCase()===name.toLowerCase()));
function filesReady():boolean{
 return typeof document!=='undefined'&&!!document.fonts&&typeof FontFace!=='undefined';
}
export function activateProjectFonts():Promise<void>{
 const ticket=++generation;
 if(!filesReady()){activePromise=Promise.resolve();return activePromise}
 for(const face of activeFaces)document.fonts.delete(face);
 activeFaces=[];
 const assets=[...(S.fonts||[])];
 activePromise=Promise.all(assets.map(async(font)=>{
  try{
   if(!/^data:[^,]*;base64,/i.test(font.data))return;
   const face=new FontFace(font.family,`url("${font.data}")`,{
    weight:String(font.weight||400),style:font.style||'normal'
   });
   await face.load();
   if(generation!==ticket)return;
   document.fonts.add(face);
   activeFaces.push(face);
  }catch(error){console.warn('Card Studio could not load bundled font:',font.filename,error)}
 })).then(()=>{
  if(generation===ticket)onReady();
 });
 return activePromise;
}
export function waitForProjectFonts(){return activePromise}
export function fontAssetTotalBytes(fonts:EmbeddedFont[]=S.fonts||[]):number{
 return fonts.reduce((n,f)=>n+Math.ceil((f.data?.length||0)*.75),0);
}
export function upsertFont(font:EmbeddedFont){
 if(!font.family.trim()||!/^data:[^,]*;base64,/i.test(font.data))throw Error('Invalid font data or family name');
 if(font.data.length*.75>MAX_FONT_BYTES)throw Error('Font file exceeds 12 MB');
 const others=(S.fonts||[]).filter(f=>!(f.family.toLowerCase()===font.family.toLowerCase()&&(f.weight||400)===(font.weight||400)&&(f.style||'normal')===(font.style||'normal')));
 if(fontAssetTotalBytes([...others,font])>MAX_PROJECT_FONT_BYTES)throw Error('Project font files exceed 48 MB');
 S.fonts=[...others,font];
}
function dataURL(blob:Blob):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(Error('Unable to read font file'));
  reader.readAsDataURL(blob);
 });
}
function styleFromName(name:string):{weight:number;style:'normal'|'italic'}{
 const italic=/italic|oblique/i.test(name);
 const weight=/thin/i.test(name)?100:/extra.?light|ultra.?light/i.test(name)?200:/light/i.test(name)?300:
  /semi.?bold|demi.?bold/i.test(name)?600:/extra.?bold|ultra.?bold/i.test(name)?800:/black|heavy/i.test(name)?900:
  /bold/i.test(name)?700:/medium/i.test(name)?500:400;
 return {weight,style:italic?'italic':'normal'};
}
export async function importFontFiles(files:FileList|File[],askFamily:(suggested:string,filename:string)=>string|null=defaultAskFamily):Promise<{added:number;skipped:number}>{
 let added=0,skipped=0;
 for(const file of Array.from(files)){
  if(!/\.(ttf|otf|woff2?)$/i.test(file.name)){skipped++;continue}
  if(file.size>MAX_FONT_BYTES){skipped++;continue}
  const base=file.name.replace(/\.(ttf|otf|woff2?)$/i,'');
  const suggested=base.replace(/[-_](thin|extra.?light|light|regular|medium|semi.?bold|bold|extra.?bold|black|italic|bolditalic)$/i,'').replace(/[_-]+/g,' ').trim();
  const family=askFamily(suggested,file.name);
  if(!family?.trim()){skipped++;continue}
  const data=await dataURL(file),meta=styleFromName(base);
  upsertFont({family:family.trim(),filename:file.name,data,...meta});added++;
 }
 if(added)await activateProjectFonts();
 return {added,skipped};
}
function defaultAskFamily(suggested:string,filename:string):string|null{
 return prompt('Font family for '+filename+' (must match the name used by your text elements)',suggested);
}
/** Chrome/Edge desktop can export installed font blobs after explicit user permission. */
export async function embedInstalledUsedFonts():Promise<{added:number;missing:string[]}>{
 const query=(window as any)?.queryLocalFonts;
 if(typeof query!=='function')throw Error('Installed font access is unavailable here. Choose Embed font files instead.');
 const used=unbundledFontFamilies();
 if(!used.length)return {added:0,missing:[]};
 // This must be invoked directly from the originating click before any modal
 // confirmation or await. Chromium otherwise rejects with "User activation is required".
 // Access is permission-gated; no font bytes are copied until consent below.
 const entries=await query.call(window);
 if(!confirm('Embed these fonts inside this project?\n'+used.join(', ')+'\n\nOnly continue if the font licences permit embedding in your project file.'))return {added:0,missing:used};
 let added=0;
 for(const family of used){
  const matches=entries.filter((f:any)=>String(f.family).toLowerCase()===family.toLowerCase());
  for(const item of matches.slice(0,8)){
   try{
    const blob:Blob=await item.blob();
    if(blob.size>MAX_FONT_BYTES)continue;
    const data=await dataURL(blob),meta=styleFromName(String(item.style||'regular'));
    upsertFont({family,filename:String(item.postscriptName||item.family)+'.ttf',data,...meta});
    added++;
   }catch(error){console.warn('Could not embed installed font',item.family,error)}
  }
 }
 if(added)await activateProjectFonts();
 return {added,missing:unbundledFontFamilies()};
}
