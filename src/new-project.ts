import type {StudioProject,Units,CardTemplate} from './types';
import {initial,px} from './model';
import {
 guidesFor,guideRects,validateGuides,canvasDimensionsMm,trimDimensionsMm,safeDimensionsMm,
 distanceMm,displayedDistance,changeBleedMode,setGuideDistance,setCutDimension,
 setCanvasDimension,setSafeZoneDimension,setGuideLinked,setGuideCornerRadius
} from './card-guides';

/** New projects use the same cut/canvas/bleed/safe-size invariants as Card Setup.
 * No user artwork is modified by editing these controls. */
export function openNewProjectDialog(onCreate:(project:StudioProject)=>void){
 const holder=document.querySelector('#dialogHolder') as HTMLElement|null;
 if(!holder)return;
 holder.innerHTML=`<div class="dialog-backdrop" id="newProjectDialog">
  <form class="dialog" style="width:min(570px,95vw);max-height:93vh;overflow:auto">
   <h3>New card project</h3>
   <p>Finished cut size is the reference: canvas = cut + bleed, and safe zone = cut minus safety buffers. The canvas edge is the artwork edge.</p>
   <div class="field"><label>Project name</label><input name="projectName" value="Untitled deck" required></div>
   <div class="field"><label>Artwork canvas</label><select name="mode">
    <option value="trim">Canvas edge is finished cut (no bleed)</option>
    <option value="bleed">Canvas includes printing bleed</option>
   </select></div>
   <div class="fields-two"><div class="field"><label>Units</label><select name="unit">
    <option value="mm">Millimetres</option><option value="in">Inches</option><option value="px">Pixels at DPI</option></select></div>
    <div class="field"><label>Resolution</label><select name="dpi">
     <option value="300">300 DPI</option><option value="150">150 DPI</option><option value="450">450 DPI</option><option value="600">600 DPI</option></select></div></div>
   <div class="section-title">Finished cut size</div>
   <div class="fields-two"><div class="field"><label>Cut width</label><input name="cutWidth" type="number" min="0.01" step="any" required></div>
    <div class="field"><label>Cut height</label><input name="cutHeight" type="number" min="0.01" step="any" required></div></div>
   <div class="section-title">Canvas size (including bleed)</div>
   <div class="fields-two"><div class="field"><label>Canvas width</label><input name="width" type="number" min="0.01" step="any" required></div>
    <div class="field"><label>Canvas height</label><input name="height" type="number" min="0.01" step="any" required></div></div>
   <div class="small">Changing canvas size adjusts bleed, not cut size. Canvas cannot be smaller than cut.</div>
   <div class="section-title">Bleed</div>
   <label class="toggle-line"><input type="checkbox" name="bleedLinked" checked> Same bleed on every side</label>
   <div class="fields-two">
    <div class="field"><label>Left</label><input type="number" name="bleedLeft" min="0" step="any"></div>
    <div class="field"><label>Right</label><input type="number" name="bleedRight" min="0" step="any"></div>
    <div class="field"><label>Top</label><input type="number" name="bleedTop" min="0" step="any"></div>
    <div class="field"><label>Bottom</label><input type="number" name="bleedBottom" min="0" step="any"></div></div>
   <div class="section-title">Safe zone</div>
   <div class="fields-two"><div class="field"><label>Safe width</label><input type="number" name="safeWidth" min="0.01" step="any"></div>
    <div class="field"><label>Safe height</label><input type="number" name="safeHeight" min="0.01" step="any"></div></div>
   <label class="toggle-line"><input type="checkbox" name="safeLinked" checked> Same safety buffer on every side</label>
   <div class="fields-two">
    <div class="field"><label>Left buffer</label><input type="number" name="safeLeft" min="0" step="any"></div>
    <div class="field"><label>Right buffer</label><input type="number" name="safeRight" min="0" step="any"></div>
    <div class="field"><label>Top buffer</label><input type="number" name="safeTop" min="0" step="any"></div>
    <div class="field"><label>Bottom buffer</label><input type="number" name="safeBottom" min="0" step="any"></div></div>
   <div class="section-title">Guide corner rounding</div>
   <div class="fields-two">
    <div class="field"><label>Cut line radius</label><input type="number" name="radiusCut" min="0" step="any"></div>
    <div class="field"><label>Safe-zone radius</label><input type="number" name="radiusSafe" min="0" step="any"></div>
   </div>
   <div class="small">In selected units. Rounded guides do not crop the exported artwork.</div>
   <div class="small" id="newProjectDimensions" aria-live="polite" style="padding:8px 0"></div>
   <div id="newProjectError" role="alert" style="color:#bd293a;font-size:12px"></div>
   <p>Creating this project replaces the current unsaved workspace. Your saved project files are not overwritten.</p>
   <div class="footer"><button type="button" data-new-project="cancel">Cancel</button><button class="primary" type="submit">Create project</button></div>
  </form></div>`;
 const root=holder.querySelector('#newProjectDialog') as HTMLElement;
 const form=root.querySelector('form') as HTMLFormElement;
 const element=(name:string)=>form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement;
 const numberValue=(name:string)=>Number(element(name).value);
 // Fresh draft: manipulating geometry never touches an open project.
 let draft:CardTemplate=structuredClone(initial().template);
 const edgeMap={Left:'left',Right:'right',Top:'top',Bottom:'bottom'} as const;
 const err=root.querySelector('#newProjectError') as HTMLElement;
 function apply(target:HTMLInputElement|HTMLSelectElement){
  const name=target.name,value=target.value;
  if(name==='projectName')return;
  const prior=structuredClone(draft);
  try{
   if(name==='unit'||name==='dpi'){
    const before=canvasDimensionsMm(draft);
    if(name==='unit'){
     if(!['mm','in','px'].includes(value))throw Error('Unsupported unit');
     draft.unit=value as Units;
    }else{
     const dpi=Number(value);
     if(!Number.isFinite(dpi)||dpi<=0)throw Error('Resolution must be positive');
     draft.dpi=dpi;
    }
    draft.width=before.width/distanceMm(1,draft.unit,draft.dpi);
    draft.height=before.height/distanceMm(1,draft.unit,draft.dpi);
    draft.guides={...guidesFor(draft),unit:draft.unit};
    validateGuides(draft);
   }else if(name==='mode')changeBleedMode(draft,[],value as 'bleed'|'trim');
   else if(name==='cutWidth')setCutDimension(draft,'width',numberValue(name));
   else if(name==='cutHeight')setCutDimension(draft,'height',numberValue(name));
   else if(name==='width')setCanvasDimension(draft,'width',numberValue(name));
   else if(name==='height')setCanvasDimension(draft,'height',numberValue(name));
   else if(name==='safeWidth')setSafeZoneDimension(draft,'width',numberValue(name));
   else if(name==='safeHeight')setSafeZoneDimension(draft,'height',numberValue(name));
   else if(['radiusCut','radiusSafe'].includes(name)){
    const boundary=name==='radiusCut'?'cut':'safe';
    setGuideCornerRadius(draft,boundary,distanceMm(numberValue(name),draft.unit,draft.dpi));
   }
   else if(name==='bleedLinked'||name==='safeLinked')setGuideLinked(draft,name==='bleedLinked'?'bleed':'safe',(target as HTMLInputElement).checked);
   else {
    const match=/^(bleed|safe)(Left|Right|Top|Bottom)$/.exec(name);
    if(match)setGuideDistance(draft,[],match[1] as 'bleed'|'safe',edgeMap[match[2] as keyof typeof edgeMap],distanceMm(numberValue(name),draft.unit,draft.dpi));
   }
   err.textContent='';
  }catch(e){draft=prior;err.textContent=(e as Error).message;}
  updateFields(target);
 }
 function updateFields(active?:HTMLInputElement|HTMLSelectElement){
  const g=guidesFor(draft),canvas=canvasDimensionsMm(draft),cut=trimDimensionsMm(draft),safe=safeDimensionsMm(draft);
  const d=(mm:number)=>displayedDistance(mm,draft.unit,draft.dpi);
  const fields:Record<string,string>={
   unit:draft.unit,dpi:String(draft.dpi),mode:g.bleedMode,
   width:d(canvas.width),height:d(canvas.height),cutWidth:d(cut.width),cutHeight:d(cut.height),
   safeWidth:d(safe.width),safeHeight:d(safe.height),
   radiusCut:d(g.radii!.cut),radiusSafe:d(g.radii!.safe),
   bleedLeft:d(g.bleed.left),bleedRight:d(g.bleed.right),bleedTop:d(g.bleed.top),bleedBottom:d(g.bleed.bottom),
   safeLeft:d(g.safe.left),safeRight:d(g.safe.right),safeTop:d(g.safe.top),safeBottom:d(g.safe.bottom)
  };
  for(const [name,val] of Object.entries(fields)){
   const input=element(name);
   if(input&&input!==active)input.value=val;
  }
  (element('bleedLinked') as HTMLInputElement).checked=g.bleedLinked;
  (element('safeLinked') as HTMLInputElement).checked=g.safeLinked;
  (root.querySelector('#newProjectDimensions') as HTMLElement).textContent=
   'Canvas '+fields.width+' × '+fields.height+' '+draft.unit+' · Cut '+fields.cutWidth+' × '+fields.cutHeight+
   ' '+draft.unit+' · Safe '+fields.safeWidth+' × '+fields.safeHeight+' '+draft.unit;
 }
 form.addEventListener('input',e=>apply(e.target as HTMLInputElement));
 form.addEventListener('change',e=>apply(e.target as HTMLInputElement));
 root.querySelector('[data-new-project="cancel"]')?.addEventListener('click',()=>{holder.innerHTML='';});
 form.addEventListener('submit',e=>{
  e.preventDefault();
  if(err.textContent)return;
  try{validateGuides(draft)}catch(e){err.textContent=(e as Error).message;return;}
  const project=initial(),t=project.template;
  const p=structuredClone(draft);
  t.unit=p.unit;t.dpi=p.dpi;t.width=p.width;t.height=p.height;t.guides=p.guides;
  project.projectName=String(element('projectName').value||'').trim()||'Untitled deck';
  // The initial example art is laid out against the finished card. This is
  // creation of a new project, not a transformation of existing user elements.
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
 updateFields();
}