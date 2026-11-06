/** Deterministic, non-destructive artwork matching against imported image sets.
 * Always preview before applying, and never treat fuzzy matches as certain. */
import {S} from './model';
import {gridColumns} from './card-data-grid';
import {getImageRef} from './image-sets';
import type {CardElement,ImageAsset,StagedCard} from './types';

export const CARD_NAME_KEY='@card-name';
export type Confidence='exact'|'review'|'ambiguous'|'missing'|'missing-file'|'assigned'|'fixed';
export interface ImageChoice {
 key:string;setId:string;setName:string;name:string;data:string;
}
export interface Candidate extends ImageChoice {score:number;reason:string}
export interface MatchRow {
 cardId:string;cardName:string;source:string;
 status:Confidence;existing:string;
 suggested:Candidate|null;alternatives:Candidate[];
}
export interface Assignment {
 cardId:string;imageKey:string;
}
export interface MatchOptions {
 setId:string;targetId:string;sourceId:string;imageSetId?:string;
 overwrite?:boolean;
}
const normalize=(raw:string):string=>String(raw||'').normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase()
 .replace(/&/g,' and ').replace(/([a-z])(\d)/g,'$1 $2').replace(/(\d)([a-z])/g,'$1 $2')
 .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const fileBase=(text:string):string=>String(text||'').replace(/\\/g,'/').split('/').pop()||'';
const withoutExtension=(text:string):string=>text.replace(/\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$/i,'');
const commonEnd=/(?:[\s_-]+(?:art|artwork|illustration|image|img|render|final|final\d+|hires|highres|draft|copy|front|back|ver\d+|version\d+|v\d+|rev\d+))+$/i;
const simplify=(text:string)=>normalize(withoutExtension(fileBase(text)).replace(commonEnd,''));
const tokens=(text:string)=>new Set(text.split(' ').filter(Boolean));
function editDistance(a:string,b:string):number {
 if(a===b)return 0;
 if(!a.length)return b.length;
 if(!b.length)return a.length;
 const prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let diagonal=prev[0];prev[0]=i;
  for(let j=1;j<=b.length;j++){
   const old=prev[j];
   prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));
   diagonal=old;
  }
 }
 return prev[b.length];
}
export function matchScore(value:string,filename:string):{score:number;reason:string}{
 const raw=String(value||'').trim(),name=String(filename||'').trim();
 if(!raw||!name)return {score:0,reason:'No reference'};
 const lhs=fileBase(raw).toLocaleLowerCase(),rhs=fileBase(name).toLocaleLowerCase();
 if(lhs===rhs)return {score:100,reason:'Exact filename'};
 const a=normalize(withoutExtension(lhs)),b=normalize(withoutExtension(rhs));
 if(a&&a===b)return {score:97,reason:'Same name after punctuation and accent normalization'};
 const x=simplify(lhs),y=simplify(rhs);
 if(x&&x===y)return {score:94,reason:'Same name ignoring common artwork suffixes'};
 if(x.length<4||y.length<4)return {score:0,reason:'Too little information for fuzzy matching'};
 const at=tokens(x),bt=tokens(y),common=[...at].filter(t=>bt.has(t));
 if(common.length>=2 && common.length===at.size && at.size===bt.size)
  return {score:91,reason:'Matching words in a different order'};
 if(common.length>=2 && common.length===Math.min(at.size,bt.size) &&
   Math.min(x.length,y.length)>=7)
  return {score:82,reason:'Artwork name contains the card words'};
 // Approximate match only. Never selected automatically.
 if(Math.abs(x.length-y.length)>Math.max(4,Math.min(x.length,y.length)*.28))
  return {score:0,reason:'No useful match'};
 const similarity=1-editDistance(x,y)/Math.max(x.length,y.length);
 if(similarity>=.87&&Math.abs(x.length-y.length)<=4)
  return {score:79,reason:'Very similar spelling (review required)'};
 if(similarity>=.73&&common.length>=1)
  return {score:68,reason:'Possible name match (review required)'};
 return {score:0,reason:'No useful match'};
}
export function imageKey(setId:string,name:string):string{
 return encodeURIComponent(setId)+'/'+encodeURIComponent(name);
}
export function findChoice(key:string):ImageChoice|null{
 const separator=key.indexOf('/');
 if(separator<0)return null;
 let id='',filename='';
 try{id=decodeURIComponent(key.slice(0,separator));filename=decodeURIComponent(key.slice(separator+1));}
 catch{return null;}
 const set=S.sets.find(s=>s.id===id);
 const image=set?.images.find(im=>im.name===filename);
 return set&&image?{key:imageKey(set.id,image.name),setId:set.id,setName:set.name,name:image.name,data:image.data}:null;
}
export function imageChoices(imageSetId?:string):ImageChoice[]{
 return S.sets.filter(set=>!imageSetId||set.id===imageSetId).flatMap(set=>
  set.images.map(image=>({
   key:imageKey(set.id,image.name),setId:set.id,setName:set.name,name:image.name,data:image.data
  })));
}
export function targetElement(setId:string,targetId:string):CardElement{
 const col=gridColumns(setId).find(col=>col.id===targetId&&col.kind==='image');
 if(!col?.element)throw Error('Select an image field from the assigned templates');
 return col.element;
}
function sourceText(card:StagedCard,sourceId:string,setId:string):string{
 if(sourceId===CARD_NAME_KEY)return String(card.name||'');
 const col=gridColumns(setId).find(col=>col.id===sourceId&&col.kind==='text');
 if(!col?.element)throw Error('Select the card name or a text/ID field to match');
 return String(card.values?.[sourceId]??col.element.text??'');
}
export function suggestArtwork(options:MatchOptions):MatchRow[]{
 const element=targetElement(options.setId,options.targetId);
 if(options.sourceId!==CARD_NAME_KEY)sourceText({name:'',id:'',values:{},overrides:{},extraElements:[]},options.sourceId,options.setId);
 const candidates=imageChoices(options.imageSetId);
 const preferred=S.sets.find(set=>set.id===element.autoSet||set.name===element.autoSet)?.id;
 return S.cards.map((card,index)=>({card,index})).filter(({card})=>card.setId===options.setId).map(({card,index})=>{
  const existing=String(card.values?.[element.id]??'');
  const source=sourceText(card,options.sourceId,options.setId);
  const base={cardId:card.id,cardName:card.name,source,existing};
  if(element.autoMode==='single')
   return {...base,status:'fixed' as Confidence,suggested:null,alternatives:[]};
  if(existing.trim()&&!options.overwrite)
   return {...base,status:(existing.trim().toLocaleLowerCase()==='none'||getImageRef(element,index,'cards')?'assigned':'missing-file') as Confidence,suggested:null,alternatives:[]};
  const scored=candidates.map(choice=>{
   const result=matchScore(source,choice.name);
   return {...choice,...result,
    // Prefer a frame's own image set only to break an otherwise exact tie.
    rank:result.score+(preferred===choice.setId&&result.score>=90?10:0)
   };
  }).filter(item=>item.score>=60)
   .sort((a,b)=>b.rank-a.rank||a.setName.localeCompare(b.setName)||a.name.localeCompare(b.name));
  const best=scored[0],next=scored[1];
  if(!best)return {...base,status:'missing' as Confidence,suggested:null,alternatives:[]};
  const ambiguous=!!next&&best.rank-next.rank<5;
  const status:Confidence=ambiguous?'ambiguous':best.score>=90?'exact':'review';
  return {...base,status,suggested:best,alternatives:scored.slice(0,5)};
 });
}
/** Explicit preview decisions only. Validate all first, then apply atomically.
 * Existing values and fixed template images are protected unless overwrite=true. */
export function applyArtwork(options:MatchOptions,assignments:ReadonlyArray<Assignment>):number{
 const element=targetElement(options.setId,options.targetId);
 if(element.autoMode==='single')throw Error('The selected image frame is fixed to one template image');
 const decisions:{card:StagedCard;value:string}[]=[];
 const seen=new Set<string>();
 for(const decision of assignments){
  if(seen.has(decision.cardId))throw Error('Duplicate card in artwork assignment');
  seen.add(decision.cardId);
  const card=S.cards.find(c=>c.id===decision.cardId&&c.setId===options.setId);
  if(!card)throw Error('Card no longer exists in the selected set');
  const image=findChoice(decision.imageKey);
  if(!image||options.imageSetId&&image.setId!==options.imageSetId)
   throw Error('Artwork is no longer available in the selected image set');
  const previous=String(card.values?.[element.id]??'');
  if(previous.trim()&&!options.overwrite&&previous!==image.setName+'/'+image.name)
   throw Error('Existing artwork assignment must not be overwritten without permission');
  const value=image.setName+'/'+image.name;
  if(value!==previous)decisions.push({card,value});
 }
 for(const entry of decisions){
  entry.card.values??={};
  entry.card.values[element.id]=entry.value;
 }
 return decisions.length;
}
