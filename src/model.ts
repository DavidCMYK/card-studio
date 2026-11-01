// Shared document model. Stored card overrides never mutate template elements.
import type { CardElement, ElementKind, StudioProject, Units } from './types';
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
export const makeElement=(kind: ElementKind,parts: Partial<CardElement> = {}): CardElement =>({id:uid(),kind,name:kind==='text'?'Text':kind==='image'?'Artwork':'Shape',x:22,y:35,w:195,h:55,locked:false,hidden:false,includeInExport:true,shape:'rect',radius:0,fillMode:kind==='shape'?'solid':'none',fill1:'#ffffff',fill2:'#dde5f1',gradientAngle:90,borderWidth:0,borderColor:'#233b58',opacity:100,fillOpacity:100,borderOpacity:100,textOpacity:100,text:'Text',font:'Georgia',fontSize:19,fontWeight:400,italic:false,underline:false,color:'#152b43',align:'left',valign:'middle',lineHeight:1.18,letterSpacing:0,imageFit:'cover',imgScale:1,imgOffsetX:0,imgOffsetY:0,autoSet:'',autoMode:'cycle',...parts});
export const initialElements=()=>[
makeElement('shape',{name:'Card background',x:0,y:0,w:px(63,'mm'),h:px(88,'mm'),fillMode:'gradient',fill1:'#fcfaf4',fill2:'#dce7ed',gradientAngle:180}),
makeElement('shape',{name:'Artwork surround',x:8,y:42,w:222,h:169,fillMode:'solid',fill1:'#fdfdfc',borderWidth:1.5,borderColor:'#6c8297'}),
makeElement('image',{name:'Artwork',x:12,y:46,w:214,h:161,imageFit:'cover',borderWidth:0}),
makeElement('text',{name:'Card Title',x:13,y:9,w:213,h:32,text:'THE HOLLOW GATE',font:'Georgia',fontSize:16,fontWeight:700,align:'center',color:'#1b3852'}),
makeElement('shape',{name:'Text panel',x:8,y:217,w:222,h:103,fillMode:'solid',fill1:'#fdfcf8',borderWidth:1,borderColor:'#8da0af',radius:6}),
makeElement('text',{name:'Description',x:18,y:223,w:201,h:83,text:'Beyond the old stones, the road descends into darkness.',font:'Georgia',fontSize:11,fontWeight:400,valign:'top',color:'#324358',lineHeight:1.3})
];
export const initial=(): StudioProject =>({type:'cardstudio-project',version:2,projectName:'Untitled deck',template:{name:'Standard game card',width:63,height:88,unit:'mm',dpi:300,background:'#ffffff',elements:initialElements()},sets:[],cards:[{id:uid(),name:'Card 001',values:{},overrides:{},extraElements:[]}],mode:'template',cardIndex:0,selected:null,zoom:1.55});
export let S: StudioProject = initial();
export function replaceState(value: StudioProject) { S = value; }
export const card=()=>S.cards[S.cardIndex]||null;
export const templateEl=(id: string | null)=>S.template.elements.find(e=>e.id===id)||(S.mode==='cards'?card()?.extraElements?.find(e=>e.id===id):null);
export const layerEls=()=>[...S.template.elements,...(S.mode==='cards'?(card()?.extraElements||[]):[])];
export const isExported=(e: CardElement)=>e.includeInExport !== false;
export const isExtra=(id: string | null)=>!!card()?.extraElements?.some(e=>e.id===id);
export const effective=(e: CardElement)=>S.mode==='cards'&&card()&&!isExtra(e.id)?{...e,...(card().overrides?.[e.id]||{})}:e;
export const actualValue=(e: CardElement)=>S.mode==='cards'&&card()&&Object.prototype.hasOwnProperty.call(card().values||{},e.id)?card().values[e.id]:(e.kind==='text'?e.text:'');
export const uniqName=(name: string,exclude?: string)=>{let base=String(name||'Element').trim()||'Element',str=base,n=2;while(layerEls().some(x=>x.id!==exclude&&x.name.toLowerCase()===str.toLowerCase()))str=base+' '+n++;return str};
