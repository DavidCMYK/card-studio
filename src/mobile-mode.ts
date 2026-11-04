export type EditorLayout = 'desktop' | 'mobile';
export function chooseEditorLayout(width:number, coarsePointer:boolean, saved:EditorLayout|null=null):EditorLayout {
  if(saved==='mobile'||saved==='desktop')return saved;
  return width<=700||(coarsePointer&&width<=1180)?'mobile':'desktop';
}
export function fitCardZoom(viewWidth:number,viewHeight:number,cardWidth:number,cardHeight:number):number {
  if(![viewWidth,viewHeight,cardWidth,cardHeight].every(Number.isFinite)||cardWidth<=0||cardHeight<=0)return 1;
  return Math.min(3,Math.max(.3,Math.min((viewWidth-42)/cardWidth,(viewHeight-48)/cardHeight)));
}
