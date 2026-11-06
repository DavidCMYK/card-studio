import { S } from './model';
/** The preview must not put megabytes of Base64 text back into stage.innerHTML
 * every time a card is selected. Keep one browser URL per decoded asset.
 * Export/save paths still use the original, lossless data URI in S.sets. */
class ImageCache extends Map<string,any>{
 private revoke(item:any){
  if(item?.displayUrl?.startsWith('blob:')&&typeof URL!=='undefined'&&URL.revokeObjectURL)
   URL.revokeObjectURL(item.displayUrl);
 }
 delete(key:string):boolean {
  this.revoke(this.get(key));return super.delete(key);
 }
 clear():void {
  for(const item of this.values())this.revoke(item);
  super.clear();
 }
}
export const imageCache = new ImageCache();
const PREVIEW_BLOB_MIN_CHARS=250000;
function previewImageUrl(src:string):string {
 if(src.length<PREVIEW_BLOB_MIN_CHARS||typeof URL==='undefined'||
    typeof URL.createObjectURL!=='function'||typeof Blob==='undefined')return src;
 const match=/^data:(image\/(?:png|jpeg|gif|webp|avif|bmp));base64,/i.exec(src);
 if(!match)return src;
 try {
  const decoded=atob(src.slice(match[0].length));
  const bytes=new Uint8Array(decoded.length);
  for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes],{type:match[1].toLowerCase()}));
 }catch{return src;}
}

let onImageLoaded = () => {};
export const setImageUpdateHandler = (callback: () => void) => { onImageLoaded = callback; };
export const getImageRef=(el,ci=S.cardIndex,mode=S.mode)=>{
 if(el.kind!=='image')return null;
 // Fixed template images take priority over per-card spreadsheet image values.
 // Return null for an unset or removed file: never silently choose another image.
 if(el.autoMode==='single'){
  const set=S.sets.find(x=>x.id===el.autoSet||x.name===el.autoSet);
  return set?.images.find(im=>im.name===el.singleImage)||null;
 }
 const c=mode==='cards'?S.cards[ci]:null,manual=c?.values?.[el.id];
 if(manual!==undefined&&String(manual).trim()!==''){
  if(String(manual).toLowerCase()==='none')return null;
  const val=String(manual).replace(/\\/g,'/').toLowerCase();
  const all=S.sets.flatMap(set=>set.images.map(im=>({set,im})));
  // In multi-template projects, different artwork sets may contain identical
  // filenames. A field attached to one image set should prefer that set rather
  // than silently displaying an image belonging to another template.
  const preferredSet=S.sets.find(set=>set.id===el.autoSet||set.name===el.autoSet);
  const preferred=preferredSet?.images.find(im=>im.name.toLowerCase()===val)
   ||preferredSet?.images.find(im=>im.name.toLowerCase().replace(/\.[^.]+$/,'')===val);
  const preferredQualified=preferredSet?.images.find(im=>`${preferredSet.name}/${im.name}`.toLowerCase()===val);
  const found=preferredQualified
   ||all.find(x=>`${x.set.name}/${x.im.name}`.toLowerCase()===val)?.im
   ||preferred
   ||all.find(x=>x.im.name.toLowerCase()===val)?.im
   ||all.find(x=>x.im.name.toLowerCase().replace(/\.[^.]+$/,'')===val)?.im;
  return found||null;
 }
 if(!el.autoSet)return null;
 const set=S.sets.find(x=>x.id===el.autoSet||x.name===el.autoSet);if(!set?.images.length)return null;
 let idx=mode==='cards'?ci:0;
 if(el.autoMode==='sequence'&&idx>=set.images.length)return null;
 if(el.autoMode==='random')idx=Math.abs((ci*2654435761+el.id.split('').reduce((a,c)=>a+c.charCodeAt(0),0))|0)%set.images.length;
 return set.images[idx%set.images.length];
};
export const getImageData=(e,ci,mode)=>getImageRef(e,ci,mode)?.data||null;
export function cacheImage(src){
 if(!src)return null;
 if(imageCache.has(src))return imageCache.get(src);
 const displayUrl=previewImageUrl(src);
 const im=new Image(),item={im,loaded:false,error:false,displayUrl};
 imageCache.set(src,item);
 im.onload=()=>{item.loaded=true;onImageLoaded()};
 im.onerror=()=>{item.error=true};
 im.src=displayUrl;
 return item;
}
export async function loadedImage(src){const o=cacheImage(src);if(!o)return null;if(o.loaded)return o.im;if(o.error)return null;return await new Promise(resolve=>{const im=o.im;im.addEventListener('load',()=>resolve(im),{once:true});im.addEventListener('error',()=>resolve(null),{once:true})})}
/** Automatic fit always determines the image dimensions; only Free uses imgScale. */
function fittedImageSize(e:any,img:any){
 const iw=img?.naturalWidth||e.w,ih=img?.naturalHeight||e.h;
 let ratio=1,w=e.w,h=e.h;
 switch(e.imageFit){
  case 'contain':ratio=Math.min(e.w/iw,e.h/ih);break;
  case 'width':ratio=e.w/iw;break;
  case 'height':ratio=e.h/ih;break;
  case 'cover':ratio=Math.max(e.w/iw,e.h/ih);break;
  case 'stretch':return {w:e.w,h:e.h};
  case 'free':ratio=Math.max(.01,Number(e.imgScale)||1);break;
  default:ratio=Math.max(e.w/iw,e.h/ih);
 }
 return {w:iw*ratio,h:ih*ratio};
}
/** Allowed motion in visible frame axes, including when the image is rotated. */
export function imageFitAxes(e:any,img:any):{x:boolean;y:boolean}{
 switch(e.imageFit){
  case 'free':return {x:true,y:true};
  case 'width':return {x:false,y:true};
  case 'height':return {x:true,y:false};
  case 'contain':case 'stretch':return {x:false,y:false};
  case 'cover':default:{
   const size=fittedImageSize(e,img);
   const angle=(Number(e.imgRotation)||0)*Math.PI/180;
   const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
   const visualWidth=size.w*c+size.h*s,visualHeight=size.h*c+size.w*s;
   return {x:visualWidth>e.w+1e-5,y:visualHeight>e.h+1e-5};
  }
 }
}
/** Convert a visible, frame-axis displacement into saved pre-transform offsets. */
export function screenToImageDelta(e:any,dx:number,dy:number){
 const angle=(Number(e.imgRotation)||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return {x:(dx*c+dy*s)*(e.imgFlipX===true?-1:1),
  y:(dy*c-dx*s)*(e.imgFlipY===true?-1:1)};
}
/** Effective visible offset. Forbidden movements cannot override a fit mode. */
export function imageScreenOffset(e:any,img:any):{x:number;y:number}{
 const angle=(Number(e.imgRotation)||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const ox=(Number(e.imgOffsetX)||0)*(e.imgFlipX===true?-1:1);
 const oy=(Number(e.imgOffsetY)||0)*(e.imgFlipY===true?-1:1);
 let x=ox*c-oy*s,y=ox*s+oy*c;
 const allowed=imageFitAxes(e,img);
 if(!allowed.x)x=0;
 if(!allowed.y)y=0;
 if(e.imageFit==='cover'){
  // Crop must continue filling the frame; never drag an exposed edge into it.
  const box=fittedImageSize(e,img),ac=Math.abs(c),as=Math.abs(s);
  const maxX=Math.max(0,(box.w*ac+box.h*as-e.w)/2);
  const maxY=Math.max(0,(box.h*ac+box.w*as-e.h)/2);
  x=Math.max(-maxX,Math.min(maxX,x));
  y=Math.max(-maxY,Math.min(maxY,y));
 }
 return {x,y};
}
export function imageOffsetPatch(e:any,x:number,y:number,img:any){
 const allowed=imageFitAxes(e,img);
 const candidate=screenToImageDelta(e,allowed.x?x:0,allowed.y?y:0);
 const visible=imageScreenOffset({...e,imgOffsetX:candidate.x,imgOffsetY:candidate.y},img);
 const normalized=screenToImageDelta(e,visible.x,visible.y);
 return {imgOffsetX:normalized.x,imgOffsetY:normalized.y};
}
export function imgBox(e:any,img:any){
 const size=fittedImageSize(e,img);
 const screen=imageScreenOffset(e,img);
 const local=screenToImageDelta(e,screen.x,screen.y);
 return {x:(e.w-size.w)/2+local.x,y:(e.h-size.h)/2+local.y,w:size.w,h:size.h};
}
