import {S,escapeHTML,assignedTemplate,cardExtras,setCardSide,safeFile} from './model';
import {repaint,chooseCard} from './interface';
import {download} from './dom';
import {scanDeck,PreflightReport} from './preflight';

/** Escape CSV text and neutralize formulas when opened in Excel. */
const csvCell=(value:string)=>{
 const text=String(value??'');
 const safe=/^\s*[=+\-@\t\r]/.test(text)?"'"+text:text;
 return '"'+safe.replace(/"/g,'""')+'"';
};
export function preflightCSV(report:PreflightReport):string {
 const lines=[['Severity','Card set','Card','Side','Element','Rule','Details'].map(csvCell).join(',')];
 for(const issue of report.findings)
  lines.push([issue.severity,issue.setName,issue.cardName,issue.side||'',
   issue.elementName,issue.code,issue.message].map(csvCell).join(','));
 return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
const css=`<style>
#preflightDialog{position:fixed;inset:0;z-index:15100;background:#09131bcc;display:flex;align-items:center;justify-content:center;padding:12px;color:#e7edf6;font:14px system-ui}
#preflightDialog *{box-sizing:border-box}
#preflightDialog .pf-panel{background:#15263b;border:1px solid #60758b;border-radius:10px;max-height:94vh;width:min(960px,100%);display:flex;flex-direction:column;overflow:hidden}
#preflightDialog .pf-header,#preflightDialog .pf-footer{display:flex;align-items:center;gap:10px;padding:12px;background:#21384e}
#preflightDialog .pf-header strong{flex:1;font-size:18px}
#preflightDialog button,#preflightDialog input,#preflightDialog select{background:#2c4762;color:#f0f5fc;border:1px solid #748a9f;border-radius:5px;padding:7px;max-width:100%}
#preflightDialog button{cursor:pointer}
#preflightDialog .pf-body{padding:14px;overflow:auto}
#preflightDialog .pf-filters{display:flex;gap:10px;margin:8px 0 14px;flex-wrap:wrap}
#preflightDialog .pf-filters input{flex:1;min-width:190px}
#preflightDialog .pf-list{display:flex;flex-direction:column;gap:8px}
#preflightDialog .pf-item{display:flex;align-items:center;gap:12px;border:1px solid #516780;border-left:4px solid #e9af59;border-radius:5px;padding:9px}
#preflightDialog .pf-item[data-severity="error"]{border-left-color:#e77878}
#preflightDialog .pf-message{flex:1;min-width:0}
#preflightDialog .pf-location{font-weight:650;overflow-wrap:anywhere}
#preflightDialog .pf-detail,#preflightDialog .pf-hint{font-size:12px;color:#c0cddc;line-height:1.5}
#preflightDialog .pf-footer{justify-content:flex-end;flex-wrap:wrap}
@media(max-width:650px){#preflightDialog{padding:4px}#preflightDialog .pf-panel{max-height:99vh}#preflightDialog .pf-item{align-items:flex-start;flex-direction:column}}
</style>`;
export function openPreflight():void {
 const holder=document.querySelector('#dialogHolder') as HTMLElement|null;
 if(!holder)return;
 holder.innerHTML=css+`<section id="preflightDialog"><div class="pf-panel" role="dialog" aria-modal="true" aria-label="Deck preflight">
 <header class="pf-header"><strong>Check deck for print</strong><button data-pf="close">Close</button></header>
 <div class="pf-body"><p class="pf-hint">Checks exported card fronts and assigned backs without modifying the project.</p>
 <p id="pfSummary" aria-live="polite">Checking all cards and their artwork…</p>
 <div class="pf-filters"><select id="pfSeverity" aria-label="Filter severity"><option value="all">All findings</option><option value="error">Errors</option><option value="warning">Warnings</option></select>
 <input id="pfQuery" placeholder="Search cards, sets, fields and issues" aria-label="Search findings"></div>
 <div class="pf-list" id="pfFindings"></div><p id="pfLimit" class="pf-hint"></p></div>
 <footer class="pf-footer"><small class="pf-hint" style="flex:1">Warnings are advisory. Confirm production requirements with your print service.</small>
 <button data-pf="csv" disabled>Download report CSV</button><button data-pf="close">Close</button></footer>
 </div></section>`;
 const root=holder.querySelector('#preflightDialog') as HTMLElement;
 const summary=root.querySelector('#pfSummary') as HTMLElement;
 const list=root.querySelector('#pfFindings') as HTMLElement;
 const limit=root.querySelector('#pfLimit') as HTMLElement;
 const severity=root.querySelector('#pfSeverity') as HTMLSelectElement;
 const query=root.querySelector('#pfQuery') as HTMLInputElement;
 const csv=root.querySelector<HTMLButtonElement>('[data-pf="csv"]')!;
 let report:PreflightReport|null=null;
 const close=()=>{if(holder.querySelector('#preflightDialog')===root)holder.innerHTML='';};
 const render=()=>{
  if(!report)return;
  const errors=report.findings.filter(f=>f.severity==='error').length;
  summary.textContent=report.checkedCards+' cards · '+report.checkedSides+' sides · '+
   report.checkedImages+' image files checked · '+errors+' errors · '+(report.findings.length-errors)+' warnings';
  const needle=query.value.toLowerCase().trim();
  const filtered=report.findings.map((issue,index)=>({issue,index})).filter(({issue})=>
   (severity.value==='all'||issue.severity===severity.value)&&
   (!needle||[issue.setName,issue.cardName,issue.side||'',issue.elementName,issue.message,issue.code]
    .some(part=>part.toLowerCase().includes(needle))));
  list.innerHTML=filtered.length?filtered.slice(0,250).map(({issue,index})=>{
   const where=[issue.setName,issue.cardName,issue.side,issue.elementName].filter(Boolean).join(' · ');
   return `<div class="pf-item" data-severity="${issue.severity}"><div class="pf-message">
    <div class="pf-location">${issue.severity.toUpperCase()} · ${escapeHTML(where)}</div>
    <div class="pf-detail">${escapeHTML(issue.message)}</div></div>
    ${issue.cardIndex!==null?'<button data-pf-jump="'+index+'">Go to card</button>':''}</div>`;
  }).join(''):'<p>No matching findings.</p>';
  limit.textContent=filtered.length>250?'Showing first 250 of '+filtered.length+' findings. Filter to narrow results.':'';
  csv.disabled=false;
 };
 root.addEventListener('click',event=>{
  const target=event.target as HTMLElement;
  if(target===root){close();return;}
  const action=target.closest<HTMLElement>('[data-pf]')?.dataset.pf;
  if(action==='close'){close();return;}
  if(action==='csv'&&report){
   download(new Blob([preflightCSV(report)],{type:'text/csv;charset=utf-8'}),safeFile(S.projectName)+'_preflight.csv');
   return;
  }
  const idx=target.closest<HTMLElement>('[data-pf-jump]')?.dataset.pfJump;
  if(idx===undefined||!report)return;
  const issue=report.findings[Number(idx)];
  if(issue?.cardIndex===null||issue?.cardIndex===undefined)return;
  close();
  chooseCard(issue.cardIndex);
  if(issue.side)setCardSide(issue.side);
  const template=assignedTemplate(issue.cardIndex,issue.side||'front');
  const elements=[...(template?.elements||[]),...cardExtras(S.cards[issue.cardIndex],issue.side||'front')];
  S.selected=elements.find(element=>element.name===issue.elementName)?.id||null;
  repaint();
 });
 severity.addEventListener('change',render);
 query.addEventListener('input',render);
 void scanDeck().then(result=>{
  if(holder.querySelector('#preflightDialog')!==root)return;
  report=result;render();
 }).catch(error=>{
  if(holder.querySelector('#preflightDialog')!==root)return;
  summary.textContent='Deck check failed: '+(error as Error).message;
 });
}
