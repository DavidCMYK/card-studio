/** Shared dynamic edge anchoring for template editor, cards and PNG exports. */
import type { CardElement, CardTemplate, CardSide } from './types';
import { S, cardExtras } from './model';
import { layoutTextBox } from './text-layout';

export type Edge = 'Left'|'Right'|'Top'|'Bottom';
export type Rect = {x:number;y:number;w:number;h:number};
export const anchorEdges: Edge[] = ['Left','Right','Top','Bottom'];
export const hasAnchors=(e:CardElement)=>anchorEdges.some(side=>e['anchor'+side]===true);
/** A saved empty ID deliberately disables the old linkedTextId fallback. */
export const anchorTargetId=(e:CardElement):string=>e.anchorTargetId!==undefined?e.anchorTargetId:(e.linkedTextId||'');
export const sourceEdge=(e:CardElement,side:Edge):Edge=>{
 const requested=e['anchorTarget'+side] as Edge|undefined;
 const valid=side==='Left'||side==='Right'?['Left','Right']:['Top','Bottom'];
 return requested&&valid.includes(requested)?requested:side;
};
const scopedElements=(ci:number,mode:'cards'|'template',template:CardTemplate,side:CardSide)=>
 [...template.elements,...(mode==='cards'?cardExtras(S.cards[ci],side):[])];
const effective=(raw:CardElement,ci:number,mode:'cards'|'template'):CardElement=>
 mode==='cards'?{...raw,...(S.cards[ci]?.overrides?.[raw.id]||{})}:raw;
export function linkedSource(e:CardElement,ci:number,mode:'cards'|'template',template:CardTemplate=S.template,side:CardSide=S.side||'front'):CardElement|null{
 const id=anchorTargetId(e);
 return id&&id!==e.id?scopedElements(ci,mode,template,side).find(item=>item.id===id)||null:null;
}
/** Validate a proposed target even when anchors have not yet been switched on. */
export function wouldAnchorCycle(e:CardElement,targetId:string,ci=S.cardIndex,mode:'cards'|'template'=S.mode,template:CardTemplate=S.template,side:CardSide=S.side||'front'):boolean{
 if(!targetId)return false;
 const visited=new Set([e.id]),all=scopedElements(ci,mode,template,side);
 let id=targetId;
 while(id){
  if(visited.has(id))return true;
  visited.add(id);
  const raw=all.find(item=>item.id===id);
  if(!raw)return false;
  const next=effective(raw,ci,mode);
  if(!hasAnchors(next))return false;
  id=anchorTargetId(next);
 }
 return false;
}
export function textGeometry(raw:CardElement,ci:number,mode:'cards'|'template'):Rect{
 const e=effective(raw,ci,mode);
 const values=mode==='cards'?S.cards[ci]?.values||{}:{};
 const value=Object.prototype.hasOwnProperty.call(values,raw.id)?values[raw.id]:e.text;
 return layoutTextBox(e,String(value??''));
}
const edge=(r:Rect,side:Edge):number=>side==='Left'?r.x:side==='Right'?r.x+r.w:side==='Top'?r.y:r.y+r.h;
const offset=(e:CardElement,side:Edge,child:Rect,source:Rect):number=>{
 const saved=e['anchorOffset'+side];
 return typeof saved==='number'&&Number.isFinite(saved)?saved:edge(child,side)-edge(source,sourceEdge(e,side));
};
/** Resolve linked elements recursively without mutating the stored template geometry. */
export function elementGeometry(raw:CardElement,ci=S.cardIndex,mode:'cards'|'template'=S.mode,template:CardTemplate=S.template,side:CardSide=S.side||'front',ancestors:Set<string>=new Set()):Rect{
 const e=effective(raw,ci,mode);
 const base:Rect=e.kind==='text'?textGeometry(raw,ci,mode):{x:e.x,y:e.y,w:e.w,h:e.h};
 if(!hasAnchors(e)||ancestors.has(raw.id))return base;
 const sourceRaw=linkedSource(e,ci,mode,template,side);
 if(!sourceRaw)return base;
 const chain=new Set(ancestors);chain.add(raw.id);
 const source=elementGeometry(sourceRaw,ci,mode,template,side,chain);
 const l=edge(source,sourceEdge(e,'Left'))+offset(e,'Left',base,source);
 const r=edge(source,sourceEdge(e,'Right'))+offset(e,'Right',base,source);
 const t=edge(source,sourceEdge(e,'Top'))+offset(e,'Top',base,source);
 const b=edge(source,sourceEdge(e,'Bottom'))+offset(e,'Bottom',base,source);
 const w=e.anchorLeft&&e.anchorRight?Math.max(0,r-l):base.w;
 const x=e.anchorLeft?l:e.anchorRight?r-w:base.x;
 let measured=base;
 // A text box stretched horizontally must rewrap before vertical auto-fit.
 if(e.kind==='text'&&e.autoHeight===true&&w!==base.w){
  const values=mode==='cards'?S.cards[ci]?.values||{}:{};
  const value=Object.prototype.hasOwnProperty.call(values,raw.id)?values[raw.id]:e.text;
  const resized=layoutTextBox({...e,w,autoWidth:false},String(value??''));
  measured={...base,h:resized.h,y:resized.y};
 }
 const h=e.anchorTop&&e.anchorBottom?Math.max(0,b-t):measured.h;
 const y=e.anchorTop?t:e.anchorBottom?b-h:measured.y;
 return {x,y,w,h};
}
/** Capture offsets when an anchor changes or an element is dragged. */
export function offsetsForRect(e:CardElement,rect:Rect,ci=S.cardIndex,mode:'cards'|'template'=S.mode,template:CardTemplate=S.template,side:CardSide=S.side||'front'):Partial<CardElement>{
 const sourceRaw=linkedSource(e,ci,mode,template,side);
 if(!sourceRaw)return {};
 const source=elementGeometry(sourceRaw,ci,mode,template,side,new Set([e.id]));
 const patch:Partial<CardElement>={};
 for(const current of anchorEdges)if(e['anchor'+current]){
  patch['anchorOffset'+current]=edge(rect,current)-edge(source,sourceEdge(e,current));
 }
 return patch;
}
