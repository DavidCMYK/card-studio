/** Persisted project schema (compatible with v1 Card Studio JSON files). */
export type ElementKind = 'text' | 'image' | 'shape';
export type Units = 'mm' | 'in' | 'px';
export interface CardElement {
  id: string; kind: ElementKind; name: string;
  x: number; y: number; w: number; h: number;
  locked: boolean; hidden: boolean;
  /** False for editor-only guides, bleed or cut lines. Missing means true for older projects. */
  includeInExport?: boolean;
  /** Text: hide the complete text element when the card's text value is blank. Defaults to true. */
  invisibleIfEmpty?: boolean;
  /** Shape/image: link visibility to the selected text element's ID. */
  linkedTextId?: string;
  shape: 'rect' | 'ellipse'; radius: number;
  fillMode: 'none' | 'solid' | 'gradient';
  fill1: string; fill2: string; gradientAngle: number;
  borderWidth: number; borderColor: string;
  /** Legacy overall opacity, retained for older project files. */
  opacity?: number;
  /** Independent component opacities in percent (0–100). */
  fillOpacity?: number; borderOpacity?: number; textOpacity?: number;
  text: string; font: string; fontSize: number; fontWeight: number;
  italic: boolean; underline: boolean; color: string;
  align: 'left' | 'center' | 'right'; valign: 'top' | 'middle' | 'bottom';
  lineHeight: number; letterSpacing: number;
  /** Auto-fit text separately along each axis. Missing means off (legacy compatibility). */
  autoWidth?: boolean; autoHeight?: boolean;
  /** Interior clearances in 96-DPI design pixels, excluding text but retaining fill/border. */
  gutterLeft?: number; gutterRight?: number; gutterTop?: number; gutterBottom?: number;
  imageFit: 'cover' | 'contain' | 'width' | 'height' | 'stretch' | 'free';
  imgScale: number; imgOffsetX: number; imgOffsetY: number;
  autoSet: string; autoMode: 'cycle' | 'sequence' | 'random';
}
export interface CardTemplate { name: string; width: number; height: number; unit: Units; dpi: number; background: string; elements: CardElement[]; }
export interface ImageAsset { name: string; data: string; }
export interface ImageSet { id: string; name: string; images: ImageAsset[]; }
export interface StagedCard { id: string; name: string; values: Record<string,string>; overrides: Record<string,Partial<CardElement>>; extraElements: CardElement[]; }
export interface StudioProject {
  type: 'cardstudio-project'; version: number; projectName: string;
  template: CardTemplate; sets: ImageSet[]; cards: StagedCard[];
  mode: 'template' | 'cards'; cardIndex: number; selected: string | null; zoom: number;
}
