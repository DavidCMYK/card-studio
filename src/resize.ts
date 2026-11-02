/** Pure resize geometry: each pointer move is calculated from the rectangle at pointerdown. */
export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export interface Rect { x: number; y: number; w: number; h: number }
export interface ResizeLimits { w: number; h: number }
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(n, b));
const precision = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Opposite edges/corners stay anchored. Side handles track the pointer directly.
 * For corner aspect-lock, the pointer delta is projected onto the original
 * rectangle's aspect-ratio diagonal (the nearest constrained handle position).
 * No previously computed rectangle is used as a new drag origin.
 */
export function resizedRect(start: Rect, handle: ResizeHandle, dx: number, dy: number, stage: ResizeLimits, lockCornerAspect = false): Rect {
  const west = handle.includes('w'), east = handle.includes('e');
  const north = handle.includes('n'), south = handle.includes('s');
  const right = start.x + start.w, bottom = start.y + start.h;
  const minSize = 5;
  const minLeft = -start.w + 4, minTop = -start.h + 4;
  const maxRight = stage.w * 3, maxBottom = stage.h * 3;

  if (lockCornerAspect && (west || east) && (north || south) && start.w > 0 && start.h > 0) {
    const dw = (east ? 1 : -1) * dx;
    const dh = (south ? 1 : -1) * dy;
    // Orthogonal projection onto the scale direction. This handles drags in
    // either direction, including reversing before pointerup, without drift.
    const scaleDelta = (start.w * dw + start.h * dh) / (start.w * start.w + start.h * start.h);
    const widthLimit = east ? maxRight - start.x : right - minLeft;
    const heightLimit = south ? maxBottom - start.y : bottom - minTop;
    const minScale = Math.max(minSize / start.w, minSize / start.h);
    const maxScale = Math.max(minScale, Math.min(widthLimit / start.w, heightLimit / start.h));
    const scale = clamp(1 + scaleDelta, minScale, maxScale);
    const width = start.w * scale, height = start.h * scale;
    return { x: precision(west ? right - width : start.x), y: precision(north ? bottom - height : start.y), w: precision(width), h: precision(height) };
  }

  let left = start.x, top = start.y, r = right, b = bottom;
  if (west) left = clamp(start.x + dx, minLeft, right - minSize);
  if (east) r = clamp(right + dx, start.x + minSize, maxRight);
  if (north) top = clamp(start.y + dy, minTop, bottom - minSize);
  if (south) b = clamp(bottom + dy, start.y + minSize, maxBottom);
  return { x: precision(left), y: precision(top), w: precision(r - left), h: precision(b - top) };
}

/** Preserve image/frame proportions only for fit modes when a corner is dragged. */
export function locksImageCornerAspect(kind: string, fit: string, handle: string): boolean {
  return kind === 'image' && /^(nw|ne|sw|se)$/.test(handle) &&
    ['contain', 'cover', 'width', 'height'].includes(fit);
}
