/** Physical print imposition. All geometry and placement are in millimetres. */
export type Paper = 'a4' | 'letter' | 'custom';
export type Duplex = 'none' | 'long' | 'short';
export interface PrintOptions {
  paper: Paper;
  landscape: boolean;
  customWidth: number;
  customHeight: number;
  margin: number;
  gap: number;
  bleed: number;
  cropMarks: boolean;
  dpi: 150 | 300;
  duplex: Duplex;
  /** Signed offset applied to the back PDF page after duplex mirroring (millimetres). */
  backOffsetX?: number;
  backOffsetY?: number;
  sharedBack?: string;
}
export interface Slot { x: number; y: number; col: number; row: number; }
export interface SheetLayout {
  width: number;
  height: number;
  columns: number;
  rows: number;
  perPage: number;
  pad: number;
  cardWidth: number;
  cardHeight: number;
  slots: Slot[];
}
export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  paper:'a4', landscape:false, customWidth:210,customHeight:297,
  margin:4,gap:1,bleed:0,cropMarks:true,dpi:300,duplex:'none',backOffsetX:0,backOffsetY:0
};
export function cardDimensionsMm(template:{width:number;height:number;unit:string;dpi:number}) {
  const factor=template.unit==='mm'?1:template.unit==='in'?25.4:25.4/template.dpi;
  return {width:template.width*factor,height:template.height*factor};
}
export function paperDimensions(opts:PrintOptions):{width:number;height:number}{
 const paper=opts.paper==='a4'?[210,297]:opts.paper==='letter'?[215.9,279.4]:[opts.customWidth,opts.customHeight];
 const width=opts.landscape?paper[1]:paper[0],height=opts.landscape?paper[0]:paper[1];
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
  throw Error('Invalid paper dimensions');
 return {width,height};
}
export function sheetLayout(opts:PrintOptions, cardWidth:number, cardHeight:number):SheetLayout {
  const {width,height}=paperDimensions(opts);
  const valid=[width,height,cardWidth,cardHeight,opts.margin,opts.gap,opts.bleed].every(Number.isFinite);
  if(!valid||width<=0||height<=0||cardWidth<=0||cardHeight<=0||opts.margin<0||opts.gap<0||opts.bleed<0)throw Error('Invalid paper or spacing dimensions');
  // Reserve enough space for marks beyond the edge-extended bleed.
  const pad=opts.cropMarks?opts.bleed+1.5:opts.bleed;
  const stepW=cardWidth+2*pad+opts.gap,stepH=cardHeight+2*pad+opts.gap;
  const columns=Math.floor((width-2*opts.margin+opts.gap)/stepW);
  const rows=Math.floor((height-2*opts.margin+opts.gap)/stepH);
  if(columns<1||rows<1)throw Error('No cards fit on the paper. Reduce margin, gap, bleed or card dimensions.');
  const occupiedW=columns*(cardWidth+2*pad)+(columns-1)*opts.gap;
  const occupiedH=rows*(cardHeight+2*pad)+(rows-1)*opts.gap;
  const x0=(width-occupiedW)/2+pad,y0=(height-occupiedH)/2+pad;
  const slots:Slot[]=[];
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    slots.push({col,row,x:x0+col*stepW,y:y0+row*stepH});
  }
  return {width,height,columns,rows,perPage:columns*rows,pad,cardWidth,cardHeight,slots};
}
/** Coordinate of the matching back when the printed sheet is flipped over. */
function duplexMirrorsX(layout:{width:number;height:number},duplex:Duplex):boolean {
 return duplex!=='none'&&(duplex==='long')!==(layout.width>layout.height);
}
export function backSlot(layout:SheetLayout,front:Slot,duplex:Duplex):Slot {
  if(duplex==='none')return front;
  const mirrorX=duplexMirrorsX(layout,duplex);
  return {...front,x:mirrorX?layout.width-front.x-layout.cardWidth:front.x,
    y:mirrorX?front.y:layout.height-front.y-layout.cardHeight};
}
/** Final position on a PDF page. Positive X moves right; positive Y moves down
 * when viewed on the BACK PDF page (after the printer's chosen flip). Fronts
 * and page layout are never changed by duplex calibration. */
export function printSlot(layout:SheetLayout,front:Slot,side:'front'|'back',opts:PrintOptions):Slot{
 if(side==='front')return {...front};
 const x=opts.backOffsetX??0,y=opts.backOffsetY??0;
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>20||Math.abs(y)>20)
  throw Error('Back calibration offsets must be between -20 and 20 mm');
 const slot=backSlot(layout,front,opts.duplex);
 return {...slot,x:slot.x+x,y:slot.y+y};
}
/** The calibration ruler is read from the FRONT of a duplex-printed sheet,
 * held against the light. Its labels are absolute back-page offsets in mm:
 * where the back indicator crosses the ruler is the value to enter directly.
 * The scale compensates for both the duplex flip and an existing saved offset.
 */
export type CalibrationAxis='x'|'y';
export interface CalibrationTick {
 value:number; x:number; y:number; labeled:boolean;
}
export interface CalibrationScale {
 axis:CalibrationAxis;
 origin:{x:number;y:number};
 ticks:CalibrationTick[];
 /** Reference mark coordinates on the BACK PDF page (not the front view). */
 backReference:{x:number;y:number};
}
export function calibrationScale(l:{width:number;height:number},opts:PrintOptions,axis:CalibrationAxis):CalibrationScale {
 if(opts.duplex==='none')throw Error('Select duplex printing before calibration');
 const xOffset=opts.backOffsetX??0,yOffset=opts.backOffsetY??0;
 if(!Number.isFinite(xOffset)||!Number.isFinite(yOffset)||
  Math.abs(xOffset)>20||Math.abs(yOffset)>20)throw Error('Back calibration offsets must be between -20 and 20 mm');
 const mirrorX=duplexMirrorsX(l,opts.duplex);
 const signX=mirrorX?-1:1,signY=mirrorX?1:-1;
 // A4/Letter: two clearly separated compact rulers, one horizontal and one
 // vertical. On narrow paper, stack them instead of pushing them off the side.
 const sideBySide=l.width>=160;
 const origin=sideBySide?
  {x:l.width/2+(axis==='x'?-45:45),y:l.height/2}:
  {x:l.width/2,y:l.height/2+(axis==='x'?-36:36)};
 const offset=axis==='x'?xOffset:yOffset,sign=axis==='x'?signX:signY;
 const ticks:CalibrationTick[]=[];
 // Calibrates the full +/-20 mm input range. Subdivide every 0.5 mm;
 // a labelled 2 mm mark appears every fourth tick.
 for(let i=-40;i<=40;i++){
  const value=i/2,delta=sign*(offset-value);
  ticks.push({
   value,x:origin.x+(axis==='x'?delta:0),
   y:origin.y+(axis==='y'?delta:0),
   labeled:i%4===0
  });
 }
 // Isolate X and Y: the perpendicular correction is deliberately not applied
 // to each reference mark, so its ruler still crosses after large changes to
 // the other axis. Actual card backs still receive BOTH offsets.
 const backReference=axis==='x'?
  {x:(mirrorX?l.width-origin.x:origin.x)+xOffset,
   y:mirrorX?origin.y:l.height-origin.y}:
  {x:mirrorX?l.width-origin.x:origin.x,
   y:(mirrorX?origin.y:l.height-origin.y)+yOffset};
 return {axis,origin,ticks,backReference};
}
export function expandPrintCards(cards:ReadonlyArray<{printEnabled?:boolean;printQuantity?:number}>):number[]{
  const result:number[]=[];
  cards.forEach((card,index)=>{
    if(card.printEnabled===false)return;
    const qty=Math.max(0,Math.min(999,Math.floor(Number(card.printQuantity??1))||0));
    for(let n=0;n<qty;n++)result.push(index);
  });
  return result;
}