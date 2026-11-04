import { S } from './model';
export const imageCache = new Map<string, any>();
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
  const found=all.find(x=>`${x.set.name}/${x.im.name}`.toLowerCase()===val)||all.find(x=>x.im.name.toLowerCase()===val)||all.find(x=>x.im.name.toLowerCase().replace(/\.[^.]+$/,'')===val);
  return found?.im||null;
 }
 if(!el.autoSet)return null;
 const set=S.sets.find(x=>x.id===el.autoSet||x.name===el.autoSet);if(!set?.images.length)return null;
 let idx=mode==='cards'?ci:0;
 if(el.autoMode==='sequence'&&idx>=set.images.length)return null;
 if(el.autoMode==='random')idx=Math.abs((ci*2654435761+el.id.split('').reduce((a,c)=>a+c.charCodeAt(0),0))|0)%set.images.length;
 return set.images[idx%set.images.length];
};
export const getImageData=(e,ci,mode)=>getImageRef(e,ci,mode)?.data||null;
export function cacheImage(src){if(!src)return null;if(imageCache.has(src))return imageCache.get(src);const im=new Image();const item={im,loaded:false,error:false};imageCache.set(src,item);im.onload=()=>{item.loaded=true;onImageLoaded()};im.onerror=()=>{item.error=true};im.src=src;return item}
export async function loadedImage(src){const o=cacheImage(src);if(!o)return null;if(o.loaded)return o.im;if(o.error)return null;return await new Promise(resolve=>{const im=o.im;im.addEventListener('load',()=>resolve(im),{once:true});im.addEventListener('error',()=>resolve(null),{once:true})})}
export function imgBox(e,img){
 const iw=img?.naturalWidth||e.w,ih=img?.naturalHeight||e.h;
 // Legacy projects use zoom=1; scale/offset remain independent of frame dimensions.
 const zoom=Math.max(.01,Number(e.imgZoom)||1);
 let ratio=1,w=e.w,h=e.h;
 switch(e.imageFit){
  case 'contain':ratio=Math.min(e.w/iw,e.h/ih);break;
  case 'width':ratio=e.w/iw;break;
  case 'height':ratio=e.h/ih;break;
  case 'cover':ratio=Math.max(e.w/iw,e.h/ih);break;
  case 'stretch':w=e.w*zoom;h=e.h*zoom;break;
  case 'free':ratio=e.imgScale||1;break;
  default:ratio=Math.max(e.w/iw,e.h/ih);
 }
 if(e.imageFit!=='stretch'){w=iw*ratio*zoom;h=ih*ratio*zoom}
 return {x:(e.w-w)/2+(Number(e.imgOffsetX)||0),y:(e.h-h)/2+(Number(e.imgOffsetY)||0),w,h};
}
