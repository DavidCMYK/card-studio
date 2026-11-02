import { S, escapeHTML } from './model';
import { $ , toast } from './dom';
import { repaint } from './interface';
import { renameImage, removeImage } from './image-set-edit';
import { setTargetImageSet } from './assets';

let activeSetId: string | null = null;
export function closeImageManager() {
 activeSetId=null;
 $('#dialogHolder').innerHTML='';
}
export function renderImageManager() {
 if(!activeSetId)return;
 const set=S.sets.find(x=>x.id===activeSetId);
 if(!set){closeImageManager();return}
 $('#dialogHolder').innerHTML=`<div class="image-manager-backdrop" role="presentation">
  <section class="image-manager" role="dialog" aria-modal="true" aria-label="Manage images in ${escapeHTML(set.name)}">
   <header class="image-manager-header"><div><h2>Manage images</h2><span>${escapeHTML(set.name)} · ${set.images.length} image${set.images.length===1?'':'s'}</span></div><button class="secondary" data-action="manage-close" aria-label="Close image manager">Close</button></header>
   <div class="image-manager-tools"><button class="secondary" data-action="manage-add" data-set="${escapeHTML(set.id)}">＋ Add images</button><span>Rename or remove images without deleting the set.</span></div>
   <div class="image-manager-list">${set.images.length?set.images.map((im,i)=>`<div class="image-manager-item">
    <img alt="" src="${escapeHTML(im.data)}"><div class="image-manager-detail"><label for="managed-image-${i}">Filename</label><input id="managed-image-${i}" data-manager-name="${i}" type="text" value="${escapeHTML(im.name)}" spellcheck="false"></div>
    <div class="image-manager-actions"><button class="secondary" data-action="manage-rename" data-index="${i}">Rename</button><button class="secondary danger" data-action="manage-remove" data-index="${i}">Remove</button></div>
   </div>`).join(''):'<div class="image-manager-empty">No images in this set. Use Add images to upload some.</div>'}</div>
  </section></div>`;
}
export function openImageManager(id: string) {
 if(!S.sets.some(set=>set.id===id))return;
 activeSetId=id;
 renderImageManager();
}
export function imageManagerAction(action: string,index: number) {
 const set=S.sets.find(set=>set.id===activeSetId);
 if(!set)return;
 const image=set.images[index];
 if(action==='manage-add') {
  setTargetImageSet(set.id);
  $('#assetFiles').click();
  return;
 }
 if(!image)return;
 try{
  if(action==='manage-rename') {
   const input=document.querySelector(`[data-manager-name="${index}"]`) as HTMLInputElement;
   if(renameImage(set.id,image.name,input?.value ?? '')){
    repaint();renderImageManager();toast('Image renamed');
   }
  }
  if(action==='manage-remove') {
   if(!confirm(`Remove "${image.name}" from "${set.name}"? This cannot be undone.`))return;
   removeImage(set.id,image.name);
   repaint();renderImageManager();toast('Image removed');
  }
 }catch(err){alert((err as Error).message)}
}
