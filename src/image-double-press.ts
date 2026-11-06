/** Mouse/touch-pointer double-press recognition for image frames, independent
 * of DOM nodes that may be replaced by redraws between the two presses. */
export interface ImagePress {id:string;x:number;y:number;at:number}
export const IMAGE_DOUBLE_PRESS_MS=600;
export const IMAGE_DOUBLE_PRESS_RADIUS=32;
export function isImageDoublePress(first:ImagePress|null,second:ImagePress):boolean{
 return !!first&&first.id===second.id&&second.at>=first.at&&
  second.at-first.at<=IMAGE_DOUBLE_PRESS_MS&&
  Math.hypot(second.x-first.x,second.y-first.y)<=IMAGE_DOUBLE_PRESS_RADIUS;
}
