/** Preview and approve artwork assignments; reuses existing image sets and
 * project history. No filename guess is written until Apply is clicked. */
import {S,escapeHTML,uid} from './model';
import {gridColumns} from './card-data-grid';
import {repaint} from './interface';
import {checkpoint} from './history';
import {setTargetImageSet,importImages} from './assets';
import {CARD_NAME_KEY,suggestArtwork,applyArtwork,imageChoices,findChoice,MatchOptions,MatchRow} from './artwork-auto-match';
import type {ImageChoice} from './artwork-auto-match';

const PAGE=60;
const sheet=String.raw`<style>
#artMatch{position:fixed;inset:0;z-index:15200;display:flex;align-items:center;justify-content:center;background:#071626d9;padding:8px;font:13px system-ui,sans-serif;color:#20364f;color-scheme:light}
#artMatch *{box-sizing:border-box}
#artMatch .am-panel{width:min(1200px,100%);max-height:97vh;display:flex;flex-direction:column;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #9fb5ca}
#artMatch .am-top{background:#14253b;color:#f4f7fd;padding:11px 15px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#artMatch .am-top strong{font-size:17px;flex:1}
#artMatch .am-controls{padding:12px 15px;background:#f3f7fb;display:flex;flex-wrap:wrap;align-items:center;gap:9px;border-bottom:1px solid #d9e3ed}
#artMatch .am-controls label{display:flex;align-items:center;gap:5px}
#artMatch input,#artMatch select,#artMatch button{font:inherit;padding:7px;border:1px solid #b2c4d6;border-radius:5px;background:#fff;color:#233b55}
#artMatch button{cursor:pointer;background:#e9f1fb;color:#224d7e;font-weight:600}
#artMatch button:hover:not(:disabled){background:#dae8fb}
#artMatch button:disabled{opacity:.5;cursor:default}
#artMatch .am-top button{color:#fff;background:#294767;border-color:#5c7290}
#artMatch .am-action{background:#286ac2;color:white;border-color:#286ac2}
#artMatch .am-action:hover:not(:disabled){background:#1c559e;color:white}
#artMatch .am-summary{padding:8px 15px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;border-bottom:1px solid #dae3ee}
#artMatch .am-summary small{color:#526980}
#artMatch .am-scroll{overflow:auto;min-height:90px;flex:1}
#artMatch table{border-collapse:collapse;width:100%;min-width:730px}
#artMatch th{background:#254363;color:#f7f9fc;text-align:left;padding:9px;position:sticky;top:0;z-index:2}
#artMatch td{border-bottom:1px solid #dae3ec;padding:8px;vertical-align:middle}
#artMatch tbody tr:nth-child(even){background:#f3f7fc}
#artMatch tbody tr.am-picked{background:#e5f1ff}
#artMatch .am-img{width:62px;height:62px;object-fit:contain;background:#fff;border:1px solid #cad6e2;border-radius:4px;display:block}
#artMatch .am-img-placeholder{display:grid;place-items:center;background:#f4f6f9;color:#6a7787;width:62px;height:62px;border:1px dashed #b2c1ce;border-radius:4px}
#artMatch .am-choice{display:flex;gap:8px;align-items:center}
#artMatch .am-choice select{min-width:120px;max-width:250px;width:100%}
#artMatch .am-foot{padding:10px 14px;background:#f4f7fb;border-top:1px solid #dae3ed;display:flex;align-items:center;flex-wrap:wrap;gap:9px}
#artMatch .am-foot span{flex:1;color:#466079}
#artMatch .am-dim{font-size:11px;color:#5c7289;overflow-wrap:anywhere}
#artMatch .am-badge{font-size:11px;font-weight:700;color:#315e91}
#artMatch .am-gallery{position:absolute;inset:3%;background:#fff;border:1px solid #b6c5d6;border-radius:9px;display:flex;flex-direction:column;box-shadow:0 8px 35px #061a36a8;overflow:hidden;z-index:4}
#artMatch .am-gallery[hidden]{display:none}
#artMatch .am-gallery-tools{padding:11px;display:flex;gap:9px;align-items:center;flex-wrap:wrap;background:#f4f8fc;border-bottom:1px solid #d7e0ec}
#artMatch .am-gallery-tools input{flex:1;min-width:140px}
#artMatch .am-gallery-grid{overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;padding:10px}
#artMatch .am-gallery-grid button{display:flex;flex-direction:column;align-items:center;gap:5px;overflow-wrap:anywhere;text-align:center;min-height:150px;background:#fff}
#artMatch .am-gallery-grid button:hover{border-color:#246ad0;background:#eaf3ff}
#artMatch .am-gallery-grid img{width:100px;height:95px;object-fit:contain}
#artMatch .am-gallery-grid small{font-size:10px;overflow-wrap:anywhere}
#artMatch .am-notice{padding:8px 14px;color:#395b77;background:#f8fafc;min-height:31px}
#artMatch input[type=checkbox]{accent-color:#286ac2;width:16px;height:16px}
@media(max-width:650px){#artMatch{padding:3px}#artMatch .am-panel{max-height:99vh}#artMatch .am-controls{padding:7px;gap:6px}#artMatch .am-gallery{inset:1%}}
</style>`;
const safe=(text:string)=>escapeHTML(String(text??''));
export function openArtworkMatcher(initialSetId?:string):void{
 const holder=document.querySelector('#dialogHolder') as HTMLElement|null;
 if(!holder)return;
 const sets=S.cardSets||[];
 if(!sets.length){alert('Create a card set before matching artwork');return;}
 let setId=sets.find(s=>s.id===initialSetId)?.id||sets[0].id;
 let targetId='',sourceId=CARD_NAME_KEY,imageSetId='',importSetId='';
 let overwrite=false,filter='all',query='',page=0,rows:MatchRow[]=[];
 const selected=new Set<string>(),manual=new Map<string,string>();
 let galleryCardId:string|null=null;
 holder.innerHTML=sheet+String.raw`<div id="artMatch"><div class="am-panel" role="dialog" aria-modal="true" aria-label="Match artwork">
 <header class="am-top"><strong>Match artwork to cards</strong><span>Preview assignments before applying</span><button data-am="close">Close</button></header>
 <div class="am-controls"><label>Card set <select id="amSet"></select></label><label>Image field <select id="amTarget"></select></label>
 <label>Match using <select id="amSource"></select></label><label>Search images in <select id="amSourceSet"></select></label>
 <label><input type="checkbox" id="amOverwrite"> Replace existing card assignments</label></div>
 <div class="am-controls"><label>Import into <select id="amImportSet"></select></label>
 <button data-am="files">Add image files</button><button data-am="folder">Add image folder</button><button data-am="new-set">Create image set</button>
 <input id="amFiles" type="file" accept="image/*" multiple hidden><input id="amFolder" type="file" accept="image/*" multiple webkitdirectory hidden></div>
 <div id="amNotice" class="am-notice">Exact matches are selected automatically. Review uncertain matches.</div>
 <div class="am-summary"><strong id="amStats"></strong><label>Filter <select id="amFilter"><option value="all">All cards</option><option value="review">Needs review</option><option value="ready">Selected</option><option value="missing">No match</option></select></label>
 <input id="amSearch" type="search" placeholder="Search card or image" aria-label="Search matching results"><small>Ambiguous and fuzzy matches need approval.</small></div>
 <div class="am-scroll"><table aria-label="Artwork match preview"><thead><tr><th>Use</th><th>Card / matching value</th><th>Image preview</th><th>Proposed assignment</th><th>Confidence</th></tr></thead><tbody id="amRows"></tbody></table></div>
 <footer class="am-foot"><button data-am="prev">Previous</button><span id="amPage"></span><button data-am="next">Next</button><button data-am="apply" class="am-action">Apply selected matches</button><button data-am="close">Close</button></footer>
 </div>
 <div id="amGallery" class="am-gallery" hidden><div class="am-gallery-tools"><strong>Select image</strong><input id="amGallerySearch" type="search" placeholder="Filter available images" aria-label="Filter available artwork"><button data-am="gallery-close">Back to matches</button></div><div class="am-gallery-grid" id="amGalleryGrid"></div></div>
 </div>`;
 const root=holder.querySelector('#artMatch') as HTMLElement;
 const setInput=root.querySelector('#amSet') as HTMLSelectElement,
 targetInput=root.querySelector('#amTarget') as HTMLSelectElement,
 sourceInput=root.querySelector('#amSource') as HTMLSelectElement,
 imageInput=root.querySelector('#amSourceSet') as HTMLSelectElement,
 importInput=root.querySelector('#amImportSet') as HTMLSelectElement,
 overwriteInput=root.querySelector('#amOverwrite') as HTMLInputElement,
 table=root.querySelector('#amRows') as HTMLElement,
 stats=root.querySelector('#amStats') as HTMLElement,
 notice=root.querySelector('#amNotice') as HTMLElement,
 filterInput=root.querySelector('#amFilter') as HTMLSelectElement,
 search=root.querySelector('#amSearch') as HTMLInputElement,
 pageInfo=root.querySelector('#amPage') as HTMLElement,
 gallery=root.querySelector('#amGallery') as HTMLElement,
 gallerySearch=root.querySelector('#amGallerySearch') as HTMLInputElement,
 galleryGrid=root.querySelector('#amGalleryGrid') as HTMLElement;
 const opt=(id:string,label:string)=>'<option value="'+safe(id)+'">'+safe(label)+'</option>';
 function imageSetMenus(){
  imageInput.innerHTML=opt('','All image sets')+S.sets.map(set=>opt(set.id,set.name+' ('+set.images.length+')')).join('');
  imageInput.value=S.sets.some(s=>s.id===imageSetId)?imageSetId:'';
  importInput.innerHTML=S.sets.map(set=>opt(set.id,set.name)).join('');
  importSetId=S.sets.some(set=>set.id===importSetId)?importSetId:S.sets[0]?.id||'';
  importInput.value=importSetId;
 }
 function setMenus(){
  setInput.innerHTML=(S.cardSets||[]).map(set=>opt(set.id,set.name)).join('');
  setInput.value=setId;
  const cols=gridColumns(setId),targets=cols.filter(col=>col.kind==='image');
  targetInput.innerHTML=targets.length?targets.map(col=>opt(col.id,col.label)).join(''):
   opt('','No image fields in this set');
  targetId=targets.some(col=>col.id===targetId)?targetId:targets[0]?.id||'';
  targetInput.value=targetId;
  const sources=cols.filter(col=>col.kind==='text');
  sourceInput.innerHTML=opt(CARD_NAME_KEY,'Card name')+
   sources.map(col=>opt(col.id,col.label)).join('');
  if(sourceId!==CARD_NAME_KEY&&!sources.some(col=>col.id===sourceId))sourceId=CARD_NAME_KEY;
  sourceInput.value=sourceId;
 }
 function resetPreview(){
  selected.clear();manual.clear();page=0;
  buildPreview();
 }
 function buildPreview(){
  try{
   rows=targetId?suggestArtwork({setId,targetId,sourceId,imageSetId:imageSetId||undefined,overwrite}):[];
   for(const row of rows)if(row.status==='exact'&&row.suggested)selected.add(row.cardId);
   render();
  }catch(error){rows=[];table.innerHTML='';stats.textContent='Unable to preview matches';notice.textContent=(error as Error).message;}
 }
 function chosen(row:MatchRow):ImageChoice|null{
  const key=manual.get(row.cardId)||row.suggested?.key||'';
  return key?findChoice(key):null;
 }
 function visibleRows(){
  const needle=query.toLocaleLowerCase().trim();
  return rows.filter(row=>{
   const choice=chosen(row);
   if(filter==='ready'&&!selected.has(row.cardId))return false;
   if(filter==='missing'&&row.status!=='missing')return false;
   if(filter==='review'&&row.status!=='review'&&row.status!=='ambiguous'&&row.status!=='missing'&&row.status!=='fixed')return false;
   return !needle||[row.cardName,row.source,row.existing,choice?.name||'',choice?.setName||'']
    .some(value=>value.toLocaleLowerCase().includes(needle));
  });
 }
 function render(){
  if(holder.querySelector('#artMatch')!==root)return;
  const counted={exact:0,review:0,ambiguous:0,missing:0,assigned:0,fixed:0};
  for(const row of rows){
   if(row.status in counted)counted[row.status as keyof typeof counted]++;
  }
  stats.textContent=rows.length+' cards · '+selected.size+' selected · '+
   counted.exact+' exact · '+(counted.review+counted.ambiguous)+' to review · '+
   counted.missing+' unmatched · '+(counted.assigned+counted.fixed)+' already assigned/fixed';
  const filtered=visibleRows(),pages=Math.max(1,Math.ceil(filtered.length/PAGE));
  page=Math.min(page,pages-1);
  const shown=filtered.slice(page*PAGE,(page+1)*PAGE);
  table.innerHTML=shown.length?shown.map(row=>{
   const chosenImage=chosen(row),checked=selected.has(row.cardId);
   const canSelect=!!chosenImage&&row.status!=='fixed'&&
    (overwrite||!row.existing.trim()||row.existing===chosenImage.setName+'/'+chosenImage.name);
   const options=[...row.alternatives];
   if(chosenImage&&!options.some(x=>x.key===chosenImage.key))
    options.unshift({...chosenImage,score:0,reason:'Manual selection'});
   const choices=opt('','Choose image…')+options.map(c=>opt(c.key,c.setName+' / '+c.name)).join('');
   const image=chosenImage?'<img class="am-img" alt="" data-am-preview="'+safe(row.cardId)+'">':
    '<span class="am-img-placeholder">No image</span>';
   const label=row.status==='exact'?'High confidence':
    row.status==='review'?'Review suggestion':row.status==='ambiguous'?'Ambiguous':
    row.status==='missing'?'No match':row.status==='assigned'?'Already assigned':'Fixed template image';
   return '<tr class="'+(checked?'am-picked':'')+'"><td><input type="checkbox" data-am-use="'+safe(row.cardId)+
    '" aria-label="Apply match for '+safe(row.cardName)+'" '+(checked?'checked ':'')+
    (!canSelect?'disabled':'')+'></td><td><strong>'+safe(row.cardName)+'</strong><div class="am-dim">'+safe(row.source)+'</div>'+
    (row.existing?'<div class="am-dim">Current: '+safe(row.existing)+'</div>':'')+'</td>'+
    '<td>'+image+'</td><td><div class="am-choice"><select data-am-choice="'+safe(row.cardId)+'" '+
    (row.status==='fixed'?'disabled':'')+'>'+choices+'</select><button data-am-browse="'+safe(row.cardId)+'" '+
    (row.status==='fixed'?'disabled':'')+'>Browse</button></div></td>'+
    '<td><span class="am-badge">'+safe(label)+'</span><div class="am-dim">'+
    safe(row.suggested?.reason||'')+'</div></td></tr>';
  }).join(''):'<tr><td colspan="5" style="padding:14px">No matching cards.</td></tr>';
  for(const row of shown){
   const choice=chosen(row);
   const chooser=[...root.querySelectorAll<HTMLSelectElement>('[data-am-choice]')]
    .find(el=>el.dataset.amChoice===row.cardId);
   if(chooser)chooser.value=choice?.key||'';
   const thumb=[...root.querySelectorAll<HTMLImageElement>('[data-am-preview]')]
    .find(el=>el.dataset.amPreview===row.cardId);
   if(thumb&&choice)thumb.src=choice.data;
  }
  pageInfo.textContent='Page '+(page+1)+' of '+pages+' · '+filtered.length+' shown';
  root.querySelector<HTMLButtonElement>('[data-am="prev"]')!.disabled=page===0;
  root.querySelector<HTMLButtonElement>('[data-am="next"]')!.disabled=page>=pages-1;
  root.querySelector<HTMLButtonElement>('[data-am="apply"]')!.disabled=!selected.size;
 }
 function close(){if(holder.querySelector('#artMatch')===root)holder.innerHTML='';}
 function openGallery(cardId:string){
  galleryCardId=cardId;gallery.hidden=false;gallerySearch.value='';paintGallery();gallerySearch.focus();
 }
 function paintGallery(){
  const searchText=gallerySearch.value.toLocaleLowerCase().trim();
  const filtered=imageChoices(imageSetId||undefined).filter(image=>
   !searchText||(image.name+' '+image.setName).toLocaleLowerCase().includes(searchText));
  const visible=filtered.slice(0,100);
  galleryGrid.innerHTML=visible.map((image,i)=>
   '<button type="button" data-am-pick="'+safe(image.key)+'"><img alt="" data-am-gallery-index="'+i+'"><small>'+
   safe(image.setName+' / '+image.name)+'</small></button>').join('')+
   (filtered.length>visible.length?'<p>Showing first 100 matches. Type to narrow the image list.</p>':'');
  root.querySelectorAll<HTMLImageElement>('[data-am-gallery-index]').forEach(el=>{
   const item=visible[Number(el.dataset.amGalleryIndex)];
   if(item)el.src=item.data;
  });
 }
 function closeGallery(){gallery.hidden=true;galleryCardId=null;}
 root.addEventListener('change',event=>{
  const el=event.target as HTMLInputElement|HTMLSelectElement;
  if(el.id==='amSet'){setId=el.value;setMenus();resetPreview();}
  else if(el.id==='amTarget'){targetId=el.value;resetPreview();}
  else if(el.id==='amSource'){sourceId=el.value;resetPreview();}
  else if(el.id==='amSourceSet'){imageSetId=el.value;resetPreview();}
  else if(el.id==='amImportSet'){importSetId=el.value;}
  else if(el.id==='amOverwrite'&&el instanceof HTMLInputElement){overwrite=el.checked;resetPreview();}
  else if(el.id==='amFilter'){filter=el.value;page=0;render();}
  else if(el.dataset.amUse!==undefined&&el instanceof HTMLInputElement){
   if(el.checked)selected.add(el.dataset.amUse);else selected.delete(el.dataset.amUse);
   render();
  }else if(el.dataset.amChoice!==undefined){
   const key=el.value,id=el.dataset.amChoice;
   if(key){manual.set(id,key);selected.add(id);}
   else{manual.delete(id);selected.delete(id);}
   render();
  }
 });
 search.addEventListener('input',()=>{query=search.value;page=0;render();});
 gallerySearch.addEventListener('input',paintGallery);
 root.addEventListener('click',event=>{
  const el=(event.target as HTMLElement).closest<HTMLElement>('[data-am],[data-am-browse],[data-am-pick]');
  if(!el)return;
  const picked=el.dataset.amPick;
  if(picked!==undefined&&galleryCardId){
   const image=findChoice(picked),row=rows.find(r=>r.cardId===galleryCardId);
   if(image&&row&&row.status!=='fixed'){
    manual.set(galleryCardId,picked);
    if(overwrite||!row.existing.trim()||row.existing===image.setName+'/'+image.name)selected.add(galleryCardId);
    closeGallery();render();
   }
   return;
  }
  const browse=el.dataset.amBrowse;
  if(browse!==undefined){openGallery(browse);return;}
  const action=el.dataset.am;
  if(action==='gallery-close'){closeGallery();return;}
  if(action==='close'){close();return;}
  if(action==='prev'||action==='next'){page+=action==='prev'?-1:1;render();return;}
  if(action==='files'){(root.querySelector('#amFiles') as HTMLInputElement).click();return;}
  if(action==='folder'){(root.querySelector('#amFolder') as HTMLInputElement).click();return;}
  if(action==='new-set'){
   const name=prompt('New image set name','Artwork')?.trim();
   if(!name)return;
   if(S.sets.some(set=>set.name.toLocaleLowerCase()===name.toLocaleLowerCase())){
    notice.textContent='An image set with that name already exists.';return;
   }
   const id=uid();S.sets.push({id,name,images:[]});importSetId=id;
   checkpoint();imageSetMenus();repaint();notice.textContent='Created image set "'+name+'".';
   return;
  }
  if(action==='apply'){
   try{
    const changes=[...selected].map(cardId=>({
     cardId,imageKey:manual.get(cardId)||rows.find(row=>row.cardId===cardId)?.suggested?.key||''
    })).filter(item=>!!item.imageKey);
    const changed=applyArtwork({setId,targetId,sourceId,imageSetId:imageSetId||undefined,overwrite},changes);
    if(changed){checkpoint();repaint();}
    notice.textContent='Applied '+changed+' assignment(s). '+(changed?'Save your project to keep the changes.':'No changes were necessary.');
    selected.clear();manual.clear();buildPreview();
   }catch(error){notice.textContent='Nothing changed: '+(error as Error).message;}
  }
 });
 async function addFiles(input:HTMLInputElement){
  const files=Array.from(input.files||[]);
  input.value='';
  if(!files.length)return;
  const destination=S.sets.find(set=>set.id===importSetId);
  if(!destination){notice.textContent='Choose or create an image set before importing.';return;}
  const before=destination.images.length;
  setTargetImageSet(destination.id);
  await importImages(files);
  imageSetMenus();resetPreview();
  notice.textContent='Imported '+(destination.images.length-before)+' image(s) into '+destination.name+
   '. Duplicate filenames are skipped.';
 }
 root.querySelector<HTMLInputElement>('#amFiles')!.addEventListener('change',event=>
  void addFiles(event.target as HTMLInputElement));
 root.querySelector<HTMLInputElement>('#amFolder')!.addEventListener('change',event=>
  void addFiles(event.target as HTMLInputElement));
 root.addEventListener('dragover',event=>{if((event as DragEvent).dataTransfer?.types.includes('Files'))event.preventDefault();});
 root.addEventListener('drop',event=>{
  const dt=(event as DragEvent).dataTransfer;
  if(!dt?.files?.length)return;
  event.preventDefault();
  // Reuse the same library import pathway as selecting files.
  const dest=S.sets.find(set=>set.id===importSetId);
  if(!dest){notice.textContent='Choose an image set before dropping files.';return;}
  const before=dest.images.length;
  setTargetImageSet(dest.id);
  void importImages(Array.from(dt.files)).then(()=>{
   imageSetMenus();resetPreview();
   notice.textContent='Imported '+(dest.images.length-before)+' dropped image(s).';
  });
 });
 root.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(!gallery.hidden)closeGallery();else close();
  event.preventDefault();event.stopPropagation();
 });
 setMenus();imageSetMenus();buildPreview();
}
