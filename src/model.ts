// Shared document model. Stored card overrides never mutate template elements.
import type { CardElement, ElementKind, StudioProject, Units, CardTemplate, CardSet, CardSide, StagedCard } from './types';
import {DEFAULT_GUIDES} from './card-guides';
export const uid=()=>Math.random().toString(36).slice(2,10);
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const escapeXML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const safeFile=s=>String(s||'card').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim().slice(0,95)||'card';
export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
// Geometry uses 96 CSS/design pixels per inch internally. The 'px' unit shown in
// controls means *export image pixels* at the selected DPI, never screen pixels.
export const perUnit: Record<Units, number>={mm:96/25.4,in:96,px:1};
export const unitFactor=(unit: Units,dpi: number)=>unit==='px'?96/dpi:perUnit[unit];
export const px=(value: number,unit: Units = 'mm',dpi: number = 300)=>Number(value||0)*unitFactor(unit,dpi);
export const exportPixels=(designPixels: number,dpi: number = S.template.dpi)=>Math.round(designPixels*dpi/96);
export const sizePx=()=>({w:px(S.template.width,S.template.unit,S.template.dpi),h:px(S.template.height,S.template.unit,S.template.dpi)});
export const templateExportSize=()=>{const {w,h}=sizePx();return {w:exportPixels(w),h:exportPixels(h)}};

export const fmt=v=>String(Math.round(v*100)/100);
export type OpacityComponent = 'fillOpacity'|'borderOpacity'|'textOpacity';
export const opacityFor=(e: CardElement,component: OpacityComponent)=>clamp(Number(e[component]??e.opacity??100)||0,0,100)/100;
export const textKinds=['text','image'];
export const makeElement=(kind: ElementKind,parts: Partial<CardElement> = {}): CardElement =>({id:uid(),kind,name:kind==='text'?'Text':kind==='image'?'Artwork':'Shape',x:22,y:35,w:195,h:55,locked:false,hidden:false,includeInExport:true,includeInDataExport:true,invisibleIfEmpty:true,linkedTextId:'',anchorLeft:false,anchorRight:false,anchorTop:false,anchorBottom:false,shape:'rect',radius:0,fillMode:kind==='shape'?'solid':'none',fill1:'#ffffff',fill2:'#dde5f1',gradientAngle:90,borderWidth:0,borderColor:'#233b58',shadowEnabled:false,shadowColor:'#000000',shadowOpacity:65,shadowOffsetX:0,shadowOffsetY:0,shadowSpread:0,opacity:100,fillOpacity:100,borderOpacity:100,textOpacity:100,text:'Text',font:'Georgia',fontSize:19,fontWeight:400,italic:false,underline:false,color:'#152b43',align:'left',valign:'middle',lineHeight:1.18,letterSpacing:0,autoWidth:false,autoHeight:false,gutterLeft:0,gutterRight:0,gutterTop:0,gutterBottom:0,imageFit:'cover',imgScale:1,imgOffsetX:0,imgOffsetY:0,imgFlipX:false,imgFlipY:false,imgRotation:0,autoSet:'',autoMode:'cycle',singleImage:'',...parts});
export const initialElements=()=>[
makeElement('shape',{name:'Card background',x:0,y:0,w:px(63,'mm'),h:px(88,'mm'),fillMode:'gradient',fill1:'#fcfaf4',fill2:'#dce7ed',gradientAngle:180}),
makeElement('shape',{name:'Artwork surround',x:8,y:42,w:222,h:169,fillMode:'solid',fill1:'#fdfdfc',borderWidth:1.5,borderColor:'#6c8297'}),
makeElement('image',{name:'Artwork',x:12,y:46,w:214,h:161,imageFit:'cover',borderWidth:0}),
makeElement('text',{name:'Card Title',x:13,y:9,w:213,h:32,text:'THE HOLLOW GATE',font:'Georgia',fontSize:16,fontWeight:700,align:'center',color:'#1b3852'}),
makeElement('shape',{name:'Text panel',x:8,y:217,w:222,h:103,fillMode:'solid',fill1:'#fdfcf8',borderWidth:1,borderColor:'#8da0af',radius:6}),
makeElement('text',{name:'Description',x:18,y:223,w:201,h:83,text:'Beyond the old stones, the road descends into darkness.',font:'Georgia',fontSize:11,fontWeight:400,valign:'top',color:'#324358',lineHeight:1.3})
];
/** One template object may be referenced by any number of card sets. */
export function initial():StudioProject{
 const template:CardTemplate={id:uid(),name:'Standard game card',width:63,height:88,unit:'mm',dpi:300,guides:structuredClone(DEFAULT_GUIDES),background:'#ffffff',shadowOverlapMode:'add',elements:initialElements()};
 const set:CardSet={id:uid(),name:'Default set',frontTemplateId:template.id!};
 return {type:'cardstudio-project',version:2,projectName:'Untitled deck',fonts:[],template,templates:[template],cardSets:[set],selectedTemplateId:template.id,side:'front',sets:[],cards:[{id:uid(),setId:set.id,name:'Card 001',values:{},overrides:{},extraElements:[]}],mode:'template',cardIndex:0,selected:null,zoom:1.55};
}
/** Resolve legacy projects without mutating artwork, IDs of existing elements, or card data.
 * The template alias ALWAYS points to one of templates[] in memory. */
export function normalizeProject(value:StudioProject):StudioProject{
 if(!Array.isArray(value.templates)||!value.templates.length)value.templates=[value.template];
 value.templates=value.templates.filter(t=>t&&Array.isArray(t.elements));
 if(!value.templates.length)value.templates=[value.template];
 const templateIds=new Set<string>();
 for(const template of value.templates){
  if(!template.id||templateIds.has(template.id))template.id=uid();
  templateIds.add(template.id);
 }
 if(!Array.isArray(value.cardSets)||!value.cardSets.length){
  value.cardSets=[{id:uid(),name:'Default set',frontTemplateId:value.templates[0].id!}];
 }
 const setIds=new Set<string>();
 for(const set of value.cardSets){
  if(!set.id||setIds.has(set.id))set.id=uid();
  setIds.add(set.id);
  if(!templateIds.has(set.frontTemplateId))set.frontTemplateId=value.templates[0].id!;
  if(set.backTemplateId&&!templateIds.has(set.backTemplateId))delete set.backTemplateId;
 }
 for(const card of value.cards||[]){
  if(!card.setId||!setIds.has(card.setId))card.setId=value.cardSets[0].id;
  card.values??={};card.overrides??={};card.extraElements??=[];
 }
 if(!templateIds.has(value.selectedTemplateId||''))value.selectedTemplateId=value.templates[0].id;
 if(value.side!=='back')value.side='front';
 const current=value.cards?.[value.cardIndex]||value.cards?.[0],set=value.cardSets.find(x=>x.id===current?.setId)||value.cardSets[0];
 if(value.mode==='cards'){
  const selectedId=value.side==='back'?set.backTemplateId:set.frontTemplateId;
  if(!selectedId)value.side='front';
  value.template=value.templates.find(x=>x.id===(value.side==='back'?set.backTemplateId:set.frontTemplateId))||value.templates[0];
 }else value.template=value.templates.find(x=>x.id===value.selectedTemplateId)||value.templates[0];
 return value;
}
export let S: StudioProject = initial();
export function replaceState(value: StudioProject) { S = normalizeProject(value); }
export function templateById(id?:string):CardTemplate|undefined {return S.templates?.find(t=>t.id===id);}
export function cardSetFor(card:StagedCard|undefined):CardSet|undefined{
 return S.cardSets?.find(set=>set.id===card?.setId)||S.cardSets?.[0];
}
export function assignedTemplate(ci:number,side:CardSide='front'):CardTemplate|undefined{
 const set=cardSetFor(S.cards[ci]);
 return templateById(side==='front'?set?.frontTemplateId:set?.backTemplateId);
}
export function syncEditorTemplate():void{
 normalizeProject(S);
 S.selected=null;
}
export function selectProjectTemplate(id:string):boolean{
 const target=templateById(id);if(!target)return false;
 S.selectedTemplateId=id;S.mode='template';S.template=target;S.selected=null;return true;
}
export function setCardSide(side:CardSide):boolean{
 if(side==='back'&&!assignedTemplate(S.cardIndex,'back'))return false;
 S.side=side;
 if(S.mode==='cards')syncEditorTemplate();
 return true;
}

export const card=()=>S.cards[S.cardIndex]||null;
export const templateEl=(id: string | null)=>S.template.elements.find(e=>e.id===id)||(S.mode==='cards'?card()?.extraElements?.find(e=>e.id===id):null);
export const layerEls=()=>[...S.template.elements,...(S.mode==='cards'?(card()?.extraElements||[]):[])];
export const isExported=(e: CardElement)=>e.includeInExport !== false;
export const isDataExported=(e: CardElement)=>e.includeInDataExport !== false;
export const isExtra=(id: string | null)=>!!card()?.extraElements?.some(e=>e.id===id);
export const effective=(e: CardElement)=>S.mode==='cards'&&card()&&!isExtra(e.id)?{...e,...(card().overrides?.[e.id]||{})}:e;
export const actualValue=(e: CardElement)=>S.mode==='cards'&&card()&&Object.prototype.hasOwnProperty.call(card().values||{},e.id)?card().values[e.id]:(e.kind==='text'?e.text:'');
/** Resolve spreadsheet/card data for any card index, without changing the UI selection. */
export function cardTextValue(e: CardElement, cardIndex: number): string {
 const values=S.cards[cardIndex]?.values||{};
 return String(Object.prototype.hasOwnProperty.call(values,e.id)?values[e.id]:e.text??'');
}
/** Single visibility rule shared by card preview, layers, and all PNG exports. */
export function visibleOnCard(raw: CardElement, cardIndex: number, mode: 'template'|'cards'='cards'): boolean {
 const overrides=mode==='cards'?S.cards[cardIndex]?.overrides?.[raw.id]:null;
 const el=overrides?{...raw,...overrides}:raw;
 if(el.hidden||!isExported(raw)||!isExported(el))return false;
 // Template PNG exports should still render default text/backgrounds, but no guides.
 if(mode!=='cards')return true;
 if(el.kind==='text')return el.invisibleIfEmpty===false||cardTextValue(raw,cardIndex).trim()!=='';
 if((el.kind==='shape'||el.kind==='image')&&el.linkedTextId){
  const source=[...S.template.elements,...(S.cards[cardIndex]?.extraElements||[])]
   .find(item=>item.id===el.linkedTextId&&item.kind==='text');
  // Orphaned links are ignored rather than concealing the element unexpectedly.
  return !source||visibleOnCard(source,cardIndex,'cards');
 }
 return true;
}
export const uniqName=(name: string,exclude?: string)=>{let base=String(name||'Element').trim()||'Element',str=base,n=2;while(layerEls().some(x=>x.id!==exclude&&x.name.toLowerCase()===str.toLowerCase()))str=base+' '+n++;return str};
