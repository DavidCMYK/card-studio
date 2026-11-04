import {S,templateEl,effective,sizePx,clamp} from './model';
import type {CardElement} from './types';
import {$} from './dom';
import {renderStage} from './preview';
import {renderInspector,renderLeft,patchElement,refreshHistoryButtons} from './interface';
import {checkpoint} from './history';
import {elementGeometry} from './anchor-layout';
import {getImageData,cacheImage,imageScreenOffset,imageOffsetPatch} from './image-sets';
import {enterImageReposition,stopImageReposition,repositionImageId,imageDragPatch,imageScalePatch} from './image-reposition';
import {resizedRect,locksImageCornerAspect,ResizeHandle} from './resize';
type P={x:number;y:number};
type Drag={id:string;kind:'frame'|'image';handle:ResizeHandle|null;start:P;x:number;y:number;w:number;h:number;locked:boolean;lockAspect:boolean;moved:boolean;startElement:CardElement};
type ImagePinch={id:string;start:CardElement;focal:P;center:P;image:any};
const points=new Map<number,P>();
let drag:Drag|null=null,pan:{start:P;left:number;top:number}|null=null,pinchDistance=0,pinchZoom=1,hadPinch=false;
let imagePinch:ImagePinch|null=null;
let pinchFocal:P={x:0,y:0};
let touchCandidate:{id:string;point:P}|null=null;
let lastTap:{id:string;point:P;time:number}|null=null;
const mobile=()=>document.documentElement.dataset.layout==='mobile';
const p=(e:PointerEvent):P=>({x:e.clientX,y:e.clientY});
const dist=(a:P,b:P)=>Math.hypot(a.x-b.x,a.y-b.y);
const middle=(a:P,b:P):P=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export function installMobileGestures(refresh:()=>void,manualZoom:()=>void){
 const outer=$('#canvasOuter') as HTMLElement,stage=$('#stage') as HTMLElement;
 const repaintSelection=()=>{renderInspector();renderLeft();renderStage();refresh()};
 const zoomPinch=(zoom:number,center:P)=>{
  S.zoom=clamp(zoom,.3,3);renderStage();
  const after=stage.getBoundingClientRect();
  outer.scrollLeft+=after.left+pinchFocal.x*S.zoom-center.x;
  outer.scrollTop+=after.top+pinchFocal.y*S.zoom-center.y;
 };
 outer.addEventListener('pointerdown',(e:PointerEvent)=>{
  if(!mobile()||e.pointerType!=='touch')return;
  e.preventDefault();try{outer.setPointerCapture(e.pointerId)}catch{}
  points.set(e.pointerId,p(e));
  const target=e.target as HTMLElement;
  const element=target.closest('.element') as HTMLElement|null;
  if(points.size>=2){
   const pair=[...points.values()];pinchDistance=dist(pair[0],pair[1]);pinchZoom=S.zoom;
   const center=middle(pair[0],pair[1]),rect=stage.getBoundingClientRect();
   pinchFocal={x:(center.x-rect.left)/S.zoom,y:(center.y-rect.top)/S.zoom};
   const id=repositionImageId(),raw=id?templateEl(id):null;
   imagePinch=null;
   if(raw&&element?.dataset.id===id&&drag?.kind==='image'&&drag.id===id){
    const frame=elementGeometry(raw),start={...effective(raw),...frame};
    const src=getImageData(raw,S.cardIndex,S.mode),cached=cacheImage(src);
    imagePinch={id,start,focal:{x:pinchFocal.x-frame.x,y:pinchFocal.y-frame.y},
     center,image:cached?.loaded?cached.im:null};
   }
   drag=null;pan=null;touchCandidate=null;lastTap=null;hadPinch=true;return;
  }
  hadPinch=false;imagePinch=null;
  const raw=element?templateEl(element.dataset.id||null):null;
  touchCandidate=raw?{id:raw.id,point:p(e)}:null;
  if(raw){
   if(repositionImageId()&&repositionImageId()!==raw.id)stopImageReposition();
   const wasSelected=S.selected===raw.id;
   const g=elementGeometry(raw),el=effective(raw);
   const isImage=repositionImageId()===raw.id&&raw.kind==='image';
   const handle=isImage?null:(target.closest('[data-handle]') as HTMLElement|null)?.dataset.handle as ResizeHandle || null;
   S.selected=raw.id;
   drag={id:raw.id,kind:isImage?'image':'frame',handle,start:p(e),x:g.x,y:g.y,w:g.w,h:g.h,
    locked:el.locked,lockAspect:locksImageCornerAspect(el.kind,el.imageFit,handle),
    startElement:{...el,...g},moved:false};
   pan=wasSelected?null:{start:p(e),left:outer.scrollLeft,top:outer.scrollTop};
   if(!wasSelected)drag=null;
   repaintSelection();
  }else{
   if(S.selected!==null||repositionImageId()){stopImageReposition();S.selected=null;repaintSelection()}
   drag=null;pan={start:p(e),left:outer.scrollLeft,top:outer.scrollTop};
  }
 },{capture:true});
 document.addEventListener('pointermove',(e:PointerEvent)=>{
  if(!mobile()||e.pointerType!=='touch'||!points.has(e.pointerId))return;
  e.preventDefault();points.set(e.pointerId,p(e));
  if(points.size>=2){
   const pair=[...points.values()],center=middle(pair[0],pair[1]);
   if(pinchDistance>0){
    if(imagePinch&&repositionImageId()===imagePinch.id){
     const pinch=imagePinch;
     const dx=(center.x-pinch.center.x)/S.zoom,dy=(center.y-pinch.center.y)/S.zoom;
     if(pinch.start.imageFit==='free'){
      const ratio=dist(pair[0],pair[1])/pinchDistance;
      const scaled=imageScalePatch(pinch.start,pinch.image,(Number(pinch.start.imgScale)||1)*ratio,pinch.focal);
      const next={...pinch.start,...scaled};
      const shifted=imageScreenOffset(next,pinch.image);
      patchElement(pinch.id,{...scaled,...imageOffsetPatch(next,shifted.x+dx,shifted.y+dy,pinch.image)});
     }else patchElement(pinch.id,imageDragPatch(pinch.start,dx,dy,pinch.image));
     renderStage();
    }else{zoomPinch(pinchZoom*dist(pair[0],pair[1])/pinchDistance,center);manualZoom()}
   }
   return;
  }
  if(hadPinch)return;
  if(pan){outer.scrollLeft=pan.left+pan.start.x-e.clientX;outer.scrollTop=pan.top+pan.start.y-e.clientY;return}
  if(!drag||(drag.locked&&drag.kind==='frame'))return;
  const dx=(e.clientX-drag.start.x)/S.zoom,dy=(e.clientY-drag.start.y)/S.zoom;
  if(!drag.moved&&Math.hypot(e.clientX-drag.start.x,e.clientY-drag.start.y)<7)return;
  drag.moved=true;let patch:any;
  if(drag.kind==='image'){const raw=templateEl(drag.id),src=raw?getImageData(raw,S.cardIndex,S.mode):null,cached=src?cacheImage(src):null;patch=imageDragPatch(drag.startElement,dx,dy,cached?.loaded?cached.im:null)}
  else if(drag.handle){
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
  if(!points.size){
   const changed=!!drag?.moved||hadPinch,candidate=touchCandidate;
   if(!changed&&candidate){
    const now=Date.now();
    if(lastTap?.id===candidate.id&&now-lastTap.time<380&&dist(lastTap.point,candidate.point)<25){
     const raw=templateEl(candidate.id);
     if(raw?.kind==='image'&&S.selected===raw.id&&enterImageReposition(raw.id))repaintSelection();
     lastTap=null;
    }else lastTap={id:candidate.id,point:candidate.point,time:now};
   }else if(changed)lastTap=null;
   drag=null;pan=null;hadPinch=false;imagePinch=null;touchCandidate=null;
   if(changed){checkpoint();refreshHistoryButtons();repaintSelection()}else refresh();
  }else{drag=null;pan=null;hadPinch=true;touchCandidate=null;imagePinch=null}
 };
 document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
}
