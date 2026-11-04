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
 '<div class="small" style="padding:0 0 9px">Cut size stays fixed when changing bleed or canvas size. Changing bleed expands/shrinks the canvas; changing canvas recalculates bleed. Changing the bleed mode adds/removes the configured bleed from the canvas. Existing artwork coordinates are never changed.</div>'+
 selectionField('Guide distance units','guide.unit',[
  ['mm','Millimetres (mm)'],['in','Inches (in)'],['px','Pixels (at template DPI)']],u)+
 sideInputs('bleed')+
 '<div class="small" style="padding:0 0 9px">'+(g.bleedMode==='bleed'?'Bleed changes the canvas (cut size is locked) and is included in PDF artwork.':'Changing bleed automatically switches to canvas-includes-bleed mode.')+'</div>'+
 sideInputs('safe')+
 '<div class="small" style="padding:0 0 8px">Safety buffer is measured inward from the cut line. Change either the buffers here or Safe-zone width/height in Dimensions; neither changes the finished cut size.</div>'+
 '<div class="section-title">Corner rounding</div>'+
 field('Canvas edge radius ('+u+')','guide.radius.canvas',displayedDistance(g.radii!.canvas,u,dpi),'number','min="0" step="any"')+
 field('Cut line radius ('+u+')','guide.radius.cut',displayedDistance(g.radii!.cut,u,dpi),'number','min="0" step="any"')+
 field('Safe-zone radius ('+u+')','guide.radius.safe',displayedDistance(g.radii!.safe,u,dpi),'number','min="0" step="any"')+
 '<div class="small" style="padding:0 0 9px">Independent radii for each boundary, measured in the guide units selected above. When there is no bleed, the canvas edge is the cut line, so its corner rounding uses the cut-line radius. Guides do not crop exported artwork.</div>'+
 checkbox('Show guides in Template mode','guide.showTemplate',g.showTemplate)+
 checkbox('Show guides in Cards mode','guide.showCards',g.showCards)+
 checkbox('Dim outside the safe area','guide.dimUnsafe',g.dimUnsafe)+
 '<div class="small" id="guideReadout">'+readout+'</div>';
}