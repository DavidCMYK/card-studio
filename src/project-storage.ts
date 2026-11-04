import { S, initial, replaceState, safeFile,selectProjectTemplate,templateById,normalizeProject } from './model';
import {cloneTemplate} from './project-collections';
import { $, jsonDownload, download, toast } from './dom';
import { imageCache } from './image-sets';
import { repaint } from './interface';
import {activateProjectFonts,unbundledFontFamilies} from './project-fonts';
import {resetHistory,historyRevision} from './history';
import {recordProjectSaved,recordProjectReplaced} from './recovery';

// File handles are deliberately kept out of saved project JSON. They are only
// valid for the browser session and must be granted by the user via a picker.
type SavedFileHandle = {name: string; createWritable: () => Promise<{write: (data: string) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void>}>; getFile?: () => Promise<File>};
let projectFileHandle: SavedFileHandle | null = null;
const templateFileHandles = new Map<string,SavedFileHandle>();
export function resetFileHandles() { projectFileHandle = null; templateFileHandles.clear(); }

const projectName = () => safeFile(S.projectName) + '.cardstudio.json';
const templateName = () => safeFile(S.template.name) + '.template.json';
const projectContents = () => ({...S, template:(S.templates||[S.template])[0],templates:S.templates||[S.template],cardSets:S.cardSets,type:'cardstudio-project',version:2});
const templateContents = (template=S.template) => ({type:'cardstudio-template',version:2,template,fonts:S.fonts||[]});
const filePicker = (type: 'project'|'template', name: string) => ({
 suggestedName: name,
 types:[{description: type==='project'?'Card Studio project':'Card Studio template',accept:{'application/json':['.json']}}]
});
function isCancel(error: any) { return error?.name === 'AbortError'; }

async function saveDocument(type: 'project'|'template', saveAs = false): Promise<boolean> {
 const isProject=type==='project';
 const handle=isProject?projectFileHandle:templateFileHandles.get(S.template.id||'')||null;
 const name=isProject?projectName():templateName();
 const data=isProject?projectContents():templateContents();
 const revisionWhenSaving=historyRevision();
 const picker=(window as any).showSaveFilePicker;
 if (typeof picker!=='function' && (!handle || saveAs)) {
  // Downloads cannot replace an existing local file. Do not claim otherwise.
  jsonDownload(data,name);
  toast('Downloaded a copy. To overwrite files directly, use Chrome or Edge with file access enabled.');
  return false;
 }
 try {
  // Call the picker synchronously at the start of this user-triggered action.
  const destination = !saveAs && handle ? handle : await picker.call(window,filePicker(type,name));
  const writable=await destination.createWritable();
  try { await writable.write(JSON.stringify(data,null,2)); await writable.close(); }
  catch(err) { try { await writable.abort?.(); } catch {} throw err; }
  if(isProject)projectFileHandle=destination;else templateFileHandles.set(S.template.id!,destination);
  if(isProject)await recordProjectSaved(revisionWhenSaving);
  toast(`${isProject?'Project':'Template'} saved to ${destination.name}`);
  return true;
 } catch(error) {
  if (!isCancel(error)) alert('Could not save '+type+': '+(error as Error).message);
  return false;
 }
}
/** Save every template separately. Use a native directory where supported, or
 * download one ZIP with independent template files everywhere else. */
export async function saveAllTemplates():Promise<void>{
 const templates=S.templates||[S.template],contents=templates.map(t=>({t,data:templateContents(t)}));
 const filenames=new Set<string>();
 const entries=contents.map(({t,data})=>{
  const stem=safeFile(t.name);let name=stem+'.template.json',index=2;
  while(filenames.has(name.toLowerCase()))name=stem+'_'+index+++'.template.json';
  filenames.add(name.toLowerCase());return {template:t,name,data};
 });
 const directoryPicker=(window as any).showDirectoryPicker;
 if(typeof directoryPicker==='function'){
  try{
   const directory=await directoryPicker.call(window,{mode:'readwrite'});
   for(const entry of entries){
    const handle=await directory.getFileHandle(entry.name,{create:true});
    const writable=await handle.createWritable();
    await writable.write(JSON.stringify(entry.data,null,2));
    await writable.close();
    templateFileHandles.set(entry.template.id!,handle);
   }
   toast('Saved '+entries.length+' individual templates into the selected folder');
   return;
  }catch(error){if(isCancel(error))return;alert('Could not save templates in folder: '+(error as Error).message);return;}
 }
 const zip=new JSZip();
 for(const entry of entries)zip.file(entry.name,JSON.stringify(entry.data,null,2));
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
 download(blob,safeFile(S.projectName)+'_templates.zip');
 toast('Downloaded '+entries.length+' separate template files in ZIP');
}
export const saveProject=()=>saveDocument('project');
export const saveProjectAs=()=>saveDocument('project',true);
export const saveTemplate=()=>saveDocument('template');
export const saveTemplateAs=()=>saveDocument('template',true);

export async function openFromDisk(type: 'project'|'template') {
 const picker=(window as any).showOpenFilePicker;
 if(typeof picker!=='function') {
  $(type==='project'?'#openProjectFile':'#openTemplateFile').click();
  return;
 }
 try {
  const [handle]=await picker.call(window,{multiple:false,types:filePicker(type,'').types});
  if(!handle)return;
  await openJSON(await handle.getFile(),type==='template',handle);
 } catch(error) {
  if(!isCancel(error))alert('Could not open '+type+': '+(error as Error).message);
 }
}

// Version 1 treated pixel-sized templates as CSS-pixel layouts and bypassed
// DPI when exporting. Scale stored geometry to preserve legacy appearance.
export function migrateProjectUnits(obj: any) {
 if(Number(obj.version??1)>=2 || obj.template?.unit!=='px')return obj;
 const dpi=Number(obj.template.dpi)||300, scale=96/dpi;
 const fields=['x','y','w','h','fontSize','borderWidth','radius','letterSpacing','imgOffsetX','imgOffsetY'];
 const scaleFields=(e: any)=>{
  if(!e)return;
  for(const name of fields)if(typeof e[name]==='number')e[name]*=scale;
  if(e.imageFit==='free'&&typeof e.imgScale==='number')e.imgScale*=scale;
 };
 for(const e of obj.template.elements)scaleFields(e);
 for(const c of obj.cards||[]){
  for(const e of c.extraElements||[])scaleFields(e);
  for(const override of Object.values(c.overrides||{}))scaleFields(override);
 }
 obj.version=2;
 return obj;
}

// Old card-only opacity overrides must take precedence over newer defaults.
export function migrateComponentOpacities(obj: any) {
 for(const c of obj.cards||[])for(const override of Object.values(c.overrides||{}) as any[]){
  if(typeof override.opacity==='number')for(const part of ['fillOpacity','borderOpacity','textOpacity']){
   if(override[part]===undefined)override[part]=override.opacity;
  }
 }
 return obj;
}

export async function openJSON(file: {text: () => Promise<string>}, onlyTemplate=false, handle: SavedFileHandle | null=null) {
 try {
  const obj=migrateComponentOpacities(migrateProjectUnits(JSON.parse(await file.text())));
  if(!obj.template?.elements||!Array.isArray(obj.template.elements))throw Error('Not a Card Studio project or template');
  if(onlyTemplate && obj.type==='cardstudio-project')throw Error('This is a project file, not a template. Use Open project instead.');
  if(onlyTemplate||obj.type==='cardstudio-template'){
   // Importing a template adds a new independent template without replacing
   // any existing template or clearing cards/data. Remap element IDs so a
   // separately loaded template cannot accidentally share field IDs.
   normalizeProject(S);
   const added=cloneTemplate(obj.template,obj.template.name||'Imported template');
   S.templates!.push(added);
   const incoming=Array.isArray(obj.fonts)?obj.fonts:[];
   S.fonts??=[];
   for(const font of incoming){
    if(!S.fonts.some(f=>f.family===font.family&&f.weight===font.weight&&f.style===font.style))
     S.fonts.push(font);
   }
   selectProjectTemplate(added.id!);
   if(handle)templateFileHandles.set(added.id!,handle);
   toast('Template added: '+added.name);
  }else{
   if(!Array.isArray(obj.cards)||!Array.isArray(obj.sets))throw Error('Project does not contain cards and image sets');
   replaceState({...initial(),...obj,fonts:Array.isArray(obj.fonts)?obj.fonts:[],mode:'template',selected:null,cardIndex:0});
   imageCache.clear();projectFileHandle=handle;templateFileHandles.clear();
   toast('Project loaded');
  }
  resetHistory();recordProjectReplaced();
  await activateProjectFonts();
  repaint();
  // Even familiar system fonts (Georgia, Arial, etc.) are not guaranteed to
  // render identically on Android, iOS and desktop. Only packaged fonts travel.
  const missing=unbundledFontFamilies();
  if(missing.length)toast('Project uses fonts not included in the file: '+missing.slice(0,3).join(', ')+(missing.length>3?'…':''));
  return true;
 }catch(err){alert('Could not open file: '+(err as Error).message);return false;}
}
