/** Temporary editing mode; never saved in project JSON or undo history. */
import {S,templateEl,effective} from './model';
import type {CardElement,StudioProject} from './types';
import {imgBox,imageScreenOffset,imageOffsetPatch,screenToImageDelta} from './image-sets';
export {screenToImageDelta} from './image-sets';
type Session={id:string;project:StudioProject;mode:'template'|'cards';cardIndex:number};
let session:Session|null=null;
export function canRepositionImage(e:CardElement):boolean{
 return e.kind==='image'&&e.imageFit!=='contain'&&e.imageFit!=='stretch';
}
export function enterImageReposition(id:string):boolean{
 const raw=templateEl(id);
 if(S.selected!==id||!raw||!canRepositionImage(effective(raw)))return false;
 session={id,project:S,mode:S.mode,cardIndex:S.cardIndex};return true;
}
export function stopImageReposition():void{session=null}
export function repositionImageId():string|null{
 if(!session)return null;
 if(session.project!==S||session.id!==S.selected||session.mode!==S.mode||
  session.cardIndex!==S.cardIndex||!templateEl(session.id)||
  !canRepositionImage(effective(templateEl(session.id)!))){
  session=null;return null;
 }
 return session.id;
}
/** Drag respects frame axes permitted by the active fit mode. */
export function imageDragPatch(e:CardElement,dx:number,dy:number,img:any=null){
 const before=imageScreenOffset(e,img);
 return imageOffsetPatch(e,before.x+dx,before.y+dy,img);
}
/** Mouse wheel and mobile pinch change the existing Free resize scale only. */
export function imageScalePatch(e:CardElement,img:any,requestedScale:number,point:{x:number;y:number}){
 if(e.imageFit!=='free')return {};
 const oldScale=Math.max(.01,Number(e.imgScale)||1);
 const scale=Math.max(.01,Math.min(100,requestedScale));
 if(scale===oldScale)return {imgScale:scale};
 const centre={x:e.w/2,y:e.h/2},delta=screenToImageDelta(e,point.x-centre.x,point.y-centre.y);
 const focus={x:centre.x+delta.x,y:centre.y+delta.y};
 const before=imgBox(e,img),after=imgBox({...e,imgScale:scale},img);
 const fx=(focus.x-before.x)/before.w,fy=(focus.y-before.y)/before.h;
 return {imgScale:scale,
  imgOffsetX:(Number(e.imgOffsetX)||0)+focus.x-(after.x+fx*after.w),
  imgOffsetY:(Number(e.imgOffsetY)||0)+focus.y-(after.y+fy*after.h)};
}
