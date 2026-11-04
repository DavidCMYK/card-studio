/** Low-resolution card thumbnails use the same element painter as PNG export.
 * Render lazily only when card rows are near the visible area.
 */
import {S,px,visibleOnCard,assignedTemplate} from './model';
import {getImageData,loadedImage} from './image-sets';
import {elementGeometry} from './anchor-layout';
import {paintElement} from './element-paint';
import {waitForProjectFonts} from './project-fonts';
import {historyRevision} from './history';

const cache=new Map<string,string>();
let observer:IntersectionObserver|null=null;
let lastRevision=-1;
async function thumbnail(ci:number,revision:number):Promise<string|null>{
 await waitForProjectFonts();
 const template=assignedTemplate(ci,'front')||S.template;
 const w=px(template.width,template.unit,template.dpi),h=px(template.height,template.unit,template.dpi);
 if(w<=0||h<=0)return null;
 const canvas=document.createElement('canvas');
 canvas.width=78;canvas.height=Math.max(48,Math.min(144,Math.round(78*h/w)));
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 ctx.scale(canvas.width/w,canvas.height/h);
 ctx.fillStyle=template.background||'#ffffff';ctx.fillRect(0,0,w,h);
 const staged=S.cards[ci];
 if(!staged)return null;
 const elements=[...template.elements,...(staged.extraElements||[])];
 for(const raw of elements){
  if(!visibleOnCard(raw,ci,'cards',template,'front'))continue;
  const e={...raw,...(staged.overrides?.[raw.id]||{})};
  const value=raw.kind==='text'&&Object.prototype.hasOwnProperty.call(staged.values||{},raw.id)?String(staged.values[raw.id]??''):e.text;
  const src=raw.kind==='image'?getImageData(raw,ci,'cards'):null;
  const image=src?await loadedImage(src):null;
  const rect=elementGeometry(raw,ci,'cards',template,'front');
  paintElement(ctx,{...e,...rect},value||'',image);
 }
 if(revision!==historyRevision())return null;
 try{return canvas.toDataURL('image/png')}catch{return null}
}
function scheduleNode(node:HTMLImageElement,revision:number){
 const ci=Number(node.dataset.cardThumb);
 if(!Number.isInteger(ci))return;
 const key=revision+':'+ci;
 const cached=cache.get(key);
 if(cached){node.src=cached;return}
 void thumbnail(ci,revision).then(src=>{
  if(!src)return;
  cache.set(key,src);
  if(cache.size>240){const oldest=cache.keys().next().value;if(oldest)cache.delete(oldest)}
  if(node.isConnected&&revision===historyRevision())node.src=src;
 }).catch(error=>console.warn('Card thumbnail could not be drawn',error));
}
export function renderCardThumbnails(){
 if(typeof window==='undefined'||typeof document==='undefined'||!document.querySelectorAll)return;
 if(observer){observer.disconnect();observer=null}
 const revision=historyRevision();
 if(lastRevision!==revision){lastRevision=revision;cache.clear()}
 const nodes=[...document.querySelectorAll('img[data-card-thumb]')] as HTMLImageElement[];
 if(!nodes.length)return;
 if(typeof IntersectionObserver==='undefined'){
  for(const node of nodes.slice(0,12))scheduleNode(node,revision);
  return;
 }
 observer=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(entry.isIntersecting){
    const node=entry.target as HTMLImageElement;
    observer?.unobserve(node);
    scheduleNode(node,revision);
   }
  }
 },{root:document.getElementById('cardsScroll'),rootMargin:'180px 0px'});
 for(const node of nodes)observer.observe(node);
}
