/** Bulk card-data operations. Uses the same fields as per-set XLSX export.
 * Sort/filter change only the view; no template, card layout or project order
 * is changed unless the user explicitly adds/duplicates/deletes cards. */
import {S,uid,cardSetFor} from './model';
import {spreadsheetColumns} from './spreadsheet';
import type {CardElement,StagedCard} from './types';

export interface GridColumn {
 id:string;
 label:string;
 kind:'name'|'text'|'image';
 element?:CardElement;
}
export interface GridRow {cardId:string;index:number;values:string[]}
export type GridOrder='asc'|'desc'|null;
const NAME_ID='@card:name';

export function gridColumns(setId:string):GridColumn[]{
 return [{id:NAME_ID,label:'Card Name',kind:'name'},...spreadsheetColumns(setId).map(col=>({
  id:col.id,label:col.label,kind:col.element.kind as 'text'|'image',element:col.element
 }))];
}
export function cellValue(card:StagedCard,column:GridColumn):string{
 if(column.kind==='name')return String(card.name||'');
 return String(card.values?.[column.id]??(column.kind==='text'?column.element?.text??'':''));
}
export function gridRows(setId:string,query='',sortColumn:number|null=null,order:GridOrder=null):GridRow[]{
 const columns=gridColumns(setId);
 const needle=query.trim().toLocaleLowerCase();
 const rows:SizedGridRow[]=S.cards.map((card,index)=>({
  cardId:card.id,index,values:columns.map(col=>cellValue(card,col))
 })).filter(row=>S.cards[row.index].setId===setId &&
  (!needle||row.values.some(value=>value.toLocaleLowerCase().includes(needle))));
 if(order&&sortColumn!==null&&sortColumn>=0&&sortColumn<columns.length){
  const direction=order==='desc'?-1:1;
  rows.sort((a,b)=>{
   const c=a.values[sortColumn].localeCompare(b.values[sortColumn],undefined,{numeric:true,sensitivity:'base'});
   return c?direction*c:a.index-b.index;
  });
 }
 return rows;
}
type SizedGridRow=GridRow;

function findCard(setId:string,cardId:string):StagedCard{
 if(!S.cardSets?.some(set=>set.id===setId))throw Error('Card set no longer exists');
 const card=S.cards.find(c=>c.id===cardId);
 if(!card||card.setId!==setId)throw Error('Card does not belong to this set');
 return card;
}
function assign(card:StagedCard,column:GridColumn,value:string){
 if(column.kind==='name')card.name=String(value).trim();
 else {card.values??={};card.values[column.id]=String(value);}
}
export function editGridCell(setId:string,cardId:string,columnIndex:number,value:string):boolean{
 const card=findCard(setId,cardId),column=gridColumns(setId)[columnIndex];
 if(!column)throw Error('Unknown card-data field');
 const next=column.kind==='name'?String(value).trim():String(value);
 if(cellValue(card,column)===next)return false;
 assign(card,column,next);
 return true;
}
function newCard(setId:string,existingNames:Set<string>):StagedCard{
 let n=1,name='';
 do {name='Card '+String(n++).padStart(3,'0');} while(existingNames.has(name.toLocaleLowerCase()));
 existingNames.add(name.toLocaleLowerCase());
 return {id:uid(),setId,name,values:{},overrides:{},extraElements:[]};
}
function nameRegistry(){
 return new Set(S.cards.map(card=>String(card.name||'').toLocaleLowerCase()));
}
function keepCurrentCard(currentId:string|undefined){
 if(!currentId)return;
 const ix=S.cards.findIndex(card=>card.id===currentId);
 S.cardIndex=ix<0?Math.min(S.cardIndex,S.cards.length-1):ix;
}
/** Add after the last card from the selected set, never reordering other cards. */
export function addGridCards(setId:string,count=1):StagedCard[]{
 gridColumns(setId);
 if(!Number.isInteger(count)||count<1||count>500)throw Error('Add between 1 and 500 cards at once');
 const currentId=S.cards[S.cardIndex]?.id,names=nameRegistry();
 const cards=Array.from({length:count},()=>newCard(setId,names));
 const last=S.cards.reduce((index,card,i)=>card.setId===setId?i:index,-1);
 S.cards.splice(last<0?S.cards.length:last+1,0,...cards);
 keepCurrentCard(currentId);
 return cards;
}
/** Copy all card-specific data, overrides, front/back additions and print flags.
 * Per-card extra-element IDs can be reused because their scopes are separate. */
export function duplicateGridCards(setId:string,ids:ReadonlyArray<string>):StagedCard[]{
 gridColumns(setId);
 const chosen=new Set(ids);
 if(!chosen.size)return [];
 for(const id of chosen)findCard(setId,id);
 const currentId=S.cards[S.cardIndex]?.id,names=nameRegistry();
 const created:StagedCard[]=[];
 const result:StagedCard[]=[];
 for(const card of S.cards){
  result.push(card);
  if(!chosen.has(card.id))continue;
  const clone:StagedCard=structuredClone(card);
  clone.id=uid();
  let name=String(card.name||'Card')+' copy',number=2;
  while(names.has(name.toLocaleLowerCase()))name=String(card.name||'Card')+' copy '+number++;
  clone.name=name;names.add(name.toLocaleLowerCase());
  result.push(clone);created.push(clone);
 }
 S.cards=result;keepCurrentCard(currentId);
 return created;
}
export function deleteGridCards(setId:string,ids:ReadonlyArray<string>):number{
 gridColumns(setId);
 const chosen=new Set(ids);
 if(!chosen.size)return 0;
 for(const id of chosen)findCard(setId,id);
 if(S.cards.length-chosen.size<1)throw Error('A project must contain at least one card');
 const beforeIndex=S.cardIndex,currentId=S.cards[beforeIndex]?.id;
 S.cards=S.cards.filter(card=>!chosen.has(card.id));
 if(currentId&&S.cards.some(card=>card.id===currentId))keepCurrentCard(currentId);
 else S.cardIndex=Math.min(beforeIndex,S.cards.length-1);
 if(S.side==='back'&&!cardSetFor(S.cards[S.cardIndex])?.backTemplateId)S.side='front';
 S.selected=null;
 return chosen.size;
}
/** Parse Excel's tab/newline clipboard format, including quoted multiline cells. */
export function parseGridPaste(text:string):string[][]{
 const rows:string[][]=[],row:string[]=[];
 let value='',quoted=false;
 const input=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){
   if(ch==='"'&&input[i+1]==='"'){value+='"';i++;}
   else if(ch==='"')quoted=false;
   else value+=ch;
  }else if(ch==='"'&&value==='')quoted=true;
  else if(ch==='\t'){row.push(value);value='';}
  else if(ch==='\r'||ch==='\n'){
   if(ch==='\r'&&input[i+1]==='\n')i++;
   row.push(value);rows.push(row.splice(0));value='';
  }else value+=ch;
 }
 if(quoted)throw Error('Unterminated quoted cell in pasted table');
 if(value!==''||row.length){row.push(value);rows.push(row);}
 return rows;
}
/** Apply a rectangular clipboard range to the visible row order. When the
 * grid is unfiltered/unsorted, additional pasted rows create new cards.
 * Validate the entire range before any mutation; one paste is one undo step. */
export function pasteGridCells(setId:string,startCardId:string,startColumn:number,
 rows:string[][],visibleCardIds:ReadonlyArray<string>,appendRows:boolean):{changed:number;added:number}{
 const columns=gridColumns(setId);
 const first=visibleCardIds.indexOf(startCardId);
 if(first<0)throw Error('Select a visible card before pasting');
 if(!Number.isInteger(startColumn)||startColumn<0||startColumn>=columns.length)
  throw Error('Invalid starting field');
 if(!rows.length||!rows.some(row=>row.length))return {changed:0,added:0};
 if(rows.length>5000)throw Error('Paste too large (maximum 5000 rows)');
 for(const row of rows){
  if(startColumn+row.length>columns.length)
   throw Error('Pasted range has more columns than the current card set');
 }
 if(new Set(visibleCardIds).size!==visibleCardIds.length)throw Error('Visible card list is not unique');
 for(const id of visibleCardIds)findCard(setId,id);
 const shortage=Math.max(0,first+rows.length-visibleCardIds.length);
 if(shortage&&!appendRows)throw Error('Paste exceeds visible cards. Clear sorting and filtering to add rows.');
 if(shortage>500)throw Error('Paste creates too many new cards (maximum 500)');
 const newIds:string[]=[];
 const added=shortage?addGridCards(setId,shortage):[];
 for(const card of added)newIds.push(card.id);
 const targets=[...visibleCardIds,...newIds].slice(first,first+rows.length);
 let changed=0;
 for(let i=0;i<rows.length;i++){
  const card=findCard(setId,targets[i]);
  for(let j=0;j<rows[i].length;j++){
   const column=columns[startColumn+j],next=column.kind==='name'?
    String(rows[i][j]).trim():String(rows[i][j]);
   if(cellValue(card,column)===next)continue;
   assign(card,column,next);changed++;
  }
 }
 return {changed,added:added.length};
}
