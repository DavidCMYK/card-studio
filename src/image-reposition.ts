/** Temporary editing mode; never saved in project JSON or undo history. */
import {S,templateEl} from './model';
import type {CardElement,StudioProject} from './types';
import {imgBox} from './image-sets';
type Session={id:string;project:StudioProject;mode:'template'|'cards';cardIndex:number};
let session:Session|null=null;
export function enterImageReposition(id:string):boolean{
 if(S.selected!==id||templateEl(id)?.kind!=='image')return false;
 session={id,project:S,mode:S.mode,cardIndex:S.cardIndex};return true;
}
export function stopImageReposition():void{session=null}
export function repositionImageId():string|null{
 if(!session||session.project!==S||session.id!==S.selected||session.mode!==S.mode||
  session.cardIndex!==S.cardIndex||templateEl(session.id)?.kind!=='image')return null;
 return session.id;
}
/** Pointer motion in card coordinates -> stored, pre-rotation/flip image offsets. */
export function screenToImageDelta(e:CardElement,dx:number,dy:number){
 const angle=(Number(e.imgRotation)||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return {x:(dx*c+dy*s)*(e.imgFlipX===true?-1:1),
  y:(dy*c-dx*s)*(e.imgFlipY===true?-1:1)};
}
export function imageDragPatch(e:CardElement,dx:number,dy:number){
 const d=screenToImageDelta(e,dx,dy);
 return {imgOffsetX:(Number(e.imgOffsetX)||0)+d.x,imgOffsetY:(Number(e.imgOffsetY)||0)+d.y};
}
/** Keep the image pixel beneath frame-local point fixed while changing zoom. */
export function imageZoomPatch(e:CardElement,img:any,requestedZoom:number,point:{x:number;y:number}){
 const oldZoom=Math.max(.05,Math.min(20,Number(e.imgZoom)||1));
 const zoom=Math.max(.05,Math.min(20,requestedZoom));
 if(zoom===oldZoom)return {imgZoom:zoom,imgOffsetX:Number(e.imgOffsetX)||0,imgOffsetY:Number(e.imgOffsetY)||0};
 const centre={x:e.w/2,y:e.h/2},delta=screenToImageDelta(e,point.x-centre.x,point.y-centre.y);
 const focus={x:centre.x+delta.x,y:centre.y+delta.y};
 const before=imgBox(e,img),after=imgBox({...e,imgZoom:zoom},img);
 const fx=(focus.x-before.x)/before.w,fy=(focus.y-before.y)/before.h;
 return {imgZoom:zoom,
  imgOffsetX:(Number(e.imgOffsetX)||0)+focus.x-(after.x+fx*after.w),
  imgOffsetY:(Number(e.imgOffsetY)||0)+focus.y-(after.y+fy*after.h)};
}
