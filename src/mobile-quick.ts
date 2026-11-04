import {S,templateEl,card} from './model';
import {patchElement,repaint} from './interface';

const selected=()=>S.selected?templateEl(S.selected):null;
function actionButton(label:string,command:string):HTMLButtonElement{
 const b=document.createElement('button');b.dataset.mobile=command;b.textContent=label;return b;
}
export function renderQuickEditor(list:HTMLElement):boolean{
 const el=selected();if(!el||!['text','image'].includes(el.kind))return false;
 list.replaceChildren();
 if(el.kind==='text'){
  const field=document.createElement('label');field.className='m-quick-label';
  field.textContent=S.mode==='cards'?'Text on this card':'Template default text';
  const area=document.createElement('textarea');area.id='mobileQuickText';area.rows=5;
  const value=S.mode==='cards'?card()?.values?.[el.id]:null;
  area.value=value===undefined||value===null?el.text:String(value);
  field.append(area);list.append(field);
  const done=actionButton('Apply text','apply-text');done.className='m-quick-primary';list.append(done);
  return true;
 }
 if(S.mode==='cards'&&el.autoMode==='single'){
  const p=document.createElement('p');p.className='m-quick-hint';
  p.textContent='This artwork is fixed in the shared template. Change it in Template mode to update all cards.';
  list.append(p);
  return true;
 }
 if(!S.sets.length){
  const p=document.createElement('p');p.className='m-quick-hint';p.textContent='No artwork loaded. Open Images and add an image set first.';
  list.append(p);
  return true;
 }
 list.append(actionButton('Leave this frame empty','clear-image'));
 for(const set of S.sets){
  const heading=document.createElement('h3');heading.className='m-quick-set';heading.textContent=set.name;list.append(heading);
  const gallery=document.createElement('div');gallery.className='m-art-grid';
  for(const im of set.images){
   const b=document.createElement('button');b.dataset.mobile='assign-image';b.dataset.set=set.id;b.dataset.image=im.name;b.className='m-art-option';b.title=im.name;
   const img=document.createElement('img');img.src=im.data;img.alt='';img.loading='lazy';
   const label=document.createElement('span');label.textContent=im.name;
   b.append(img,label);gallery.append(b);
  }
  list.append(gallery);
 }
 return true;
}

/** Returns true when the event was handled by a shared editor action. */
export function performQuickAction(command:string,button:HTMLElement):boolean{
 const el=selected();if(!el)return false;
 if(command==='apply-text'&&el.kind==='text'){
  const area=document.getElementById('mobileQuickText') as HTMLTextAreaElement|null;
  if(!area)return false;
  if(S.mode==='cards'){
   const c=card();if(!c)return false;
   c.values??={};c.values[el.id]=area.value;
  }else patchElement(el.id,{text:area.value});
 }else if(command==='assign-image'&&el.kind==='image'){
  const set=S.sets.find(x=>x.id===button.dataset.set),im=set?.images.find(x=>x.name===button.dataset.image);
  if(!set||!im)return false;
  if(S.mode==='cards'){
   if(el.autoMode==='single')return false;
   const c=card();if(!c)return false;c.values??={};c.values[el.id]=set.name+'/'+im.name;
  }else patchElement(el.id,{autoSet:set.id,autoMode:'single',singleImage:im.name});
 }else if(command==='clear-image'&&el.kind==='image'){
  if(S.mode==='cards'){
   if(el.autoMode==='single')return false;
   const c=card();if(!c)return false;c.values??={};c.values[el.id]='none';
  }else patchElement(el.id,{autoSet:'',singleImage:''});
 }else return false;
 repaint();
 return true;
}
