import {S,templateEl,effective,sizePx,clamp} from './model';
import { $ } from './dom';
import {renderStage} from './preview';
import {renderInspector,renderLeft,patchElement} from './interface';
import {elementGeometry} from './anchor-layout';
import {resizedRect,locksImageCornerAspect} from './resize';
type P={x:number;y:number};
type Drag={id:string;handle:string|null;start:P;x:number;y:number;w:number;h:number;locked:boolean;lockAspect:boolean;moved:boolean};
const points=new Map<number,P>();
let drag:Drag|null=null,pan:{start:P;left:number;top:number}|null=null,pinchDistance=0,pinchZoom=1,hadPinch=false;
const mobile=()=>document.documentElement.dataset.layout==='mobile';
const p=(e:PointerEvent):P=>({x:e.clientX,y:e.clientY});
const dist=(a:P,b:P)=>Math.hypot(a.x-b.x,a.y-b.y);
const middle=(a:P,b:P):P=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export function installMobileGestures(refresh:()=>void,manualZoom:()=>void){
 const outer=$('#canvasOuter') as HTMLElement,stage=$('#stage') as HTMLElement;
 const repaintSelection=()=>{renderInspector();renderLeft();renderStage();refresh()};
 const zoomAt=(zoom:number,c:P)=>{
  const before=stage.getBoundingClientRect(),fx=(c.x-before.left)/S.zoom,fy=(c.y-before.top)/S.zoom;
  S.zoom=clamp(zoom,.3,3);renderStage();
  const after=stage.getBoundingClientRect();
  outer.scrollLeft+=after.left+fx*S.zoom-c.x;
  outer.scrollTop+=after.top+fy*S.zoom-c.y;
 };
 outer.addEventListener('pointerdown',(e:PointerEvent)=>{
  if(!mobile()||e.pointerType!=='touch')return;
  e.preventDefault();try{outer.setPointerCapture(e.pointerId)}catch{}
  points.set(e.pointerId,p(e));
  if(points.size>=2){drag=null;pan=null;const pair=[...points.values()];pinchDistance=dist(pair[0],pair[1]);pinchZoom=S.zoom;hadPinch=true;return}
  hadPinch=false;
  const target=e.target as HTMLElement;
  const element=target.closest('.element') as HTMLElement|null;
  const raw=element?templateEl(element.dataset.id||null):null;
  if(raw){
   const g=elementGeometry(raw),el=effective(raw),handle=(target.closest('[data-handle]') as HTMLElement|null)?.dataset.handle||null;
   S.selected=raw.id;
   drag={id:raw.id,handle,start:p(e),x:g.x,y:g.y,w:g.w,h:g.h,locked:el.locked,lockAspect:locksImageCornerAspect(el.kind,el.imageFit,handle),moved:false};
   pan=null;repaintSelection();
  }else{
   if(S.selected!==null){S.selected=null;repaintSelection()}
   drag=null;pan={start:p(e),left:outer.scrollLeft,top:outer.scrollTop};
  }
 },{capture:true});
 document.addEventListener('pointermove',(e:PointerEvent)=>{
  if(!mobile()||e.pointerType!=='touch'||!points.has(e.pointerId))return;
  e.preventDefault();points.set(e.pointerId,p(e));
  if(points.size>=2){const pair=[...points.values()];if(pinchDistance>0){zoomAt(pinchZoom*dist(pair[0],pair[1])/pinchDistance,middle(pair[0],pair[1]));manualZoom()}return}
  if(hadPinch)return;
  if(pan){outer.scrollLeft=pan.left+pan.start.x-e.clientX;outer.scrollTop=pan.top+pan.start.y-e.clientY;return}
  if(!drag||drag.locked)return;
  const dx=(e.clientX-drag.start.x)/S.zoom,dy=(e.clientY-drag.start.y)/S.zoom;
  if(!drag.moved&&Math.hypot(e.clientX-drag.start.x,e.clientY-drag.start.y)<7)return;
  drag.moved=true;let patch:any;
  if(drag.handle){
   const {w,h}=sizePx(),r=resizedRect({x:drag.x,y:drag.y,w:drag.w,h:drag.h},drag.handle,dx,dy,{w,h},drag.lockAspect);
   patch={};
   if(drag.handle.includes('w')||drag.handle.includes('e'))Object.assign(patch,{x:r.x,w:r.w,autoWidth:false});
   if(drag.handle.includes('n')||drag.handle.includes('s'))Object.assign(patch,{y:r.y,h:r.h,autoHeight:false});
  }else{const {w,h}=sizePx();patch={x:Math.round(clamp(drag.x+dx,-drag.w+4,w-4)),y:Math.round(clamp(drag.y+dy,-drag.h+4,h-4))}}
  patchElement(drag.id,patch);renderStage();
 },{capture:true});
 const end=(e:PointerEvent)=>{
  if(e.pointerType!=='touch'||!points.has(e.pointerId))return;
  points.delete(e.pointerId);if(points.size<2)pinchDistance=0;
  if(!points.size){const changed=!!drag?.moved||hadPinch;drag=null;pan=null;hadPinch=false;if(changed)repaintSelection();else refresh()}
  else{drag=null;pan=null;hadPinch=true}
 };
 document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
}
