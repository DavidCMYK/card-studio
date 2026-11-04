import type {CardTemplate} from './types';
import {guidesFor,displayedDistance} from './card-guides';
/** Card Setup controls, built with the studio's existing input helpers. */
export function guideSettingsHtml(t:CardTemplate,
 field:(label:string,key:string,value:any,type?:string,extra?:string)=>string,
 selectionField:(label:string,key:string,items:any[],value:any)=>string,
 checkbox:(label:string,key:string,value:boolean)=>string,readout:string=''):string{
 const g=guidesFor(t),u=g.unit,dpi=t.dpi;
 const sideInputs=(kind:'bleed'|'safe')=>{
  const linked=kind==='bleed'?g.bleedLinked:g.safeLinked;
  const vals=g[kind],name=kind==='bleed'?'Bleed':'Safe-area';
  const input=(edge:string)=>field((linked?name:edge[0].toUpperCase()+edge.slice(1))+' ('+u+')',
   'guide.'+kind+'.'+edge,displayedDistance(vals[edge],u,dpi),'number','min="0" step="any"');
  return checkbox('Same '+name.toLowerCase()+' distance on every side','guide.'+kind+'Linked',linked)+
   (linked?input('top'):'<div class="fields-two">'+['top','right','bottom','left'].map(input).join('')+'</div>');
 };
 return '<div class="small" style="padding:0 0 8px">Canvas edge = artwork edge. A trim guide is only needed when the canvas includes bleed.</div>'+
 selectionField('Canvas dimensions represent','guide.bleedMode',[
  ['trim','Finished card size (canvas excludes bleed)'],['bleed','Full artwork size (canvas includes bleed)']],g.bleedMode)+
 '<div class="small" style="padding:0 0 9px">These settings never resize your canvas or move any artwork. In bleed mode, finished cut size = canvas minus bleed. To keep the same finished size, change Canvas width/height yourself in Dimensions above.</div>'+
 selectionField('Guide distance units','guide.unit',[
  ['mm','Millimetres (mm)'],['in','Inches (in)'],['px','Pixels (at template DPI)']],u)+
 sideInputs('bleed')+
 '<div class="small" style="padding:0 0 9px">'+(g.bleedMode==='bleed'?'Bleed is included in the canvas and PDF output.':'Bleed distances are stored but inactive until you select artwork including bleed.')+'</div>'+
 sideInputs('safe')+
 '<div class="small" style="padding:0 0 8px">Safe area is measured inward from the finished-card trim edge.</div>'+
 checkbox('Show guides in Template mode','guide.showTemplate',g.showTemplate)+
 checkbox('Show guides in Cards mode','guide.showCards',g.showCards)+
 checkbox('Dim outside the safe area','guide.dimUnsafe',g.dimUnsafe)+
 '<div class="small" id="guideReadout">'+readout+'</div>';
}