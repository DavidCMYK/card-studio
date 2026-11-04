import type {StudioProject,Units} from './types';
import {initial,px,unitFactor} from './model';
import {DEFAULT_GUIDES,guideRects,validateGuides,distanceMm,distanceInUnit} from './card-guides';
/** New project creation makes the definition of canvas dimensions explicit. */
export function openNewProjectDialog(onCreate:(project:StudioProject)=>void){
 const holder=document.querySelector('#dialogHolder') as HTMLElement|null;
 if(!holder)return;
 holder.innerHTML=`<div class="dialog-backdrop" id="newProjectDialog">
  <form class="dialog" style="width:min(530px,95vw);max-height:92vh;overflow:auto">
   <h3>New card project</h3>
   <p>Choose whether canvas dimensions represent the finished card or include printing bleed. All measurements can be changed later in Card Setup.</p>
   <div class="field"><label>Project name</label><input name="projectName" value="Untitled deck" required></div>
   <div class="field"><label>Canvas dimensions mean</label><select name="mode">
    <option value="trim">Finished card — no bleed in canvas</option>
    <option value="bleed">Full artwork — canvas includes bleed</option>
   </select></div>
   <div class="fields-two"><div class="field"><label>Units</label><select name="unit"><option value="mm">Millimetres</option><option value="in">Inches</option><option value="px">Pixels</option></select></div>
    <div class="field"><label>Resolution</label><select name="dpi"><option value="300">300 DPI</option><option value="150">150 DPI</option><option value="450">450 DPI</option><option value="600">600 DPI</option></select></div></div>
   <div class="fields-two"><div class="field"><label>Canvas width</label><input name="width" type="number" step="any" min="0.01" value="63" required></div>
    <div class="field"><label>Canvas height</label><input name="height" type="number" step="any" min="0.01" value="88" required></div></div>
   <div class="fields-two"><div class="field"><label>Bleed per side</label><input name="bleed" type="number" step="any" min="0" value="3" required></div>
    <div class="field"><label>Safe inset from trim</label><input name="safe" type="number" step="any" min="0" value="4" required></div></div>
   <div id="newProjectDimensions" class="small" style="padding:8px 0"></div>
   <div id="newProjectError" style="color:#bd293a;font-size:12px"></div>
   <p>Unsaved changes in the current project will be lost when you create a new one.</p>
   <div class="footer"><button type="button" data-new-project="cancel">Cancel</button><button class="primary" type="submit">Create project</button></div>
  </form></div>`;
 const root=holder.querySelector('#newProjectDialog') as HTMLElement;
 const form=root.querySelector('form') as HTMLFormElement;
 const input=(name:string)=>form.elements.namedItem(name) as HTMLInputElement;
 const select=(name:string)=>form.elements.namedItem(name) as HTMLSelectElement;
 const values=()=>({width:Number(input('width').value),height:Number(input('height').value),
  bleed:Number(input('bleed').value),safe:Number(input('safe').value),unit:select('unit').value as Units,
  dpi:Number(select('dpi').value),mode:select('mode').value as 'trim'|'bleed'});
 function refresh(){
  const v=values(),mm=distanceMm(1,v.unit,v.dpi),b=v.mode==='bleed'?2*v.bleed:0;
  const trimW=v.width-b,trimH=v.height-b;
  const display=root.querySelector('#newProjectDimensions') as HTMLElement;
  const error=root.querySelector('#newProjectError') as HTMLElement;
  display.textContent='Canvas: '+v.width+' × '+v.height+' '+v.unit+' · Finished card: '+
   Number(trimW.toFixed(5))+' × '+Number(trimH.toFixed(5))+' '+v.unit+
   (v.mode==='bleed'?' · red trim line inside canvas':' · canvas edge is trim');
  error.textContent=!Number.isFinite(mm)||trimW<=0||trimH<=0?'Bleed must leave a positive finished card.':
   trimW<=2*v.safe||trimH<=2*v.safe?'Safe insets must leave an interior area.':'';
 }
 let old=values();
 form.addEventListener('change',e=>{
  const target=e.target as HTMLInputElement;
  if(target.name==='unit'||target.name==='dpi'){
   const next=values(),oldMm=distanceMm(1,old.unit,old.dpi),newMm=distanceMm(1,next.unit,next.dpi);
   for(const k of ['width','height','bleed','safe'] as const){
    const source=k==='width'?old.width:k==='height'?old.height:k==='bleed'?old.bleed:old.safe;
    input(k).value=String(Number((source*oldMm/newMm).toFixed(8)));
   }
  }else if(target.name==='mode'){
   const v=values(),delta=2*v.bleed*(v.mode==='bleed'?1:-1);
   input('width').value=String(Number((v.width+delta).toFixed(8)));
   input('height').value=String(Number((v.height+delta).toFixed(8)));
  }
  old=values();refresh();
 });
 form.addEventListener('input',refresh);
 root.querySelector('[data-new-project="cancel"]')?.addEventListener('click',()=>{holder.innerHTML='';});
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const v=values(),error=root.querySelector('#newProjectError') as HTMLElement;
  if(error.textContent||!Number.isFinite(v.width)||!Number.isFinite(v.height)||v.width<=0||v.height<=0)return;
  const project=initial();
  project.projectName=input('projectName').value.trim()||'Untitled deck';
  const t=project.template;
  t.unit=v.unit;t.dpi=v.dpi;t.width=v.width;t.height=v.height;
  const bleedMm=distanceMm(v.bleed,v.unit,v.dpi),safeMm=distanceMm(v.safe,v.unit,v.dpi);
  t.guides={...structuredClone(DEFAULT_GUIDES),unit:v.unit,bleedMode:v.mode,
   bleed:{top:bleedMm,right:bleedMm,bottom:bleedMm,left:bleedMm},
   safe:{top:safeMm,right:safeMm,bottom:safeMm,left:safeMm}};
  try{validateGuides(t)}catch(err){error.textContent=(err as Error).message;return;}
  const r=guideRects(t),baseW=px(63,'mm'),baseH=px(88,'mm');
  const x0=r.trim.x*96/25.4,y0=r.trim.y*96/25.4;
  const innerW=r.trim.w*96/25.4,innerH=r.trim.h*96/25.4;
  const outerW=r.canvas.width*96/25.4,outerH=r.canvas.height*96/25.4;
  for(const el of t.elements){
   if(Math.abs(el.x)<.01&&Math.abs(el.y)<.01&&Math.abs(el.w-baseW)<.01&&Math.abs(el.h-baseH)<.01){
    el.x=0;el.y=0;el.w=outerW;el.h=outerH;
   }else{
    el.x=x0+el.x*innerW/baseW;el.y=y0+el.y*innerH/baseH;
    el.w*=innerW/baseW;el.h*=innerH/baseH;
   }
  }
  holder.innerHTML='';onCreate(project);
 });
 refresh();
}