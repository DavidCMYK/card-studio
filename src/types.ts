/** Persisted project schema (compatible with v1 Card Studio JSON files). */
export type ElementKind = 'text' | 'image' | 'shape';
export type Units = 'mm' | 'in' | 'px';
export interface CardElement {
  id: string; kind: ElementKind; name: string;
  x: number; y: number; w: number; h: number;
  locked: boolean; hidden: boolean;
  /** False for editor-only guides, bleed or cut lines. Missing means true for older projects. */
  includeInExport?: boolean;
  /** Include this element's card data in XLSX exports. Missing means true for older projects. */
  includeInDataExport?: boolean;
  /** Text: hide the complete text element when the card's text value is blank. Defaults to true. */
  invisibleIfEmpty?: boolean;
  /** Shape/image: link visibility to the selected text element's ID. */
  linkedTextId?: string;
  /** Optional positional/size anchors to the linked text box. */
  anchorLeft?: boolean; anchorRight?: boolean; anchorTop?: boolean; anchorBottom?: boolean;
  /** Signed edge offsets from the linked text rectangle, in design pixels. */
  anchorOffsetLeft?: number; anchorOffsetRight?: number;
  anchorOffsetTop?: number; anchorOffsetBottom?: number;
  shape: 'rect' | 'ellipse'; radius: number;
  fillMode: 'none' | 'solid' | 'gradient';
  fill1: string; fill2: string; gradientAngle: number;
  borderWidth: number; borderColor: string;
  /** Per-element pixel-alpha shadow. Missing/false means no shadow in legacy files. */
  shadowEnabled?: boolean; shadowColor?: string; shadowOpacity?: number;
  /** Shadow offset and circular spread, stored as 96-DPI design coordinates. */
  shadowOffsetX?: number; shadowOffsetY?: number; shadowSpread?: number;
  /** Legacy overall opacity (0–100), used as the fallback for older documents. */
  opacity?: number;
  /** Independent component opacities (0–100). Missing values use legacy opacity or 100. */
  fillOpacity?: number;
  borderOpacity?: number;
  textOpacity?: number;
  text: string; font: string; fontSize: number; fontWeight: number;
  italic: boolean; underline: boolean; color: string;
  align: 'left' | 'center' | 'right'; valign: 'top' | 'middle' | 'bottom';
  lineHeight: number; letterSpacing: number;
  /** Auto-fit text separately along each axis. Missing means off (legacy compatibility). */
  autoWidth?: boolean; autoHeight?: boolean;
  /** Non-text margins inside the coloured/bordered text box, in 96-DPI design pixels. */
  gutterLeft?: number; gutterRight?: number; gutterTop?: number; gutterBottom?: number;
  imageFit: 'cover' | 'contain' | 'width' | 'height' | 'stretch' | 'free';
  imgScale: number; imgOffsetX: number; imgOffsetY: number;
  /** Non-destructive zoom for all image fit modes. Missing means 1 for old files. */
  imgZoom?: number;
  /** Transform image content about the frame centre, leaving frame and border intact. */
  imgFlipX?: boolean; imgFlipY?: boolean; imgRotation?: number;
  autoSet: string; autoMode: 'cycle' | 'sequence' | 'random' | 'single';
  /** Filename in autoSet used for every card when autoMode is single. */
  singleImage?: string;
}
export type ShadowOverlapMode = 'add' | 'merge';
export interface CardTemplate { shadowOverlapMode?: ShadowOverlapMode; name: string; width: number; height: number; unit: Units; dpi: number; background: string; elements: CardElement[]; }
export interface ImageAsset { name: string; data: string; }
export interface ImageSet { id: string; name: string; images: ImageAsset[]; }
export interface StagedCard { id: string; name: string; values: Record<string,string>; overrides: Record<string,Partial<CardElement>>; extraElements: CardElement[]; }
/** Font binary carried inside projects/templates for consistent cross-device rendering. */
export interface EmbeddedFont { family:string; filename:string; data:string; weight?:number; style?:'normal'|'italic'; }
export interface StudioProject {
  type: 'cardstudio-project'; version: number; projectName: string;
  template: CardTemplate; sets: ImageSet[]; cards: StagedCard[]; fonts?: EmbeddedFont[];
  mode: 'template' | 'cards'; cardIndex: number; selected: string | null; zoom: number;
}
