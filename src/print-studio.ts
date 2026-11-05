import { S, safeFile, escapeHTML, assignedTemplate } from './model';
import {checkSetSize} from './project-collections';
import {trimDimensionsMm,guidesFor,guideRects} from './card-guides';
import { download } from './dom';
import { canvasCard } from './png-renderer';
import { checkpoint } from './history';
import { noteLiveEdit } from './recovery';
import { buildPrintPdf, PdfJpegPage } from './print-pdf';
import { PrintOptions, Duplex, DEFAULT_PRINT_OPTIONS, sheetLayout, paperDimensions, printSlot, calibrationScale, cardDimensionsMm, expandPrintCards, SheetLayout } from './print-layout';

type PrintableCard = typeof S.cards[number] & {printEnabled?:boolean;printQuantity?:number;printBack?:string};
let busy=false;
function options():PrintOptions {
 if(!S.printSetup)S.printSetup={...DEFAULT_PRINT_OPTIONS};
 return S.printSetup;
}
function selected(){return expandPrintCards(S.cards);}
function layout():SheetLayout {
 const indices=selected(),first=indices.length?assignedTemplate(indices[0],'front')||S.template:S.template;
 const dims=trimDimensionsMm(first);
 let bleed=options().bleed;
 for(const ci of indices){
  const front=assignedTemplate(ci,'front')||first;
  const size=trimDimensionsMm(front);
  if(Math.abs(size.width-dims.width)>0.01||Math.abs(size.height-dims.height)>0.01)
   throw Error('Selected card sets have different finished cut sizes. Print matching sizes in separate jobs.');
  const templates=[front,assignedTemplate(ci,'back')].filter(Boolean);
  for(const template of templates){
   const g=guidesFor(template!);
   if(g.bleedMode==='bleed')bleed=Math.max(bleed,...Object.values(g.bleed));
  }
 }
 return sheetLayout({...options(),bleed},dims.width,dims.height);
}
function mm(value:number){return String(Math.round(value*10)/10);}
function fmtCount(n:number){return n.toLocaleString('en-US');}
const styles=`<style>
#printModal{position:fixed;inset:0;z-index:15000;background:rgba(8,15,27,.76);display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;color:#e7eef8;font:14px system-ui,sans-serif}
#printModal *{box-sizing:border-box}
#printModal .pr-panel{width:min(1050px,100%);max-height:95vh;display:flex;flex-direction:column;background:#15263b;border:1px solid #48607d;border-radius:12px;box-shadow:0 16px 55px #0009;overflow:hidden}
#printModal .pr-head,#printModal .pr-foot{display:flex;align-items:center;gap:12px;padding:13px 17px;background:#1e344c;border-bottom:1px solid #46607d}
#printModal .pr-head strong{font-size:19px}
#printModal .pr-head button{margin-left:auto}
#printModal button{cursor:pointer;border:1px solid #607991;background:#253d55;color:white;border-radius:6px;padding:7px 11px}
#printModal button.primary{background:#1670b4;border-color:#4399d4;font-weight:600}
#printModal button:disabled{opacity:.5;cursor:wait}
#printModal .pr-body{display:grid;grid-template-columns:minmax(250px,.85fr) minmax(350px,1.15fr);gap:16px;overflow:auto;padding:17px}
#printModal h3{font-size:14px;margin:12px 0 9px;color:#d5e5f9}
#printModal h3:first-child{margin-top:0}
#printModal label{display:flex;align-items:center;gap:7px;min-height:30px}
#printModal label>span{flex:1}
#printModal input[type=number]{width:82px}
#printModal input[type=number],#printModal select,#printModal input[type=file]{background:#0e1c2c;color:white;border:1px solid #6a839d;border-radius:5px;padding:5px;max-width:100%}
#printModal .pr-small{font-size:12px;color:#bac9d9;line-height:1.45;margin:5px 0 12px}
#printModal .pr-rule{border:0;border-top:1px solid #3e536a;margin:12px 0}
#printModal .pr-cardlist{max-height:288px;overflow:auto;border:1px solid #49617b;border-radius:7px}
#printModal .pr-cardrow{display:grid;grid-template-columns:22px minmax(92px,1fr) 64px minmax(95px,1.15fr);align-items:center;gap:7px;padding:7px 8px;border-bottom:1px solid #364d63;font-size:12px}
#printModal .pr-cardrow:last-child{border-bottom:0}
#printModal .pr-cardrow input[type=number]{width:60px}
#printModal .pr-cardrow input[type=file]{font-size:10px;padding:3px;width:100%}
#printModal .pr-cardrow small{font-size:10px;color:#a4c5df}
#printModal .pr-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:7px 0}
#printModal .pr-row label{flex:1}
#printModal #prPreview{width:100%;max-height:310px;object-fit:contain;background:#0b1928;border:1px solid #415c79;border-radius:6px;display:none}
#printModal #prPreviewInfo{font-size:12px;color:#b9c9d8;padding:8px 0}
#printModal .pr-foot{border-bottom:0;border-top:1px solid #46607d;flex-wrap:wrap}
#printModal .pr-foot .pr-spacer{flex:1}
#printModal #prStatus{font-size:12px;color:#b7c9dd;min-width:140px}
@media(max-width:750px){#printModal{padding:5px}#printModal .pr-panel{max-height:99vh}#printModal .pr-body{grid-template-columns:minmax(0,1fr);padding:11px}#printModal .pr-cardrow{grid-template-columns:22px minmax(70px,1fr) 55px minmax(80px,.85fr);gap:4px}#printModal .pr-head,#printModal .pr-foot{padding:9px}}
</style>`;
function html():string {
 const o=options();
 const checked=(v:boolean)=>v?'checked':'';
 const paper=(id:string,label:string)=>'<option value="'+id+'" '+(o.paper===id?'selected':'')+'>'+label+'</option>';
 const back=(c:PrintableCard)=>c.printBack?'<small>Custom back loaded</small>':'';
 return styles+`<div id="printModal" role="presentation"><section class="pr-panel" role="dialog" aria-modal="true" aria-label="Print sheets">
 <header class="pr-head"><strong>Print sheets</strong><span>Card Studio</span><button type="button" data-print="close">Close</button></header>
 <div class="pr-body">
 <div>
 <h3>Paper and layout</h3>
 <label><span>Paper</span><select name="paper">${paper('a4','A4 (210 × 297 mm)')}${paper('letter','US Letter (8.5 × 11 in)')}${paper('custom','Custom')}</select></label>
 <label><span>Landscape</span><input type="checkbox" name="landscape" ${checked(o.landscape)}></label>
 <div id="prCustomDimensions" style="${o.paper==='custom'?'':'display:none'}"><label><span>Custom width (mm)</span><input type="number" name="customWidth" min="50" max="1000" step="0.1" value="${o.customWidth}"></label><label><span>Custom height (mm)</span><input type="number" name="customHeight" min="50" max="1000" step="0.1" value="${o.customHeight}"></label></div>
 <label><span>Paper margins (mm)</span><input type="number" name="margin" min="0" max="50" step="0.5" value="${o.margin}"></label>
 <label><span>Gap between cards (mm)</span><input type="number" name="gap" min="0" max="30" step="0.5" value="${o.gap}"></label>
 <label><span>Edge-extension bleed (mm)</span><input type="number" name="bleed" min="0" max="10" step="0.5" value="${o.bleed}" ${guidesFor(S.template).bleedMode==='bleed'?'disabled title="Bleed already included in template canvas"':''}></label>
 <label><span>Cut/crop marks</span><input type="checkbox" name="cropMarks" ${checked(o.cropMarks)}></label>
 <label><span>Print resolution</span><select name="dpi"><option value="150" ${o.dpi===150?'selected':''}>150 DPI (draft)</option><option value="300" ${o.dpi===300?'selected':''}>300 DPI</option></select></label>
 <p class="pr-small">${guidesFor(S.template).bleedMode==='bleed'?'The template canvas already contains genuine bleed. Crop marks follow the inset trim line.':'Optional edge extension repeats the outer pixels; it is not genuine artwork bleed.'} Print at <b>100% / actual size</b>.</p>
 <hr class="pr-rule">
 <h3>Card backs</h3>
 <label><span>Duplex</span><select name="duplex"><option value="none" ${o.duplex==='none'?'selected':''}>Fronts only</option><option value="long" ${o.duplex==='long'?'selected':''}>Fronts + backs (flip long edge)</option><option value="short" ${o.duplex==='short'?'selected':''}>Fronts + backs (flip short edge)</option></select></label>
 <h3>Duplex calibration</h3>
 <label><span>Back horizontal offset (mm)</span><input type="number" name="backOffsetX" min="-20" max="20" step="0.1" value="${o.backOffsetX??0}"></label>
 <label><span>Back vertical offset (mm)</span><input type="number" name="backOffsetY" min="-20" max="20" step="0.1" value="${o.backOffsetY??0}"></label>
 <div class="pr-row"><button type="button" data-print="calibration">Export calibration PDF</button><button type="button" data-print="reset-calibration">Reset offsets</button></div>
 <p class="pr-small">Print the two-page calibration PDF double-sided at <b>actual size</b>, using the selected flip mode. Look at the <b>FRONT</b> side against the light. On the numbered X and Y scales, read where the black lines printed on the back cross. Enter those numbers <b>directly</b> as the back offsets (not as adjustments to the previous values). The scale accounts for the duplex flip and any offsets already entered. Calibration moves back artwork, bleed and crop marks together.</p>
 <label><span>Shared back image</span><input type="file" data-print-file="shared" accept="image/png,image/jpeg,image/webp,image/gif"></label>
 <div class="pr-row"><small id="prSharedStatus">${o.sharedBack?'Shared back loaded':'No shared back'}</small><button type="button" data-print="remove-shared">Remove</button></div>
 <p class="pr-small">Assigned back templates render automatically. Per-card image backs override them; the shared image remains a fallback for sets without back templates. Duplex PDFs alternate front and back pages.</p>
 </div>
 <div>
 <h3>Cards to print</h3>
 <div class="pr-row"><button type="button" data-print="all">Select all</button><button type="button" data-print="none">Select none</button><small>Copies = number of printed copies</small></div>
 <div class="pr-cardlist">${S.cards.map((c:PrintableCard,i)=>`<div class="pr-cardrow"><input aria-label="Print ${escapeHTML(c.name)}" type="checkbox" data-pr-enabled="${i}" ${checked(c.printEnabled!==false)}><span title="${escapeHTML(c.name)}">${escapeHTML(c.name)}</span><input aria-label="Copies of ${escapeHTML(c.name)}" type="number" min="0" max="999" step="1" data-pr-quantity="${i}" value="${Math.max(0,Math.min(999,Number(c.printQuantity??1)||0))}"><div><input aria-label="Custom back for ${escapeHTML(c.name)}" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-pr-back="${i}">${back(c)}${c.printBack?` <button type="button" data-pr-clear-back="${i}">Clear</button>`:''}</div></div>`).join('')}</div>
 <div id="prSummary" class="pr-small"></div>
 <h3>Page preview</h3>
 <div class="pr-row"><button type="button" data-print="preview">Preview first front sheet</button><button type="button" data-print="preview-back">Preview first back sheet</button></div>
 <img id="prPreview" alt="Preview of the first print sheet"><div id="prPreviewInfo">Preview is generated on request.</div>
 </div></div>
 <footer class="pr-foot"><span id="prStatus"></span><span class="pr-spacer"></span><button type="button" class="primary" data-print="pdf">Export print PDF</button></footer>
 </section></div>`;
}
function showSummary() {
 const modal=document.querySelector('#printModal');if(!modal)return;
 const entries=selected(),info=modal.querySelector('#prSummary') as HTMLElement;
 try{
  const l=layout(),sheets=Math.ceil(entries.length/l.perPage),pages=sheets*(options().duplex==='none'?1:2);
  info.textContent=fmtCount(entries.length)+' copies · '+l.columns+' × '+l.rows+' cards/page · '+sheets+' sheet(s) · '+pages+' PDF page(s). Cards: '+mm(l.cardWidth)+' × '+mm(l.cardHeight)+' mm.';
 }catch(err){info.textContent=(err as Error).message;}
 (modal.querySelector('#prCustomDimensions') as HTMLElement).style.display=options().paper==='custom'?'':'none';
 const extension=modal.querySelector<HTMLInputElement>('[name="bleed"]');
 if(extension)extension.disabled=guidesFor(S.template).bleedMode==='bleed';
 const status=modal.querySelector('#prSharedStatus');if(status)status.textContent=options().sharedBack?'Shared back loaded':'No shared back';
}
function changed(){noteLiveEdit();checkpoint();showSummary();}
function updateField(target:HTMLInputElement|HTMLSelectElement){
 const name=target.name;
 if(!name)return;
 const o=options(),value=target.type==='checkbox'?(target as HTMLInputElement).checked:target.value;
 if(name==='paper' && ['a4','letter','custom'].includes(String(value)))o.paper=value as PrintOptions['paper'];
 else if(name==='landscape'||name==='cropMarks')o[name]=Boolean(value);
 else if(name==='duplex'&&['none','long','short'].includes(String(value)))o.duplex=value as Duplex;
 else if(name==='dpi')o.dpi=Number(value)===150?150:300;
 else if(name==='backOffsetX'||name==='backOffsetY'){
  const n=Number(value);if(!Number.isFinite(n))return;
  o[name]=Math.round(Math.max(-20,Math.min(20,n))*100)/100;
  target.value=String(o[name]);
 }
 else if(['customWidth','customHeight','margin','gap','bleed'].includes(name)){
  const n=Number(value);if(!Number.isFinite(n))return;
  (o as any)[name]=Math.max(name.startsWith('custom')?50:0,Math.min(1000,n));
 }
 changed();
}
const readFile=(file:File):Promise<string>=>new Promise((resolve,reject)=>{
 if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))return reject(Error('Choose a PNG, JPG, WebP or GIF image'));
 if(file.size>20_000_000)return reject(Error('Back images must be smaller than 20 MB'));
 const reader=new FileReader();reader.onerror=()=>reject(Error('Unable to read image'));
 reader.onload=()=>resolve(String(reader.result));reader.readAsDataURL(file);
});
const imageMemo=new Map<string,Promise<HTMLImageElement>>();
function loadBack(src:string):Promise<HTMLImageElement>{
 if(!imageMemo.has(src))imageMemo.set(src,new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not decode a card back image'));
  image.src=src;
 }));
 return imageMemo.get(src)!;
}
function cover(ctx:CanvasRenderingContext2D,image:CanvasImageSource,width:number,height:number){
 const iw=(image as HTMLImageElement).naturalWidth||(image as HTMLCanvasElement).width;
 const ih=(image as HTMLImageElement).naturalHeight||(image as HTMLCanvasElement).height;
 const scale=Math.max(width/iw,height/ih),sw=width/scale,sh=height/scale;
 ctx.drawImage(image,(iw-sw)/2,(ih-sh)/2,sw,sh,0,0,width,height);
}
function drawCard(ctx:CanvasRenderingContext2D,image:CanvasImageSource,x:number,y:number,w:number,h:number,b:number){
 const tile=document.createElement('canvas');tile.width=Math.max(1,Math.round(w));tile.height=Math.max(1,Math.round(h));
 cover(tile.getContext('2d')!,image,tile.width,tile.height);
 if(b>0){
  const tw=tile.width,th=tile.height;
  // Extend the edge pixel outward without shrinking the original trim artwork.
  ctx.drawImage(tile,0,0,1,th,x-b,y,b,h);
  ctx.drawImage(tile,tw-1,0,1,th,x+w,y,b,h);
  ctx.drawImage(tile,0,0,tw,1,x,y-b,w,b);
  ctx.drawImage(tile,0,th-1,tw,1,x,y+h,w,b);
  ctx.drawImage(tile,0,0,1,1,x-b,y-b,b,b);
  ctx.drawImage(tile,tw-1,0,1,1,x+w,y-b,b,b);
  ctx.drawImage(tile,0,th-1,1,1,x-b,y+h,b,b);
  ctx.drawImage(tile,tw-1,th-1,1,1,x+w,y+h,b,b);
 }
 ctx.drawImage(tile,x,y,w,h);
}
function cutMarks(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,bleed:number,scale:number){
 const start=bleed+.25*scale,length=1.2*scale;
 ctx.save();ctx.strokeStyle='#222';ctx.lineWidth=Math.max(.5,.14*scale);ctx.beginPath();
 for(const [cx,cy,sx,sy] of [[x,y,-1,-1],[x+w,y,1,-1],[x,y+h,-1,1],[x+w,y+h,1,1]]){
  ctx.moveTo(cx+sx*start,cy);ctx.lineTo(cx+sx*(start+length),cy);
  ctx.moveTo(cx,cy+sy*start);ctx.lineTo(cx,cy+sy*(start+length));
 }
 ctx.stroke();ctx.restore();
}
async function renderSheet(sheetIndex:number,side:'front'|'back',dpi:number,entries:number[],l:SheetLayout,fronts:Map<number,HTMLCanvasElement>):Promise<HTMLCanvasElement>{
 const canvas=document.createElement('canvas');
 const scale=dpi/25.4;
 canvas.width=Math.round(l.width*scale);canvas.height=Math.round(l.height*scale);
 if(canvas.width>10000||canvas.height>10000||canvas.width*canvas.height>40000000)throw Error('Paper size or resolution is too large');
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('2D drawing is not supported');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 const start=sheetIndex*l.perPage;
 for(let i=0;i<l.perPage&&start+i<entries.length;i++){
  const ci=entries[start+i],card=S.cards[ci] as PrintableCard;
  const original=l.slots[i];const position=printSlot(l,original,side,options());
  const x=position.x*scale,y=position.y*scale,w=l.cardWidth*scale,h=l.cardHeight*scale;
  let art:CanvasImageSource;
  if(side==='front'){
   if(!fronts.has(ci))fronts.set(ci,await canvasCard(ci,'cards'));
   art=fronts.get(ci)!;
  }else{
   const backTemplate=assignedTemplate(ci,'back');
   const url=card.printBack||(!backTemplate?options().sharedBack:undefined);
   if(url)art=await loadBack(url);
   else if(backTemplate)art=await canvasCard(ci,'cards','back');
   else throw Error('Missing back for card: '+card.name);
  }
  const template=side==='back'&&!card.printBack&&assignedTemplate(ci,'back')?assignedTemplate(ci,'back')!:assignedTemplate(ci,'front')||S.template;
  const guides=guideRects(template);
  if(guides.settings.bleedMode==='bleed'){
   const b=guides.bleed,fullW=w+(b.left+b.right)*scale,fullH=h+(b.top+b.bottom)*scale;
   ctx.save();ctx.translate(x-b.left*scale,y-b.top*scale);
   cover(ctx,art,fullW,fullH);
   ctx.restore();
  }else drawCard(ctx,art,x,y,w,h,options().bleed*scale);
  if(options().cropMarks){
   const cropBleed=guides.settings.bleedMode==='bleed'?Math.max(...Object.values(guides.bleed)):options().bleed;
   cutMarks(ctx,x,y,w,h,cropBleed*scale,scale);
  }
 }
 return canvas;
}
/** Print a two-page target grid without any card assets. Matching crosses and
 * trim outlines are imposed with the exact geometry used for real prints. */
/** Two compact numbered rulers on the FRONT, and perpendicular reference
 * lines on the BACK. The ruler marks account for duplex flip orientation and
 * currently saved offsets. Reading a back line through the paper yields the
 * absolute correction value, never an incremental change. */
function renderCalibrationPage(side:'front'|'back',dpi:number,l:{width:number;height:number}):HTMLCanvasElement{
 const scale=dpi/25.4,canvas=document.createElement('canvas');
 canvas.width=Math.round(l.width*scale);canvas.height=Math.round(l.height*scale);
 if(canvas.width>10000||canvas.height>10000||canvas.width*canvas.height>40000000)
  throw Error('Paper size or resolution is too large');
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('2D drawing is not supported');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 const rulerX=calibrationScale(l,options(),'x'),rulerY=calibrationScale(l,options(),'y');
 ctx.fillStyle='#202b3b';ctx.font=Math.max(10,3.1*scale)+'px sans-serif';
 ctx.fillText(side==='front'?'FRONT — read numbered scales':'BACK — reference lines',5*scale,8*scale);
 if(side==='back'){
  // Each black line crosses its associated front-page ruler. X has a vertical
  // indicator; Y has a horizontal indicator. Use a heavy line so it is
  // visible through ordinary printing paper held against a light.
  ctx.strokeStyle='#111';ctx.lineWidth=Math.max(2,.65*scale);
  ctx.beginPath();
  ctx.moveTo(rulerX.backReference.x*scale,(rulerX.backReference.y-24)*scale);
  ctx.lineTo(rulerX.backReference.x*scale,(rulerX.backReference.y+24)*scale);
  ctx.moveTo((rulerY.backReference.x-24)*scale,rulerY.backReference.y*scale);
  ctx.lineTo((rulerY.backReference.x+24)*scale,rulerY.backReference.y*scale);
  ctx.stroke();
  return canvas;
 }
 ctx.fillStyle='#202b3b';ctx.strokeStyle='#202b3b';
 ctx.textBaseline='middle';
 for(const ruler of [rulerX,rulerY]){
  const ticks=ruler.ticks;
  ctx.lineWidth=Math.max(.7,.15*scale);
  ctx.beginPath();
  if(ruler.axis==='x'){
   ctx.moveTo(ticks[0].x*scale,ruler.origin.y*scale);
   ctx.lineTo(ticks[ticks.length-1].x*scale,ruler.origin.y*scale);
  }else{
   ctx.moveTo(ruler.origin.x*scale,ticks[0].y*scale);
   ctx.lineTo(ruler.origin.x*scale,ticks[ticks.length-1].y*scale);
  }
  for(const tick of ticks){
   const major=tick.labeled,half=tick.value%1===0;
   const h=(major?1.6:half?1.0:.55)*scale;
   if(ruler.axis==='x'){
    ctx.moveTo(tick.x*scale,tick.y*scale-h);
    ctx.lineTo(tick.x*scale,tick.y*scale+h);
   }else{
    ctx.moveTo(tick.x*scale-h,tick.y*scale);
    ctx.lineTo(tick.x*scale+h,tick.y*scale);
   }
  }
  ctx.stroke();
  ctx.font=Math.max(8,1.75*scale)+'px sans-serif';
  for(const tick of ticks.filter(t=>t.labeled)){
   const label=tick.value>0?'+'+tick.value:String(tick.value);
   const odd=Math.abs(tick.value/2)%2===1;
   if(ruler.axis==='x'){
    ctx.textAlign='center';
    ctx.fillText(label,tick.x*scale,(tick.y+(odd?-5.3:5.3))*scale);
   }else{
    ctx.textAlign=odd?'right':'left';
    ctx.fillText(label,(tick.x+(odd?-3:3))*scale,tick.y*scale);
   }
  }
  ctx.font=Math.max(10,2.5*scale)+'px sans-serif';
  ctx.textAlign='center';
  if(ruler.axis==='x')
   ctx.fillText('X offset (mm)',ruler.origin.x*scale,(ruler.origin.y-18)*scale);
  else{
   ctx.textAlign='left';
   ctx.fillText('Y offset (mm)',(ruler.origin.x+27)*scale,ruler.origin.y*scale);
  }
 }
 ctx.textAlign='left';ctx.textBaseline='alphabetic';
 ctx.font=Math.max(10,2.6*scale)+'px sans-serif';
 ctx.fillText('Hold to light, FRONT facing you. Enter the numbers crossed by the BACK lines.',5*scale,14*scale);
 return canvas;
}
/** The calibration job has two small measured axes, independent of project card
 * count, dimensions and image assets. It always emits two PDF pages. */
export function buildDuplexCalibrationPdf(l:{width:number;height:number},dpi:number):Blob{
 if(options().duplex==='none')throw Error('Choose long-edge or short-edge duplex to calibrate');
 const pages:PdfJpegPage[]=[];
 for(const side of ['front','back'] as const){
  const sheet=renderCalibrationPage(side,dpi,l);
  pages.push({jpeg:jpegBytes(sheet),pixelWidth:sheet.width,pixelHeight:sheet.height,widthMm:l.width,heightMm:l.height});
 }
 return buildPrintPdf(pages);
}
function jpegBytes(canvas:HTMLCanvasElement):Uint8Array{
 const b64=canvas.toDataURL('image/jpeg',.96).split(',')[1];
 const binary=atob(b64),arr=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)arr[i]=binary.charCodeAt(i);
 return arr;
}
function assertReady(entries:number[]){
 if(!entries.length)throw Error('Select at least one card and set its copies to 1 or more');
 if(entries.length>5000)throw Error('Too many copies for one job (maximum 5000)');
 const l=layout();
 for(const ci of entries){
  const set=S.cardSets?.find(x=>x.id===S.cards[ci]?.setId);
  if(set&&!checkSetSize(set))throw Error('Front and back templates in "'+set.name+'" must have matching cut sizes');
 }
 if(options().duplex!=='none'){
  const missing=entries.find(i=>!(S.cards[i] as PrintableCard).printBack&&!assignedTemplate(i,'back')&&!options().sharedBack);
  if(missing!==undefined)throw Error('Assign a back template or back image for '+S.cards[missing].name);
 }
 return l;
}
async function runPrint(previewSide?:'front'|'back',calibration=false){
 if(busy)return;
 const root=document.querySelector('#printModal') as HTMLElement|null;if(!root)return;
 const status=root.querySelector('#prStatus') as HTMLElement;
 const buttons=root.querySelectorAll<HTMLButtonElement>('button');
 const inputs=root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select');
 busy=true;buttons.forEach(b=>b.disabled=true);inputs.forEach(i=>i.disabled=true);
 try{
  if(calibration){
   status.textContent='Building duplex registration targets…';
   download(buildDuplexCalibrationPdf(paperDimensions(options()),options().dpi),safeFile(S.projectName)+'_duplex_calibration.pdf');
   status.textContent='Two-page calibration PDF downloaded';
   return;
  }
  const entries=selected(),l=assertReady(entries);
  if(previewSide==='back'&&options().duplex==='none')throw Error('Choose a duplex mode to preview backs');
  const fronts=new Map<number,HTMLCanvasElement>();
  if(previewSide){
   status.textContent='Rendering preview…';
   const sheet=await renderSheet(0,previewSide,90,entries,l,fronts);
   const img=root.querySelector('#prPreview') as HTMLImageElement;
   img.src=sheet.toDataURL('image/jpeg',.85);img.style.display='block';
   (root.querySelector('#prPreviewInfo') as HTMLElement).textContent=previewSide==='front'?'Front sheet 1':'Back sheet 1 (back PDF page; calibration applied)';
  }else{
   const pages:PdfJpegPage[]=[],numSheets=Math.ceil(entries.length/l.perPage);
   for(let index=0;index<numSheets;index++){
    for(const side of (options().duplex==='none'?['front']:['front','back']) as Array<'front'|'back'>){
     status.textContent='Rendering '+side+' '+(index+1)+' / '+numSheets+'…';
     const sheet=await renderSheet(index,side,options().dpi,entries,l,fronts);
     pages.push({jpeg:jpegBytes(sheet),pixelWidth:sheet.width,pixelHeight:sheet.height,widthMm:l.width,heightMm:l.height});
     fronts.clear(); // Bound canvas memory to one sheet, even for large decks.
     await new Promise(resolve=>setTimeout(resolve,0));
    }
   }
   status.textContent='Building PDF…';
   download(buildPrintPdf(pages),safeFile(S.projectName)+'_print_sheets.pdf');
   status.textContent='PDF downloaded ('+pages.length+' pages)';
  }
 }catch(err){status.textContent=(err as Error).message;alert('Print sheets: '+(err as Error).message);}
 finally{busy=false;buttons.forEach(b=>b.disabled=false);inputs.forEach(i=>i.disabled=false);showSummary();}
}
export function openPrintStudio(){
 imageMemo.clear();
 const holder=document.querySelector('#dialogHolder');if(!holder)return;
 holder.innerHTML=html();
 const root=holder.querySelector('#printModal') as HTMLElement;
 root.addEventListener('click',e=>{
  const t=e.target as HTMLElement;
  if(t===root){if(!busy)holder.innerHTML='';return;}
  const clear=t.closest<HTMLElement>('[data-pr-clear-back]');
  if(clear){const i=Number(clear.dataset.prClearBack);(S.cards[i] as PrintableCard).printBack=undefined;changed();root.querySelector(`[data-pr-back="${i}"]`)?.parentElement?.querySelector('small')?.remove();clear.remove();return;}
  const act=t.closest<HTMLElement>('[data-print]')?.dataset.print;
  if(!act)return;
  if(act==='close'){if(!busy)holder.innerHTML='';return;}
  if(act==='remove-shared'){options().sharedBack=undefined;changed();return;}
  if(act==='reset-calibration'){
   options().backOffsetX=0;options().backOffsetY=0;
   (root.querySelector('[name="backOffsetX"]') as HTMLInputElement).value='0';
   (root.querySelector('[name="backOffsetY"]') as HTMLInputElement).value='0';
   changed();return;
  }
  if(act==='all'||act==='none'){
   S.cards.forEach(c=>(c as PrintableCard).printEnabled=act==='all');
   root.querySelectorAll<HTMLInputElement>('[data-pr-enabled]').forEach(el=>el.checked=act==='all');changed();return;
  }
  if(act==='pdf'||act==='preview'||act==='preview-back'||act==='calibration')
   void runPrint(act==='preview'?'front':act==='preview-back'?'back':undefined,act==='calibration');
 });
 root.addEventListener('change',async e=>{
  const t=e.target as HTMLInputElement;
  if(t.dataset.prEnabled!==undefined){(S.cards[Number(t.dataset.prEnabled)] as PrintableCard).printEnabled=t.checked;changed();return;}
  if(t.dataset.prQuantity!==undefined){const num=Number(t.value);const qty=Number.isFinite(num)?Math.max(0,Math.min(999,Math.floor(num))):0;(S.cards[Number(t.dataset.prQuantity)] as PrintableCard).printQuantity=qty;t.value=String(qty);changed();return;}
  if(t.dataset.printFile==='shared'&&t.files?.[0]){
   try{options().sharedBack=await readFile(t.files[0]);changed();}catch(err){alert((err as Error).message);}return;
  }
  if(t.dataset.prBack!==undefined&&t.files?.[0]){
   const i=Number(t.dataset.prBack);
   try{(S.cards[i] as PrintableCard).printBack=await readFile(t.files[0]);changed();
    const owner=t.parentElement!;let note=owner.querySelector('small');if(!note){note=document.createElement('small');owner.append(note);}note.textContent='Custom back loaded';
    if(!owner.querySelector('[data-pr-clear-back]')){
     const clear=document.createElement('button');clear.type='button';clear.dataset.prClearBack=String(i);clear.textContent='Clear';owner.append(clear);
    }
   }catch(err){alert((err as Error).message);}return;
  }
  if(t.name)updateField(t);
 });
 showSummary();
}