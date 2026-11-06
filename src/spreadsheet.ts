import { S, uid, escapeXML, textKinds, safeFile, isDataExported,cardSetFor,syncEditorTemplate } from './model';
import { download, toast } from './dom';
import { repaint } from './interface';
export const columnName=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
export const columnIndex=s=>[...s].reduce((n,c)=>n*26+c.toUpperCase().charCodeAt(0)-64,0)-1;
type SheetTable={name:string;setId:string;heads:string[];rows:string[][]};
type ImportedSheet={name:string;rows:string[][]};

/** Every workbook, whether one set or many, is built from the same per-set table. */
export function spreadsheetColumns(setId:string){
 const set=S.cardSets?.find(s=>s.id===setId);
 if(!set)throw Error('Card set not found');
 const templates=[set.frontTemplateId,set.backTemplateId]
  .filter((id,i,ids)=>!!id&&ids.indexOf(id)===i)
  .map(id=>S.templates?.find(t=>t.id===id)).filter(Boolean);
 if(!templates.length)throw Error('No template assigned to card set '+set.name);
 const multiple=templates.length>1;
 return templates.flatMap(template=>[...template.elements].reverse()
  .filter(e=>textKinds.includes(e.kind)&&isDataExported(e))
  .map(e=>({id:e.id,label:multiple?template.name+' / '+e.name:e.name,element:e})));
}
/** Returns the content for exactly one worksheet. Defaults to the first set for
 * compatibility with existing single-set projects and spreadsheet callers. */
export function sheetTable(setId?:string){
 const chosen=setId||S.cardSets?.[0]?.id;
 if(!chosen)throw Error('No card sets in project');
 const cols=spreadsheetColumns(chosen);
 const heads=['Card Name',...cols.map(c=>c.label)];
 const rows=S.cards.filter(c=>cardSetFor(c)?.id===chosen).map(c=>
  [c.name,...cols.map(col=>String(c.values?.[col.id]??(col.element.kind==='text'?col.element.text:'')))]);
 return {heads,rows};
}
function uniqueSheetName(value:string,used:Set<string>){
 let base=String(value||'Cards').replace(/[\[\]:*?\/\\\x00-\x1f]/g,'_')
  .replace(/^'+|'+$/g,'').trim().slice(0,31)||'Cards';
 if(base.toLowerCase()==='history')base='History_';
 let name=base;
 for(let n=2;used.has(name.toLowerCase());n++){
  const suffix=' ('+n+')';name=base.slice(0,31-suffix.length)+suffix;
 }
 used.add(name.toLowerCase());
 return name;
}
export function workbookTables(setId?:string):SheetTable[]{
 const sets=S.cardSets||[];
 if(!sets.length||setId&&!sets.some(set=>set.id===setId))
  throw Error(setId?'Card set not found':'No card sets in project');
 // Generate sheet names across the whole project, even for a one-set export.
 // A set's tab name is identical in both output formats, including collisions.
 const names=new Set<string>();
 const namesById=new Map<string,string>();
 for(const set of sets)namesById.set(set.id,uniqueSheetName(set.name,names));
 return sets.filter(set=>!setId||set.id===setId).map(set=>({
  name:namesById.get(set.id)!,setId:set.id,...sheetTable(set.id)
 }));
}
function sheetXML({heads,rows}:SheetTable){
 const values=[heads,...(rows.length?rows:Array.from({length:12},(_,i)=>[
  'Card '+String(i+1).padStart(3,'0'),...heads.slice(1).map(()=>'')
 ]))];
 const body=values.map((r,i)=>'<row r="'+(i+1)+'">'+
  r.map((v,j)=>'<c r="'+columnName(j)+(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+escapeXML(v)+'</t></is></c>').join('')+
  '</row>').join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  '<dimension ref="A1:'+columnName(heads.length-1)+values.length+'"/>'+
  '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'+
  '<sheetFormatPr defaultRowHeight="15"/><cols>'+
  heads.map((_,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(i===0?21:27)+'" customWidth="1"/>').join('')+
  '</cols><sheetData>'+body+'</sheetData></worksheet>';
}
export async function exportXLSX(setId?:string){
 const tables=workbookTables(setId),z=new JSZip();
 z.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?>'+
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
  '<Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
  tables.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+
  '</Types>');
 z.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
  '</Relationships>');
 z.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?>'+
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
  tables.map((sheet,i)=>'<sheet name="'+escapeXML(sheet.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+
  '</sheets></workbook>');
 z.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  tables.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
  '</Relationships>');
 tables.forEach((table,i)=>z.file('xl/worksheets/sheet'+(i+1)+'.xml',sheetXML(table)));
 const filename=safeFile(S.projectName)+(setId?'_'+safeFile(S.cardSets!.find(s=>s.id===setId)!.name):'')+'_card_data.xlsx';
 download(await z.generateAsync({type:'blob',compression:'DEFLATE'}),filename);
 toast(setId?'Exported card set spreadsheet':'Exported '+tables.length+' card set worksheet(s)');
}
export function parseCSV(text){text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0],sep=first.includes('\t')?'\t':(first.split(';').length>first.split(',').length?';':',');let rows=[],row=[],item='',quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){item+='"';i++}else if(ch==='"')quoted=false;else item+=ch}else if(ch==='"')quoted=true;else if(ch===sep){row.push(item);item=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(item);rows.push(row);row=[];item=''}else item+=ch}if(item!==''||row.length){row.push(item);rows.push(row)}return rows}
const xmlChildren=(node,tag)=>[...node.getElementsByTagNameNS('*',tag)];
const parseDocument=(xml:string)=>{
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('Could not read spreadsheet XML');
 return doc;
};
function xmlRows(xml:string,strings:string[]):string[][]{
 const doc=parseDocument(xml),result:string[][]=[];
 for(const row of xmlChildren(doc,'row')){
  const cells:Record<number,string>={};
  for(const c of xmlChildren(row,'c')){
   const ref=c.getAttribute('r')||'A',idx=columnIndex(ref.match(/[A-Z]+/i)?.[0]||'A'),type=c.getAttribute('t');
   let value='';
   if(type==='inlineStr')value=xmlChildren(c,'t').map(t=>t.textContent||'').join('');
   else{
    value=xmlChildren(c,'v')[0]?.textContent||'';
    if(type==='s')value=strings[Number(value)]??'';
   }
   cells[idx]=value;
  }
  const len=Math.max(-1,...Object.keys(cells).map(Number))+1;
  result.push(Array.from({length:len},(_,i)=>cells[i]??''));
 }
 return result;
}
function worksheetPath(target:string){
 const raw=target.replace(/\\/g,'/');
 const segments=(raw.startsWith('/')?raw.slice(1):raw.startsWith('xl/')?raw:'xl/'+raw).split('/');
 const parts:string[]=[];
 for(const segment of segments){
  if(segment==='..')parts.pop();
  else if(segment&&segment!=='.')parts.push(segment);
 }
 return parts.join('/');
}
/** Read every worksheet using workbook relationships; never assume sheet1 is the
 * only sheet or that a workbook's displayed tab order equals its ZIP paths. */
export async function parseXLSXWorkbook(file):Promise<ImportedSheet[]>{
 const zip=await JSZip.loadAsync(file),ss=zip.file('xl/sharedStrings.xml');
 let strings:string[]=[];
 if(ss){
  const doc=parseDocument(await ss.async('string'));
  strings=xmlChildren(doc,'si').map(si=>xmlChildren(si,'t').map(t=>t.textContent||'').join(''));
 }
 const wb=zip.file('xl/workbook.xml'),rels=zip.file('xl/_rels/workbook.xml.rels');
 if(!wb||!rels)throw Error('Spreadsheet workbook metadata is missing');
 const workbook=parseDocument(await wb.async('string')),relationships=parseDocument(await rels.async('string'));
 const paths=new Map<string,string>();
 for(const rel of xmlChildren(relationships,'Relationship')){
  if((rel.getAttribute('Type')||'').endsWith('/worksheet'))
   paths.set(rel.getAttribute('Id')||'',worksheetPath(rel.getAttribute('Target')||''));
 }
 const result:ImportedSheet[]=[];
 for(const sheet of xmlChildren(workbook,'sheet')){
  const id=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id');
  const name=sheet.getAttribute('name')||'Cards',path=paths.get(id);
  if(!path)throw Error('Missing worksheet relationship for '+name);
  const entry=zip.file(path);
  if(!entry)throw Error('Missing worksheet data for '+name);
  result.push({name,rows:xmlRows(await entry.async('string'),strings)});
 }
 if(!result.length)throw Error('No worksheets found in spreadsheet');
 return result;
}
/** Compatibility helper for callers expecting a single sheet. */
export async function parseXLSX(file){return (await parseXLSXWorkbook(file))[0].rows}
type PlannedImport={setId:string;name:string;cards:typeof S.cards;removed:typeof S.cards};
/** Prepare an entire card set before touching project state. */
function planTable(rows:string[][],setId:string,legacy=false):PlannedImport{
 const set=S.cardSets?.find(s=>s.id===setId);
 if(!set)throw Error('Card set not found');
 rows=rows.filter(r=>r.some(x=>String(x).trim()!==''));
 if(rows.length<2)throw Error('No card rows found for '+set.name);
 const headers=rows[0].map(x=>String(x).trim().toLowerCase());
 const nameIdx=headers.indexOf('card name'),setIdx=legacy?headers.indexOf('card set'):-1;
 if(nameIdx<0)throw Error('Missing Card Name column for '+set.name);
 const stage=rows.slice(1);
 const elementColumns:{id:string;idx:number}[]=[];
 for(const templateId of [set.frontTemplateId,set.backTemplateId].filter(Boolean)){
  const template=S.templates?.find(t=>t.id===templateId);
  if(!template)continue;
  for(const element of template.elements){
   if(!textKinds.includes(element.kind))continue;
   const scoped=(template.name+' / '+element.name).toLowerCase();
   let col=headers.indexOf(scoped);
   if(col<0)col=headers.indexOf(element.name.toLowerCase());
   if(col>=0)elementColumns.push({id:element.id,idx:col});
  }
 }
 if(!elementColumns.length)throw Error('No spreadsheet columns match template fields for '+set.name);
 const existing=S.cards.filter(c=>cardSetFor(c)?.id===setId);
 const byName=new Map<string,typeof existing>();
 for(const old of existing){
  const key=old.name.trim().toLowerCase(),list=byName.get(key)||[];
  list.push(old);byName.set(key,list);
 }
 const cards=stage.map((row,i)=>{
  if(setIdx>=0){
   // Support importing older spreadsheets, but never export this column.
   const declared=String(row[setIdx]??'').trim();
   if(declared&&declared.toLowerCase()!==set.name.toLowerCase()&&declared!==set.id)
    throw Error('Spreadsheet belongs to "'+declared+'", not "'+set.name+'".');
  }
  const name=String(row[nameIdx]??'').trim()||'Card '+String(i+1).padStart(3,'0');
  const values:Record<string,string>={};
  for(const entry of elementColumns)values[entry.id]=String(row[entry.idx]??'');
  const prior=byName.get(name.toLowerCase())?.shift();
  return prior?{...prior,name,setId,values:{...prior.values,...values}}:{
   id:uid(),setId,name,values,overrides:{},extraElements:[]
  };
 });
 return {setId,name:set.name,cards,removed:[...byName.values()].flat()};
}
/** Both "all cards" and "one set" imports use exactly this per-set replacement
 * logic. Validate all tabs first so an invalid later tab cannot half-import. */
export function applyWorkbookTables(sheets:ImportedSheet[],setId?:string){
 if(!sheets.length)throw Error('No worksheets to import');
 const all=workbookTables(),byName=new Map<string,string>();
 for(const table of all)byName.set(table.name.toLowerCase(),table.setId);
 let inputs:{setId:string;rows:string[][];legacy?:boolean}[]=[];
 if(setId){
  if(!S.cardSets?.some(set=>set.id===setId))throw Error('Card set not found');
  // A one-tab file is unambiguous when imported explicitly into a set.
  const desired=byName.has(sheets[0].name.toLowerCase())&&sheets.length===1?
   byName.get(sheets[0].name.toLowerCase()):null;
  if(sheets.length===1){
   if(desired&&desired!==setId)throw Error('Worksheet belongs to a different card set: '+sheets[0].name);
   inputs=[{setId,rows:sheets[0].rows}];
  }else{
   const chosen=all.find(t=>t.setId===setId);
   const match=sheets.find(sh=>sh.name.toLowerCase()===chosen!.name.toLowerCase());
   if(!match)throw Error('No worksheet found for '+chosen!.name);
   inputs=[{setId,rows:match.rows}];
  }
 }else if(sheets.length===1&&sheets[0].name.toLowerCase()==='cards'&&
  !byName.has(sheets[0].name.toLowerCase())&&
  sheets[0].rows[0]?.some(h=>String(h).toLowerCase().trim()==='card set')){
  // Older flat exports: split their Card Set rows into normal per-set inputs.
  const rows=sheets[0].rows,headers=rows[0].map(h=>String(h).trim().toLowerCase()),setColumn=headers.indexOf('card set');
  const groups=new Map<string,string[][]>();
  for(const row of rows.slice(1)){
   if(!row.some(x=>String(x).trim()))continue;
   const label=String(row[setColumn]??'').trim().toLowerCase();
   const set=S.cardSets?.find(s=>s.name.toLowerCase()===label||s.id.toLowerCase()===label);
   if(!set)throw Error('Unknown card set in spreadsheet: '+row[setColumn]);
   if(!groups.has(set.id))groups.set(set.id,[rows[0]]);
   groups.get(set.id)!.push(row);
  }
  inputs=[...groups].map(([id,rows])=>({setId:id,rows,legacy:true}));
 }else if(sheets.length===1&&(S.cardSets?.length||0)===1){
  inputs=[{setId:S.cardSets![0].id,rows:sheets[0].rows}];
 }else{
  inputs=sheets.map(sheet=>{
   const id=byName.get(sheet.name.toLowerCase());
   if(!id)throw Error('Unknown card set worksheet: '+sheet.name);
   return {setId:id,rows:sheet.rows};
  });
 }
 if(!inputs.length)throw Error('No card rows found');
 if(new Set(inputs.map(x=>x.setId)).size!==inputs.length)throw Error('Duplicate card set worksheet');
 const planned=inputs.map(entry=>planTable(entry.rows,entry.setId,entry.legacy));
 const unsafe=planned.flatMap(x=>x.removed).some(c=>
  Object.keys(c.overrides||{}).length||c.extraElements?.length||c.backExtraElements?.length);
 if(unsafe&&!confirm('This import removes cards absent from the spreadsheet, including their individual layout edits. Continue?'))return;
 let updated=[...S.cards],firstIndex=0;
 for(const plan of planned){
  const first=updated.findIndex(c=>cardSetFor(c)?.id===plan.setId);
  const others=updated.filter(c=>cardSetFor(c)?.id!==plan.setId);
  const insert=first<0?others.length:updated.slice(0,first).filter(c=>cardSetFor(c)?.id!==plan.setId).length;
  updated=[...others.slice(0,insert),...plan.cards,...others.slice(insert)];
  if(plan===planned[0])firstIndex=insert;
 }
 if(!updated.length)throw Error('Spreadsheet import would leave no cards');
 S.cards=updated;S.mode='cards';S.side='front';S.cardIndex=firstIndex;S.selected=null;
 syncEditorTemplate();repaint();
 toast('Imported '+planned.length+' card set(s) · '+planned.reduce((n,x)=>n+x.cards.length,0)+' cards');
}
/** Retain direct table import for CSV and earlier single-set callers. */
export function applyTable(rows:string[][],setId?:string){
 const name=setId||S.cardSets?.length===1?
  workbookTables().find(sheet=>sheet.setId===(setId||S.cardSets![0].id))!.name:'Cards';
 applyWorkbookTables([{name,rows}],setId);
}
export async function readSheet(file,setId?:string){
 try{
  if(file.name.toLowerCase().endsWith('.csv'))applyTable(parseCSV(await file.text()),setId);
  else applyWorkbookTables(await parseXLSXWorkbook(file),setId);
 }catch(err){alert('Spreadsheet import failed: '+(err as Error).message)}
}
