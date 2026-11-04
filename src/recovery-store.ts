/** IndexedDB backup storage. All data stays in this browser profile. */
import type {StudioProject} from './types';
export interface RecoveryDraft {
 key:'latest'; format:1; savedAt:number; owner:string; revision:number; project:StudioProject;
}
let connection:Promise<IDBDatabase>|null=null;
function database():Promise<IDBDatabase>{
 if(connection)return connection;
 if(typeof indexedDB==='undefined')return Promise.reject(Error('IndexedDB unavailable'));
 connection=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('card-studio-local-recovery',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'key'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('Could not open local recovery storage'));
  request.onblocked=()=>reject(Error('Recovery database blocked by another tab'));
 }).catch(error=>{connection=null;throw error});
 return connection;
}
async function operation<T>(mode:IDBTransactionMode,fn:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await database();
 return new Promise<T>((resolve,reject)=>{
  const tx=db.transaction('drafts',mode);
  const request=fn(tx.objectStore('drafts'));
  let value:T;
  request.onsuccess=()=>{value=request.result};
  tx.oncomplete=()=>resolve(value);
  tx.onerror=()=>reject(tx.error||Error('Backup transaction failed'));
  tx.onabort=()=>reject(tx.error||Error('Backup transaction aborted'));
 });
}
export async function readRecoveryDraft():Promise<RecoveryDraft|null>{
 const draft=await operation<RecoveryDraft|undefined>('readonly',store=>store.get('latest'));
 if(!draft)return null;
 const p=draft.project;
 if(draft.format!==1||p?.type!=='cardstudio-project'||!Array.isArray(p.template?.elements)||
    !Array.isArray(p.cards)||!Array.isArray(p.sets))throw Error('The local backup is invalid.');
 return draft;
}
export async function writeRecoveryDraft(draft:RecoveryDraft):Promise<void>{
 await operation('readwrite',store=>store.put(draft));
}
export async function deleteRecoveryDraft():Promise<void>{
 await operation('readwrite',store=>store.delete('latest'));
}
