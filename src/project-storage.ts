import { S, initial, replaceState, safeFile } from './model';
import { jsonDownload, toast } from './dom';
import { imageCache } from './image-sets';
import { repaint } from './interface';
// Version 1 treated pixel-sized templates as CSS-pixel layouts and bypassed
// DPI when exporting. Scale the stored design geometry so legacy output pixel
// dimensions and relative placement remain unchanged under the corrected model.
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
  for(const [id,override] of Object.entries(c.overrides||{}))scaleFields(override);
 }
 obj.version=2;
 return obj;
}
export function saveProject(){jsonDownload({...S,type:'cardstudio-project',version:2},safeFile(S.projectName)+'.cardstudio.json');toast('Project saved, including embedded image sets')}
export function saveTemplate(){jsonDownload({type:'cardstudio-template',version:2,template:S.template},safeFile(S.template.name)+'.template.json');toast('Template saved')}
export async function openJSON(file,onlyTemplate=false){try{const obj=migrateProjectUnits(JSON.parse(await file.text()));if(!obj.template?.elements||!Array.isArray(obj.template.elements))throw Error('Not a Card Studio project or template');if(onlyTemplate||obj.type==='cardstudio-template'){
 S.template=obj.template;S.selected=null;for(const e of S.template.elements)if(e.kind==='image'&&!S.sets.some(x=>x.id===e.autoSet))e.autoSet='';for(const c of S.cards){c.overrides={};c.values={};c.extraElements=[]}toast('Template loaded. Existing staged cards reset.')
 }else{if(!Array.isArray(obj.cards)||!Array.isArray(obj.sets))throw Error('Project does not contain cards and image sets');replaceState({...initial(),...obj,mode:'template',selected:null,cardIndex:0});imageCache.clear();toast('Project loaded')}
 repaint()}catch(err){alert('Could not open file: '+err.message)}}

