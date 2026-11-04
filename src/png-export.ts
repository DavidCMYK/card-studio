import { S, card, safeFile, assignedTemplate } from './model';
import type {CardSide} from './types';
import {guideRects} from './card-guides';
import { $, download, toast } from './dom';
import { canvasCard } from './png-renderer';
const toBlob=cvs=>new Promise(resolve=>cvs.toBlob(resolve,'image/png'));
export async function exportPNG(){try{const ci=S.cardIndex,cvs=await canvasCard(ci,S.mode==='cards'?'cards':'template',S.side||'front'),blob=await toBlob(cvs);if(!blob)throw Error('Could not create PNG');download(blob,safeFile(S.mode==='cards'?card().name:S.template.name)+'.png');toast('PNG exported at '+S.template.dpi+' DPI')}catch(err){alert('PNG export failed: '+err.message)}}
export async function exportAll(){if(!S.cards.length){toast('No cards staged');return}const b=$('[data-action="export-all"]'),previous=b.textContent;b.disabled=true;try{const zip=new JSZip();const used={};for(let i=0;i<S.cards.length;i++){b.textContent=`Exporting ${i+1}/${S.cards.length}`;const cvs=await canvasCard(i,'cards'),blob=await toBlob(cvs);if(!blob)throw Error('PNG generation failed');let name=safeFile(S.cards[i].name),suffix=1;while(used[name.toLowerCase()])name=safeFile(S.cards[i].name)+'_'+(++suffix);used[name.toLowerCase()]=true;zip.file(name+'.png',blob);if(i%3===2)await new Promise(r=>setTimeout(r,0))}b.textContent='Creating ZIP…';const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});download(blob,safeFile(S.projectName)+'_cards.zip');toast('Exported '+S.cards.length+' cards to ZIP')}catch(err){alert('Batch export failed: '+err.message)}finally{b.textContent=previous;b.disabled=false}}


/** Trimmed PNG: remove included bleed while keeping normal PNG/ZIP exports unchanged. */
export async function exportTrimmedPNG(){
 try{
  const ci=S.cardIndex,source=await canvasCard(ci,S.mode==='cards'?'cards':'template',S.side||'front');
  const active=S.mode==='cards'?assignedTemplate(ci,S.side||'front')||S.template:S.template;
  const r=guideRects(active);
  const sx=source.width/r.canvas.width,sy=source.height/r.canvas.height;
  // Source boundaries may be fractional pixels. Sample them precisely, but
  // round the final physical trim size only once to prevent one-pixel drift.
  const cvs=document.createElement('canvas');
  cvs.width=Math.max(1,Math.round(r.trim.w*active.dpi/25.4));
  cvs.height=Math.max(1,Math.round(r.trim.h*active.dpi/25.4));
  const ctx=cvs.getContext('2d');
  if(!ctx)throw Error('Could not draw trimmed PNG');
  ctx.drawImage(source,r.trim.x*sx,r.trim.y*sy,r.trim.w*sx,r.trim.h*sy,0,0,cvs.width,cvs.height);
  const blob=await toBlob(cvs);
  if(!blob)throw Error('Could not create trimmed PNG');
  download(blob,safeFile(S.mode==='cards'?card().name:S.template.name)+'_trim.png');
  toast('Trimmed PNG exported at '+S.template.dpi+' DPI');
 }catch(err){alert('Trimmed PNG export failed: '+(err as Error).message);}
}

/** Batch-export the back side of cards that have an assigned back template. */
export async function exportBacks():Promise<void>{return exportCardSides('back')}
export async function exportFrontsAndBacks():Promise<void>{return exportCardSides('both')}
async function exportCardSides(which:'back'|'both'):Promise<void>{
 const button=document.querySelector<HTMLButtonElement>('[data-action="'+(which==='back'?'export-backs':'export-both')+'"]');
 const oldLabel=button?.textContent||'Export';
 if(button)button.disabled=true;
 try{
  const zip=new JSZip(),used=new Set<string>();
  let count=0;
  for(let i=0;i<S.cards.length;i++){
   const sides:CardSide[]=which==='both'?['front','back']:['back'];
   for(const side of sides){
    if(side==='back'&&!assignedTemplate(i,'back'))continue;
    const canvas=await canvasCard(i,'cards',side),blob=await toBlob(canvas);
    if(!blob)throw Error('Could not render card '+S.cards[i].name);
    const base=safeFile(S.cards[i].name)+'_'+side;
    let filename=base+'.png',num=2;
    while(used.has(filename.toLowerCase()))filename=base+'_'+(num++)+'.png';
    used.add(filename.toLowerCase());zip.file(filename,blob);count++;
   }
  }
  if(!count)throw Error('No card sets have assigned back templates');
  const output=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
  download(output,safeFile(S.projectName)+(which==='both'?'_fronts_and_backs.zip':'_backs.zip'));
  toast('Exported '+count+' card sides');
 }catch(error){alert('Card export failed: '+(error as Error).message);}
 finally{if(button){button.disabled=false;button.textContent=oldLabel;}}
}
