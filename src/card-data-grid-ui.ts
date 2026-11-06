/** A set-scoped spreadsheet editor for staged card data. All edits reuse the
 * XLSX field mapping and take exactly one document-history step per operation. */
import {S,escapeHTML,cardSetFor,safeFile} from './model';
import {repaint,chooseCard} from './interface';
import {checkpoint,undo,redo,historyState} from './history';
import {gridColumns,gridRows,editGridCell,addGridCards,duplicateGridCards,
 deleteGridCards,parseGridPaste,pasteGridCells,GridOrder} from './card-data-grid';
import type {GridRow} from './card-data-grid';

const PAGE_SIZE=80;
const styles=String.raw`<style>
#gridEditor{position:fixed;inset:0;z-index:15150;background:#09131bdf;display:flex;align-items:center;justify-content:center;padding:10px;color:#e7eef8;font:13px system-ui,sans-serif}
#gridEditor *{box-sizing:border-box}
#gridEditor .dg-panel{width:min(1480px,100%);max-height:97vh;background:#15263b;border:1px solid #48627f;border-radius:11px;display:flex;flex-direction:column;overflow:hidden}
#gridEditor .dg-head,#gridEditor .dg-footer{display:flex;align-items:center;gap:10px;padding:11px 14px;background:#1e344b;flex-wrap:wrap}
#gridEditor .dg-head strong{font-size:18px;flex:1}
#gridEditor .dg-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid #36526b}
#gridEditor .dg-tools label{display:flex;align-items:center;gap:5px}
#gridEditor button,#gridEditor select,#gridEditor input{font:inherit;border:1px solid #607994;background:#253e55;color:#eef4fa;border-radius:5px;padding:6px 8px;max-width:100%}
#gridEditor button{cursor:pointer}
#gridEditor button:disabled{cursor:default;opacity:.45}
#gridEditor input[type=checkbox]{accent-color:#65b6ef}
#gridEditor input[type=search]{width:205px}
#gridEditor input[type=number]{width:63px}
#gridEditor .dg-table-scroll{min-height:90px;max-height:min(63vh,680px);overflow:auto;position:relative;overscroll-behavior:contain}
#gridEditor table{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;table-layout:fixed}
#gridEditor th,#gridEditor td{padding:0;border-right:1px solid #34506b;border-bottom:1px solid #34506b}
#gridEditor thead th{position:sticky;top:0;z-index:2;background:#28455e;color:#f0f6fc;white-space:nowrap}
#gridEditor thead th button{background:transparent;border:0;text-align:left;width:100%;padding:9px;white-space:nowrap}
#gridEditor td.dg-cell{min-width:165px;width:190px}
#gridEditor td.dg-cell input{border:0;background:transparent;width:100%;padding:9px 10px;border-radius:0;text-overflow:ellipsis}
#gridEditor td.dg-cell input:focus{outline:2px solid #79c9ff;outline-offset:-2px;background:#1b344b;overflow:visible;text-overflow:clip}
#gridEditor tbody tr:nth-child(even){background:#1b3045}
#gridEditor tbody tr.dg-selected{background:#284862}
#gridEditor .dg-select{position:sticky;left:0;z-index:1;background:#1e344b;width:38px;min-width:38px;text-align:center}
#gridEditor thead .dg-select{z-index:4}
#gridEditor .dg-name{position:sticky;left:38px;z-index:1;min-width:160px;width:190px;background:#1b3146}
#gridEditor thead .dg-name{z-index:3;background:#28455e}
#gridEditor .dg-open{min-width:78px;width:78px;text-align:center}
#gridEditor .dg-open button{padding:5px;margin:4px}
#gridEditor .dg-status{min-height:22px;color:#bfd0e2;padding:6px 14px;font-size:12px}
#gridEditor .dg-footer{border-top:1px solid #48627f}
#gridEditor .dg-footer span{flex:1;color:#c4d1df}
#gridEditor .dg-hint{font-size:11px;color:#b2c4d6}
@media(max-width:700px){#gridEditor{padding:3px}#gridEditor .dg-panel{max-height:99vh}#gridEditor .dg-head,#gridEditor .dg-tools,#gridEditor .dg-footer{padding:7px;gap:6px}#gridEditor input[type=search]{width:150px}#gridEditor .dg-table-scroll{max-height:61vh}}
</style>`;
const cellTSV=(value:string)=>{
 const s=String(value);
 return /[\t\r\n"]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
};

export function openCardDataGrid(initialSetId?:string):void{
 const holder=document.querySelector('#dialogHolder') as HTMLElement|null;
 if(!holder)return;
 const sets=S.cardSets||[];
 if(!sets.length){alert('Create a card set before editing card data');return;}
 let setId=sets.some(set=>set.id===initialSetId)?initialSetId!:
  cardSetFor(S.cards[S.cardIndex])?.id||sets[0].id;
 let query='',sortColumn:number|null=null,sortOrder:GridOrder=null,page=0;
 const selected=new Set<string>();
 holder.innerHTML=styles+String.raw`<section id="gridEditor"><div class="dg-panel" role="dialog" aria-modal="true" aria-label="Bulk card data editor">
 <header class="dg-head"><strong>Card data</strong><span class="dg-hint">Changes shared templates: never. Changes staged card values: yes.</span><button type="button" data-dg="close">Close</button></header>
 <div class="dg-tools"><label>Card set <select id="dgSet"></select></label><input id="dgSearch" type="search" placeholder="Search all fields" aria-label="Search cards">
 <label>Sort <select id="dgSort"></select></label><button type="button" data-dg="direction" title="Reverse display sort">A–Z</button>
 <button type="button" data-dg="undo">Undo</button><button type="button" data-dg="redo">Redo</button></div>
 <div class="dg-tools"><button type="button" data-dg="select-page">Select page</button><button type="button" data-dg="select-filtered">Select all filtered</button><button type="button" data-dg="clear">Clear selection</button>
 <button type="button" data-dg="copy">Copy selected rows</button><button type="button" data-dg="duplicate">Duplicate selected</button><button type="button" data-dg="delete">Delete selected</button>
 <label>Add <input id="dgCount" type="number" value="1" min="1" max="500" step="1" aria-label="Number of new cards"></label><button type="button" data-dg="add">Add cards</button></div>
 <div id="dgStatus" class="dg-status" aria-live="polite"></div>
 <div class="dg-table-scroll" id="dgScroll"><table aria-label="Editable card data"><thead id="dgHead"></thead><tbody id="dgBody"></tbody></table></div>
 <footer class="dg-footer"><button type="button" data-dg="prev">Previous page</button><span id="dgPage"></span><button type="button" data-dg="next">Next page</button><button type="button" data-dg="close">Close</button></footer>
 </div></section>`;
 const root=holder.querySelector('#gridEditor') as HTMLElement;
 const setPicker=root.querySelector('#dgSet') as HTMLSelectElement,
  search=root.querySelector('#dgSearch') as HTMLInputElement,
  sort=root.querySelector('#dgSort') as HTMLSelectElement,
  direction=root.querySelector<HTMLButtonElement>('[data-dg="direction"]')!,
  count=root.querySelector('#dgCount') as HTMLInputElement,
  status=root.querySelector('#dgStatus') as HTMLElement,
  head=root.querySelector('#dgHead') as HTMLElement,
  body=root.querySelector('#dgBody') as HTMLElement,
  pageInfo=root.querySelector('#dgPage') as HTMLElement,
  scroller=root.querySelector('#dgScroll') as HTMLElement;
 setPicker.innerHTML=sets.map(set=>
  '<option value="'+escapeHTML(set.id)+'">'+escapeHTML(set.name)+'</option>').join('');
 setPicker.value=setId;
 function validSelection(){
  const inSet=new Set(S.cards.filter(card=>card.setId===setId).map(card=>card.id));
  for(const id of selected)if(!inSet.has(id))selected.delete(id);
 }
 function allRows():GridRow[]{return gridRows(setId,query,sortColumn,sortOrder);}
 function message(text:string){status.textContent=text;}
 function refresh(sortChoice=false){
  if(holder.querySelector('#gridEditor')!==root)return;
  const columns=gridColumns(setId);
  if(sortChoice){
   sort.innerHTML='<option value="-1">Project order</option>'+
    columns.map((col,i)=>'<option value="'+i+'">'+escapeHTML(col.label)+'</option>').join('');
   sort.value=sortColumn===null?'-1':String(sortColumn);
  }
  validSelection();
  const rows=allRows(),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
  page=Math.min(page,pages-1);
  const visible=rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  head.innerHTML='<tr><th class="dg-select" aria-label="Select cards"></th>'+
   columns.map((col,index)=>'<th class="'+(index===0?'dg-name':'')+'"><button type="button" data-dg-sort="'+index+'" title="Sort by '+escapeHTML(col.label)+'">'+escapeHTML(col.label)+
    (sortColumn===index?(sortOrder==='desc'?' ▼':' ▲'):'')+'</button></th>').join('')+
   '<th class="dg-open">Card</th></tr>';
  body.innerHTML=visible.length?visible.map(row=>{
   const checked=selected.has(row.cardId),name=row.values[0];
   return '<tr class="'+(checked?'dg-selected':'')+'"><td class="dg-select"><input type="checkbox" data-dg-select="'+escapeHTML(row.cardId)+
    '" aria-label="Select '+escapeHTML(name)+'" '+(checked?'checked':'')+'></td>'+
    row.values.map((value,index)=>'<td class="dg-cell '+(index===0?'dg-name':'')+'"><input type="text" spellcheck="false" data-dg-cell="'+index+
    '" data-dg-id="'+escapeHTML(row.cardId)+'" aria-label="'+escapeHTML(name+' - '+columns[index].label)+
    '" value="'+escapeHTML(value)+'"></td>').join('')+
    '<td class="dg-open"><button type="button" data-dg-open="'+escapeHTML(row.cardId)+'">Open</button></td></tr>';
  }).join(''):'<tr><td colspan="'+(columns.length+2)+'" style="padding:16px">No matching cards. Clear the search or add cards.</td></tr>';
  pageInfo.textContent=rows.length+' of '+S.cards.filter(card=>card.setId===setId).length+
   ' cards shown · '+selected.size+' selected · Page '+(page+1)+' of '+pages;
  root.querySelector<HTMLButtonElement>('[data-dg="prev"]')!.disabled=page===0;
  root.querySelector<HTMLButtonElement>('[data-dg="next"]')!.disabled=page>=pages-1;
  root.querySelector<HTMLButtonElement>('[data-dg="undo"]')!.disabled=!historyState().canUndo;
  root.querySelector<HTMLButtonElement>('[data-dg="redo"]')!.disabled=!historyState().canRedo;
  direction.textContent=sortOrder==='desc'?'Z–A':'A–Z';
  direction.disabled=sortColumn===null;
  for(const action of ['copy','duplicate','delete'] as const)
   root.querySelector<HTMLButtonElement>('[data-dg="'+action+'"]')!.disabled=selected.size===0;
 }
 function afterEdit(text:string){
  checkpoint();repaint();
  message(text);
  // Do not rebuild inputs on a normal cell change: Tab must move naturally
  // to the next field without discarding browser focus.
  root.querySelector<HTMLButtonElement>('[data-dg="undo"]')!.disabled=!historyState().canUndo;
  root.querySelector<HTMLButtonElement>('[data-dg="redo"]')!.disabled=!historyState().canRedo;
 }
 function rerender(text=''){
  repaint();if(text)message(text);
  refresh();
 }
 function close(){if(holder.querySelector('#gridEditor')===root)holder.innerHTML='';}
 root.addEventListener('change',event=>{
  const input=event.target as HTMLInputElement|HTMLSelectElement;
  if(input.id==='dgSet'){
   setId=input.value;query='';sortColumn=null;sortOrder=null;page=0;selected.clear();
   search.value='';message('');refresh(true);return;
  }
  if(input.id==='dgSort'){
   sortColumn=Number(input.value)<0?null:Number(input.value);
   sortOrder=sortColumn===null?null:'asc';page=0;scroller.scrollTop=0;
   refresh();return;
  }
  if(input.dataset.dgSelect!==undefined){
   if(input.checked)selected.add(input.dataset.dgSelect);
   else selected.delete(input.dataset.dgSelect);
   refresh();return;
  }
  if(input.dataset.dgCell!==undefined){
   try{
    const changed=editGridCell(setId,input.dataset.dgId!,Number(input.dataset.dgCell),input.value);
    if(changed)afterEdit('Updated card data. Save the project to keep these changes.');
    input.value=input.dataset.dgCell==='0'?input.value.trim():input.value;
   }catch(error){message((error as Error).message);refresh();}
  }
 });
 search.addEventListener('input',()=>{
  query=search.value;page=0;scroller.scrollTop=0;refresh();
 });
 root.addEventListener('paste',event=>{
  const target=event.target as HTMLInputElement;
  if(target.dataset.dgCell===undefined)return;
  const plain=(event as ClipboardEvent).clipboardData?.getData('text/plain')||'';
  if(!/[\t\r\n]/.test(plain))return;
  event.preventDefault();
  try{
   const values=parseGridPaste(plain),before=allRows();
   const result=pasteGridCells(setId,target.dataset.dgId!,Number(target.dataset.dgCell),
    values,before.map(row=>row.cardId),!query&&sortColumn===null);
   rerender('Pasted '+result.changed+' cell changes'+(result.added?' and created '+result.added+' cards':'')+'. Undo reverses the entire paste.');
  }catch(error){message('Paste rejected: '+(error as Error).message);}
 });
 root.addEventListener('click',event=>{
  const target=event.target as HTMLElement;
  if(target===root){close();return;}
  const heading=target.closest<HTMLElement>('[data-dg-sort]');
  if(heading){
   const col=Number(heading.dataset.dgSort);
   if(sortColumn===col)sortOrder=sortOrder==='asc'?'desc':'asc';
   else{sortColumn=col;sortOrder='asc';}
   sort.value=String(col);page=0;scroller.scrollTop=0;refresh();return;
  }
  const open=target.closest<HTMLElement>('[data-dg-open]')?.dataset.dgOpen;
  if(open!==undefined){
   const index=S.cards.findIndex(card=>card.id===open);
   if(index>=0){close();chooseCard(index);}
   return;
  }
  const action=target.closest<HTMLElement>('[data-dg]')?.dataset.dg;
  if(!action)return;
  if(action==='close'){close();return;}
  if(action==='prev'||action==='next'){
   page+=action==='prev'?-1:1;scroller.scrollTop=0;refresh();return;
  }
  if(action==='direction'){
   if(sortColumn!==null){sortOrder=sortOrder==='desc'?'asc':'desc';page=0;refresh();}
   return;
  }
  if(action==='select-page'||action==='select-filtered'){
   const rows=allRows(),shown=action==='select-page'?
    rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE):rows;
   for(const row of shown)selected.add(row.cardId);
   refresh();return;
  }
  if(action==='clear'){selected.clear();refresh();return;}
  if(action==='undo'||action==='redo'){
   if(action==='undo'?undo():redo()){
    selected.clear();
    rerender(action==='undo'?'Undid last edit':'Redid last edit');
   }
   return;
  }
  if(action==='add'){
   try{
    const n=Number(count.value),cards=addGridCards(setId,n);
    page=Math.max(0,Math.ceil(gridRows(setId,query,sortColumn,sortOrder).length/PAGE_SIZE)-1);
    selected.clear();rerender('Added '+cards.length+' card(s).');
   }catch(error){message((error as Error).message);}
   return;
  }
  if(action==='duplicate'||action==='delete'){
   try{
    if(!selected.size)return;
    if(action==='delete'&&!confirm('Delete '+selected.size+' selected card(s), including their individual layout edits? You can undo this.'))return;
    const changed=action==='duplicate'?duplicateGridCards(setId,[...selected]).length:
     deleteGridCards(setId,[...selected]);
    selected.clear();rerender(action==='duplicate'?'Duplicated '+changed+' card(s).':'Deleted '+changed+' card(s).');
   }catch(error){message((error as Error).message);}
   return;
  }
  if(action==='copy'){
   const rows=allRows().filter(row=>selected.has(row.cardId));
   const text=rows.map(row=>row.values.map(cellTSV).join('\t')).join('\r\n');
   if(!text){message('No visible selected cards to copy.');return;}
   if(!navigator.clipboard?.writeText){message('Clipboard access is unavailable in this browser.');return;}
   void navigator.clipboard.writeText(text).then(()=>message('Copied '+rows.length+' row(s) to clipboard.'),
    error=>message('Could not copy: '+(error as Error).message));
  }
 });
 root.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if((event.target as HTMLElement).closest('input,select'))return;
  close();event.preventDefault();
 });
 message('Edit a cell, paste rows from Excel, or select cards for bulk changes. Sorting does not reorder the project.');
 refresh(true);
}
