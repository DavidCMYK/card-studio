import { S } from './model';
import { imageCache } from './image-sets';
import { repaint } from './interface';
import { toast } from './dom';
let pendingAssetsSet: string | null = null;
export function setTargetImageSet(id: string) { pendingAssetsSet = id; }
const blobImage=async (f: File): Promise<string> =>await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result || ""));r.onerror=()=>reject(Error('Could not read '+f.name));r.readAsDataURL(f)});
export async function importImages(files){if(!pendingAssetsSet)return;const set=S.sets.find(x=>x.id===pendingAssetsSet);if(!set)return;const input=[...files].filter(f=>f.type.startsWith('image/')).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));try{let added=0,skipped=0;for(const f of input){if(set.images.some(im=>im.name.toLowerCase()===f.name.toLowerCase())){skipped++;continue}const data=await blobImage(f);set.images.push({name:f.name,data});added++}imageCache.clear();repaint();toast(`Loaded ${added} image(s) into ${set.name}`+(skipped?` · ${skipped} duplicate name(s) skipped`:''))}catch(err){alert(err.message)}}

