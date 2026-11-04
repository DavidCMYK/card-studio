/** Cross-platform document history.
 * Undo entries are snapshots of document data, never UI/layout state.
 * Binary image/font data is interned once and referenced by small keys.
 */
import {S,initial,replaceState} from './model';
import type {StudioProject} from './types';

type View = Pick<StudioProject,'mode'|'cardIndex'|'selected'>;
type RecordState = {doc:any;fingerprint:string;view:View};
const MAX_STEPS=60;
const dataToKey=new Map<string,string>(),keyToData=new Map<string,string>();
let nextKey=0;
let current:RecordState|null=null;
let documentRevision=0;
export const historyRevision=()=>documentRevision;
const past:RecordState[]=[],future:RecordState[]=[];

function intern(data:string):string {
 if(typeof data!=='string'||!data.startsWith('data:'))return data;
 let key=dataToKey.get(data);
 if(!key){
  key='@asset:'+String(++nextKey);
  dataToKey.set(data,key);keyToData.set(key,data);
 }
 return key;
}
function decode(key:string):string{return keyToData.get(key)||key}
function take():RecordState{
 const doc={
  projectName:S.projectName,
  template:structuredClone(S.template),
  cards:structuredClone(S.cards),
  sets:S.sets.map(set=>({id:set.id,name:set.name,images:set.images.map(im=>({name:im.name,data:intern(im.data)}))})),
  fonts:(S.fonts||[]).map(font=>({...font,data:intern(font.data)}))
 };
 const view:View={mode:S.mode,cardIndex:S.cardIndex,selected:S.selected};
 return {doc,fingerprint:JSON.stringify(doc),view};
}
function restore(state:RecordState){
 const doc=structuredClone(state.doc);
 for(const set of doc.sets)for(const image of set.images)image.data=decode(image.data);
 for(const font of doc.fonts||[])font.data=decode(font.data);
 const preservedZoom=S.zoom;
 replaceState({
  ...initial(),...doc,
  mode:state.view.mode,cardIndex:Math.max(0,Math.min(state.view.cardIndex,doc.cards.length-1)),
  selected:state.view.selected,zoom:preservedZoom
 });
 if(S.selected&&!S.template.elements.some(e=>e.id===S.selected)&&!S.cards[S.cardIndex]?.extraElements.some(e=>e.id===S.selected))S.selected=null;
}
export function historyState(){return {canUndo:past.length>0,canRedo:future.length>0,undoCount:past.length,redoCount:future.length}}
export function resetHistory(){
 past.length=0;future.length=0;
 dataToKey.clear();keyToData.clear();nextKey=0;
 current=take();documentRevision++;
}
/** Commit one gesture/field edit, even if it generated many live preview updates. */
export function checkpoint():boolean {
 const next=take();
 if(!current){current=next;return false}
 if(next.fingerprint===current.fingerprint){current=next;return false}
 past.push(current);
 if(past.length>MAX_STEPS)past.shift();
 current=next;future.length=0;documentRevision++;return true;
}
export function undo():boolean {
 // A still-focused input/unfinished drag may have changed state without a repaint.
 checkpoint();
 if(!past.length)return false;
 future.push(take());
 const previous=past.pop()!;
 restore(previous);current=take();documentRevision++;return true;
}
export function redo():boolean {
 if(!future.length)return false;
 past.push(take());if(past.length>MAX_STEPS)past.shift();
 const next=future.pop()!;
 restore(next);current=take();documentRevision++;return true;
}
