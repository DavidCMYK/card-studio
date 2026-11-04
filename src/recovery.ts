/** Debounced, local-only crash recovery. Never overwrites a chosen project file. */
import {S,initial,replaceState,escapeHTML} from './model';
import {subscribeHistory,historyRevision,resetHistory,checkpoint} from './history';
import {imageCache} from './image-sets';
import {repaint} from './interface';
import {activateProjectFonts} from './project-fonts';
import {readRecoveryDraft,writeRecoveryDraft,deleteRecoveryDraft,RecoveryDraft} from './recovery-store';

const DELAY=1600;
let started=false,available=false,blocked=false,dirty=false;
let owner='',bootTime=0;
let pending:RecoveryDraft|null=null;
let timer:ReturnType<typeof setTimeout>|null=null;
let lastSavedRevision=-1;
let queue:Promise<void>=Promise.resolve();
let resetFileHandles=()=>{};
let lastError:unknown=null;
function status(message:string,error=false){
 for(const id of ['recoveryStatus','mobileRecoveryStatus']){
  const node=typeof document!=='undefined'&&document.getElementById?document.getElementById(id):null;
  if(node){
   node.textContent=message;
   node.title=error?'Local recovery unavailable; save a project JSON manually.':'Local recovery only; save a project JSON for a permanent copy.';
  }
 }
}
function fail(error:unknown){
 lastError=error;
 console.warn('Local recovery:',error);
 status('Local backup unavailable — save project',true);
}
function cancel(){if(timer!==null){clearTimeout(timer);timer=null}}
function runSequential(task:()=>Promise<void>):Promise<void>{
 const next=queue.catch(()=>{}).then(task);
 queue=next.catch(fail);
 return next;
}
function changed(){
 if(!started)return;
 dirty=true;
 if(blocked){status('Choose whether to recover the previous project');return}
 if(!available){status('Local backup unavailable — save project',true);return}
 status('Backing up…');
 cancel();
 timer=setTimeout(()=>{timer=null;void flushRecovery()},DELAY);
}
/** Keep a draft of an actively edited text field without creating undo steps per keystroke. */
export function noteLiveEdit(){changed()}
export function flushRecovery():Promise<void>{
 if(!available||blocked||!dirty)return Promise.resolve();
 cancel();
 let draft:RecoveryDraft;
 try{
  draft={key:'latest',format:1,savedAt:Date.now(),owner,
    revision:historyRevision(),project:structuredClone(S)};
 }catch(error){fail(error);return Promise.resolve()}
 dirty=false;
 return runSequential(async()=>{
  const existing=await readRecoveryDraft();
  // Do not overwrite a backup created by another active tab since this one opened.
  if(existing&&existing.owner!==owner&&existing.savedAt>bootTime){
   dirty=true;
   status('Another tab has a newer backup — save project',true);
   return;
  }
  await writeRecoveryDraft(draft);
  lastSavedRevision=draft.revision;
  if(lastSavedRevision===historyRevision())status('Backed up locally');
  else status('Backing up…');
 }).catch(error=>{dirty=true;fail(error)});
}
function closeDialog(){document.getElementById('recoveryDialog')?.remove()}
function recoveryDialog(draft:RecoveryDraft){
 blocked=true;cancel();pending=draft;closeDialog();
 const root=document.createElement('div');
 root.id='recoveryDialog';root.className='recovery-backdrop';
 const title=escapeHTML(draft.project.projectName||'Untitled deck');
 const when=escapeHTML(new Date(draft.savedAt).toLocaleString());
 root.innerHTML='<section class="recovery-panel" role="dialog" aria-modal="true" aria-labelledby="recoveryHeading">'+
  '<h2 id="recoveryHeading">Recover unsaved changes?</h2>'+
  '<p>Card Studio found a local backup of <strong>'+title+'</strong> from <strong>'+when+'</strong>.</p>'+
  '<p>It includes cards, images and embedded fonts. Restoring it does not overwrite your project files.</p>'+
  '<div class="recovery-actions"><button id="recoveryRestore" class="accent">Restore changes</button>'+
  '<button id="recoveryDownload" class="secondary">Download backup JSON</button>'+
  '<button id="recoveryDiscard" class="secondary">Discard backup</button></div></section>';
 document.body.append(root);
 const restore=root.querySelector('#recoveryRestore') as HTMLButtonElement;
 const discard=root.querySelector('#recoveryDiscard') as HTMLButtonElement;
 const disable=(value:boolean)=>{restore.disabled=value;discard.disabled=value};
 restore.focus();
 restore.addEventListener('click',async()=>{
  disable(true);
  try{
   if(!pending)throw Error('Recovery copy no longer available');
   const copy=structuredClone(pending.project);
   resetFileHandles();
   replaceState({...initial(),...copy});
   imageCache.clear();resetHistory();
   await activateProjectFonts();
   blocked=false;pending=null;dirty=false;closeDialog();
   repaint();
   status('Recovered locally — save project JSON');
   // Keep the recovery backup until the recovered project is saved explicitly.
  }catch(error){fail(error);disable(false)}
 });
 discard.addEventListener('click',async()=>{
  disable(true);
  try{
   await runSequential(async()=>{
    const current=await readRecoveryDraft();
    if(current&&current.owner===draft.owner&&current.savedAt===draft.savedAt)await deleteRecoveryDraft();
   });
   blocked=false;pending=null;dirty=false;closeDialog();
   status('Local recovery ready');
  }catch(error){fail(error);disable(false)}
 });
 (root.querySelector('#recoveryDownload') as HTMLButtonElement).addEventListener('click',()=>{
  if(!pending)return;
  const blob=new Blob([JSON.stringify(pending.project,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(pending.project.projectName||'card-deck').replace(/[\\/:*?"<>|]/g,'_')+'.recovered.cardstudio.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 });
 status('Recovery available');
}
export async function showRecovery():Promise<void>{
 if(!available){status(lastError?'Local backup unavailable':'Checking local recovery…',!!lastError);return}
 try{
  const draft=await readRecoveryDraft();
  if(draft)recoveryDialog(draft);
  else status('No local recovery copy');
 }catch(error){fail(error)}
}
/** Only a confirmed full-project save clears the local backup. */
export async function recordProjectSaved(revisionWhenSaving:number):Promise<void>{
 if(!available||blocked||revisionWhenSaving!==historyRevision())return;
 cancel();dirty=false;
 await runSequential(async()=>{
  const current=await readRecoveryDraft();
  if(current?.owner===owner)await deleteRecoveryDraft();
  lastSavedRevision=revisionWhenSaving;
  status('Project saved');
 }).catch(fail);
}
/** Switching projects starts a new recovery history without reusing the old draft. */
export function recordProjectReplaced(){
 cancel();dirty=false;
 if(blocked)return;
 status('Local recovery ready');
 // Do not discard a backup from a different tab or an unresolved prior session.
 if(available)void runSequential(async()=>{
  const current=await readRecoveryDraft();
  if(current?.owner===owner)await deleteRecoveryDraft();
 }).catch(fail);
}
export function initRecovery(onRestored:()=>void){
 if(started)return;
 started=true;resetFileHandles=onRestored;
 bootTime=Date.now();
 try{
  owner=sessionStorage.getItem('cardstudio-recovery-owner')||'tab-'+Math.random().toString(36).slice(2);
  sessionStorage.setItem('cardstudio-recovery-owner',owner);
 }catch{owner='tab-'+Math.random().toString(36).slice(2)}
 subscribeHistory(changed);
 status('Checking local recovery…');
 void (async()=>{
  try{
   const draft=await readRecoveryDraft();
   available=true;
   if(draft)recoveryDialog(draft);
   else status('Local recovery ready');
  }catch(error){available=false;fail(error)}
 })();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){checkpoint();void flushRecovery()}});
 window.addEventListener('pagehide',()=>{checkpoint();void flushRecovery()});
}
