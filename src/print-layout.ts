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
  margin:4,gap:1,bleed:0,cropMarks:true,dpi:300,duplex:'none'
};
export function cardDimensionsMm(template:{width:number;height:number;unit:string;dpi:number}) {
  const factor=template.unit==='mm'?1:template.unit==='in'?25.4:25.4/template.dpi;
  return {width:template.width*factor,height:template.height*factor};
}
export function sheetLayout(opts:PrintOptions, cardWidth:number, cardHeight:number):SheetLayout {
  const paper=opts.paper==='a4'?[210,297]:opts.paper==='letter'?[215.9,279.4]:[opts.customWidth,opts.customHeight];
  const width=opts.landscape?paper[1]:paper[0],height=opts.landscape?paper[0]:paper[1];
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
export function backSlot(layout:SheetLayout,front:Slot,duplex:Duplex):Slot {
  if(duplex==='none')return front;
  const mirrorX=(duplex==='long')!== (layout.width>layout.height);
  return {...front,x:mirrorX?layout.width-front.x-layout.cardWidth:front.x,
    y:mirrorX?front.y:layout.height-front.y-layout.cardHeight};
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