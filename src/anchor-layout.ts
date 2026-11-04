/** Shared dynamic edge anchoring for template editor, cards and PNG exports. */
import type { CardElement,CardTemplate,CardSide } from './types';
import { S, cardExtras } from './model';
import { layoutTextBox } from './text-layout';

export type Edge = 'Left'|'Right'|'Top'|'Bottom';
export type Rect = {x:number;y:number;w:number;h:number};
export const anchorEdges: Edge[] = ['Left','Right','Top','Bottom'];
export const hasAnchors=(e:CardElement)=>anchorEdges.some(side=>e[`anchor${side}`]);
export function linkedSource(e:CardElement, ci:number, mode:'cards'|'template',template:CardTemplate=S.template,side:CardSide=S.side||'front') : CardElement|null {
 if(!e.linkedTextId)return null;
 return [...template.elements,...(mode==='cards'?cardExtras(S.cards[ci],side):[])].find(item=>item.id===e.linkedTextId&&item.kind==='text')||null;
}
export function textGeometry(raw:CardElement,ci:number,mode:'cards'|'template'):Rect {
 const e=mode==='cards'?{...raw,...(S.cards[ci]?.overrides?.[raw.id]||{})}:raw;
 const values=mode==='cards'?S.cards[ci]?.values||{}:{};
 const value=Object.prototype.hasOwnProperty.call(values,raw.id)?values[raw.id]:e.text;
 return layoutTextBox(e,String(value??''));
}
const offset=(e:CardElement,side:Edge,child:Rect,source:Rect)=>{
 const saved=e[`anchorOffset${side}`];
 if(typeof saved==='number'&&Number.isFinite(saved))return saved;
 if(side==='Left')return child.x-source.x;
 if(side==='Right')return child.x+child.w-source.x-source.w;
 if(side==='Top')return child.y-source.y;
 return child.y+child.h-source.y-source.h;
};
/** Compute the actual rectangle WITHOUT mutating persisted element dimensions. */
export function elementGeometry(raw:CardElement,ci=S.cardIndex,mode:'cards'|'template'=S.mode,template:CardTemplate=S.template,side:CardSide=S.side||'front'):Rect {
 const e=mode==='cards'?{...raw,...(S.cards[ci]?.overrides?.[raw.id]||{})}:raw;
 if(e.kind==='text')return textGeometry(raw,ci,mode);
 const child={x:e.x,y:e.y,w:e.w,h:e.h};
 if(!hasAnchors(e))return child;
 const sourceRaw=linkedSource(e,ci,mode,template,side);
 if(!sourceRaw)return child; // Orphaned links do not move or resize an element.
 const source=textGeometry(sourceRaw,ci,mode);
 const l=source.x+offset(e,'Left',child,source),r=source.x+source.w+offset(e,'Right',child,source);
 const t=source.y+offset(e,'Top',child,source),b=source.y+source.h+offset(e,'Bottom',child,source);
 const width=e.anchorLeft&&e.anchorRight?Math.max(1,r-l):child.w;
 const height=e.anchorTop&&e.anchorBottom?Math.max(1,b-t):child.h;
 const x=e.anchorLeft?l:e.anchorRight?r-width:child.x;
 const y=e.anchorTop?t:e.anchorBottom?b-height:child.y;
 return {x,y,w:width,h:height};
}
/** Capture offsets at the moment anchors are enabled or the child is dragged. */
export function offsetsForRect(e:CardElement,rect:Rect,ci=S.cardIndex,mode:'cards'|'template'=S.mode):Partial<CardElement> {
 const sourceRaw=linkedSource(e,ci,mode);
 if(!sourceRaw)return {};
 const source=textGeometry(sourceRaw,ci,mode);
 const patch:Partial<CardElement>={};
 if(e.anchorLeft)patch.anchorOffsetLeft=rect.x-source.x;
 if(e.anchorRight)patch.anchorOffsetRight=rect.x+rect.w-source.x-source.w;
 if(e.anchorTop)patch.anchorOffsetTop=rect.y-source.y;
 if(e.anchorBottom)patch.anchorOffsetBottom=rect.y+rect.h-source.y-source.h;
 return patch;
}
