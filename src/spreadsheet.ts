import { S, uid, escapeXML, textKinds, safeFile, isDataExported,cardSetFor,assignedTemplate,syncEditorTemplate } from './model';
import { download, toast } from './dom';
import { repaint } from './interface';
export const columnName=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
export const columnIndex=s=>[...s].reduce((n,c)=>n*26+c.toUpperCase().charCodeAt(0)-64,0)-1;
function spreadsheetColumns(){
 const templates=S.templates||[S.template],multiTemplate=templates.length>1;
 return templates.flatMap(template=>template.elements.filter(e=>textKinds.includes(e.kind)&&isDataExported(e)).map(e=>({
  id:e.id,templateId:template.id,label:multiTemplate?template.name+' / '+e.name:e.name,
  element:e
 })));
}
export function sheetTable(){
 const cols=spreadsheetColumns(),withSet=(S.cardSets?.length||1)>1;
 const heads=['Card Name',...(withSet?['Card Set']:[]),...cols.map(c=>c.label)];
 const rows=S.cards.map((c,i)=>{
  const set=cardSetFor(c),templateIds=new Set([set?.frontTemplateId,set?.backTemplateId]);
  return [c.name,...(withSet?[set?.name||'']:[]),...cols.map(col=>
   templateIds.has(col.templateId)?String(c.values?.[col.id]??(col.element.kind==='text'?col.element.text:'')):'')];
 });
 return {heads,rows};
}
export async function exportXLSX(){const {heads,rows}=sheetTable(),values=[heads,...(rows.length?rows:Array.from({length:12},(_,i)=>['Card '+String(i+1).padStart(3,'0'),...heads.slice(1).map(()=>'')]))];
 const body=values.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>`<c r="${columnName(j)}${i+1}" t="inlineStr"><is><t xml:space="preserve">${escapeXML(v)}</t></is></c>`).join('')}</row>`).join('');
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(heads.length-1)}${values.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${heads.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===0?21:27}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData></worksheet>`;
 const z=new JSZip();z.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
 z.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 z.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cards" sheetId="1" r:id="rId1"/></sheets></workbook>`);
 z.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
 z.file('xl/worksheets/sheet1.xml',sheet);
 download(await z.generateAsync({type:'blob',compression:'DEFLATE'}),safeFile(S.template.name)+'_card_data.xlsx');toast('Excel spreadsheet exported')
}
export function parseCSV(text){text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0],sep=first.includes('\t')?'\t':(first.split(';').length>first.split(',').length?';':',');let rows=[],row=[],item='',quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){item+='"';i++}else if(ch==='"')quoted=false;else item+=ch}else if(ch==='"')quoted=true;else if(ch===sep){row.push(item);item=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(item);rows.push(row);row=[];item=''}else item+=ch}if(item!==''||row.length){row.push(item);rows.push(row)}return rows}
const xmlChildren=(node,tag)=>[...node.getElementsByTagNameNS('*',tag)];
export async function parseXLSX(file){const zip=await JSZip.loadAsync(file),ss=zip.file('xl/sharedStrings.xml');let strings=[];const dom=t=>new DOMParser().parseFromString(t,'application/xml');if(ss){const doc=dom(await ss.async('string'));strings=xmlChildren(doc,'si').map(si=>xmlChildren(si,'t').map(t=>t.textContent).join(''))}
 const sh=zip.file('xl/worksheets/sheet1.xml');if(!sh)throw Error('No first worksheet found in this file');const doc=dom(await sh.async('string'));if(doc.querySelector('parsererror'))throw Error('Could not read spreadsheet XML');
 const result=[];for(const row of xmlChildren(doc,'row')){const cells={};for(const c of xmlChildren(row,'c')){const ref=c.getAttribute('r'),idx=columnIndex(ref?.match(/[A-Z]+/i)?.[0]||'A'),type=c.getAttribute('t');let value='';if(type==='inlineStr')value=xmlChildren(c,'t').map(t=>t.textContent).join('');else{value=xmlChildren(c,'v')[0]?.textContent||'';if(type==='s')value=strings[Number(value)]??''}cells[idx]=value}const len=Math.max(-1,...Object.keys(cells).map(Number))+1;result.push(Array.from({length:len},(_,i)=>cells[i]??''))}return result}
export function applyTable(rows){
 rows=rows.filter(r=>r.some(x=>String(x).trim()!==''));
 if(rows.length<2)throw Error('No card rows found.');
 const headers=rows[0].map(x=>String(x).trim().toLowerCase());
 const nameIdx=headers.indexOf('card name'),setIdx=headers.indexOf('card set');
 const stage=rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''));
 if(!stage.length)throw Error('The spreadsheet contains no populated card values.');
 const setForRow=(row)=>{
  if(setIdx<0||!String(row[setIdx]??'').trim())return cardSetFor(S.cards[S.cardIndex])||S.cardSets![0];
  const target=String(row[setIdx]).trim().toLowerCase();
  const match=S.cardSets?.find(s=>s.name.toLowerCase()===target||s.id===target);
  if(!match)throw Error('Unknown card set in spreadsheet: '+row[setIdx]);
  return match;
 };
 const cards=stage.map((row,i)=>{
  const set=setForRow(row),values:Record<string,string>={};
  const unique=[set.frontTemplateId,set.backTemplateId].filter(Boolean);
  let matched=0;
  for(const templateId of unique){
   const template=S.templates?.find(t=>t.id===templateId);if(!template)continue;
   for(const e of template.elements){
    if(!textKinds.includes(e.kind))continue;
    const scoped=(template.name+' / '+e.name).toLowerCase();
    let col=headers.indexOf(scoped);
    if(col<0)col=headers.indexOf(e.name.toLowerCase());
    if(col<0)continue;
    values[e.id]=String(row[col]??'');matched++;
   }
  }
  return {id:uid(),setId:set.id,name:String(nameIdx>=0?row[nameIdx]:'').trim()||'Card '+String(i+1).padStart(3,'0'),values,overrides:{},extraElements:[]};
 });
 const anyMatched=cards.some(c=>Object.keys(c.values).length>0);
 if(!anyMatched)throw Error('No spreadsheet columns match any assigned template fields.');
 if(S.cards.some(c=>Object.keys(c.overrides||{}).length)&&!confirm('Importing will replace staged cards and their individual layout edits. Continue?'))return;
 S.cards=cards;S.mode='cards';S.side='front';S.cardIndex=0;S.selected=null;syncEditorTemplate();repaint();
 toast('Imported '+cards.length+' cards into '+(new Set(cards.map(c=>c.setId))).size+' set(s)');
}
export async function readSheet(file){try{const rows=file.name.toLowerCase().endsWith('.csv')?parseCSV(await file.text()):await parseXLSX(file);applyTable(rows)}catch(err){alert('Spreadsheet import failed: '+err.message)}}

