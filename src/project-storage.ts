import { S, initial, replaceState, safeFile } from './model';
import { jsonDownload, toast } from './dom';
import { imageCache } from './image-sets';
import { repaint } from './interface';
export function saveProject(){jsonDownload({...S,type:'cardstudio-project',version:1},safeFile(S.projectName)+'.cardstudio.json');toast('Project saved, including embedded image sets')}
export function saveTemplate(){jsonDownload({type:'cardstudio-template',version:1,template:S.template},safeFile(S.template.name)+'.template.json');toast('Template saved')}
export async function openJSON(file,onlyTemplate=false){try{const obj=JSON.parse(await file.text());if(!obj.template?.elements||!Array.isArray(obj.template.elements))throw Error('Not a Card Studio project or template');if(onlyTemplate||obj.type==='cardstudio-template'){
 S.template=obj.template;S.selected=null;for(const e of S.template.elements)if(e.kind==='image'&&!S.sets.some(x=>x.id===e.autoSet))e.autoSet='';for(const c of S.cards){c.overrides={};c.values={};c.extraElements=[]}toast('Template loaded. Existing staged cards reset.')
 }else{if(!Array.isArray(obj.cards)||!Array.isArray(obj.sets))throw Error('Project does not contain cards and image sets');replaceState({...initial(),...obj,mode:'template',selected:null,cardIndex:0});imageCache.clear();toast('Project loaded')}
 repaint()}catch(err){alert('Could not open file: '+err.message)}}

