/** Temporary independent text layout mode. The mode is not saved; compensated anchor offsets are. */
import {S,templateEl,cardExtras} from './model';
import type {CardElement,StudioProject} from './types';
import {elementGeometry,hasAnchors,offsetsForRect,anchorTargetId,Rect} from './anchor-layout';

type Session={id:string;project:StudioProject;mode:'template'|'cards';cardIndex:number};
type Snapshot={id:string;mode:'template'|'cards';ci:number;rect:Rect;isExtra:boolean};
let session:Session|null=null;

export function stopTextIsolation(){session=null}
export function isolatedTextId():string|null{
 if(!session)return null;
 const {id,project,mode,cardIndex}=session;
 const raw=templateEl(id);
 const element=raw&&(mode==='cards'?{...raw,...(S.cards[cardIndex]?.overrides?.[id]||{})}:raw);
 if(project!==S||mode!==S.mode||cardIndex!==S.cardIndex||id!==S.selected||
  !element||element.kind!=='text'||element.locked){
  session=null;return null;
 }
 return id;
}
export function enterTextIsolation(id:string):boolean{
 const raw=templateEl(id);
 const element=raw&&(S.mode==='cards'?{...raw,...(S.cards[S.cardIndex]?.overrides?.[id]||{})}:raw);
 if(S.selected!==id||!element||element.kind!=='text'||element.locked)return false;
 session={id,project:S,mode:S.mode,cardIndex:S.cardIndex};
 return true;
}
function linkedDependents(id:string,mode:'template'|'cards',ci:number):Snapshot[]{
 const selected=mode==='cards'?S.cards[ci]:null;
 const all=[...S.template.elements,...(selected?cardExtras(selected):[])];
 return all.filter(raw=>{
  const element=mode==='cards'?{...raw,...(selected?.overrides?.[raw.id]||{})}:raw;
  return anchorTargetId(element)===id&&hasAnchors(element);
 }).map(raw=>({
  id:raw.id,mode,ci,rect:elementGeometry(raw,ci,mode),
  isExtra:!!selected&&cardExtras(selected).some(el=>el.id===raw.id)
 }));
}
const unchanged=(a:Rect,b:Rect)=>Math.abs(a.x-b.x)<1e-6&&Math.abs(a.y-b.y)<1e-6&&Math.abs(a.w-b.w)<1e-6&&Math.abs(a.h-b.h)<1e-6;

/**
 * Move/resize the text, then recapture each dependent's original rectangle
 * against its NEW text geometry. Links remain functional for later normal edits.
 * In Template mode this also protects existing staged cards, including their
 * per-card text values/overrides and card-only linked objects.
 */
export function patchTextIndependently(
 id:string,patch:Partial<CardElement>,apply:(id:string,patch:Partial<CardElement>)=>void
){
 if(isolatedTextId()!==id){apply(id,patch);return}
 const snapshots=S.mode==='template'?
  [...linkedDependents(id,'template',S.cardIndex),
   ...S.cards.flatMap((_,ci)=>linkedDependents(id,'cards',ci))]:
  linkedDependents(id,'cards',S.cardIndex);
 apply(id,patch);
 for(const snapshot of snapshots){
  const c=snapshot.mode==='cards'?S.cards[snapshot.ci]:null;
  const raw=snapshot.isExtra?(c?cardExtras(c).find(el=>el.id===snapshot.id):null):
   S.template.elements.find(el=>el.id===snapshot.id);
  if(!raw)continue;
  const effective=snapshot.mode==='cards'?{...raw,...(c?.overrides?.[raw.id]||{})}:raw;
  if(anchorTargetId(effective)!==id||!hasAnchors(effective))continue;
  if(unchanged(elementGeometry(raw,snapshot.ci,snapshot.mode),snapshot.rect))continue;
  const offsets=offsetsForRect(effective,snapshot.rect,snapshot.ci,snapshot.mode);
  if(!Object.keys(offsets).length)continue;
  if(snapshot.mode==='template')apply(raw.id,offsets);
  else if(snapshot.isExtra)Object.assign(raw,offsets);
  else if(c){
   c.overrides??={};
   c.overrides[raw.id]={...(c.overrides[raw.id]||{}),...offsets};
  }
 }
}
