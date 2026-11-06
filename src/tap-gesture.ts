/** Shared tablet/phone tap thresholds. Pointer events remain reliable when
 * renderStage replaces the layer under a finger or stylus between taps. */
export type TapPoint={x:number;y:number};
export type TapRecord={id:string;point:TapPoint;time:number};
export const DOUBLE_TAP_MS=600;
export const DOUBLE_TAP_RADIUS_PX=48;
export const TAP_MOVE_SLOP_PX=18;
export const MAX_TAP_DURATION_MS=700;
export const isDirectTouchPointer=(kind:string)=>kind==='touch'||kind==='pen';
export const tapDistance=(a:TapPoint,b:TapPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
export function matchesDoubleTap(previous:TapRecord|null,next:TapRecord):boolean{
 return !!previous&&previous.id===next.id&&next.time>=previous.time&&
  next.time-previous.time<=DOUBLE_TAP_MS&&
  tapDistance(previous.point,next.point)<=DOUBLE_TAP_RADIUS_PX;
}
export const wasTapMoved=(start:TapPoint,current:TapPoint)=>
 tapDistance(start,current)>TAP_MOVE_SLOP_PX;
