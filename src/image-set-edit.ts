/** Mutations for named images within an existing image set.
 * An image's name is the stable reference in Single Image templates and card data.
 */
import { S } from './model';
import { imageCache } from './image-sets';

const normal = (name: string) => String(name).trim().toLocaleLowerCase();
const basename = (name: string) => name.replace(/\.[^.]+$/, '');
const match = (a: string, b: string) => normal(a) === normal(b);

/** Whether a per-card image value identifies this asset unambiguously. */
function referencedValue(value: string, setName: string, fileName: string) {
 const path = String(value).replace(/\\/g, '/').trim();
 if(match(path, setName + '/' + fileName)) return 'qualified';
 const all = S.sets.flatMap(set => set.images.map(im => ({ set, im })));
 // The renderer prefers a matching unqualified filename or filename without extension.
 if(match(path, fileName)) {
  return all.filter(x => match(x.im.name, fileName)).length === 1 ? 'name' : null;
 }
 if(match(path, basename(fileName))) {
  return all.filter(x => match(basename(x.im.name), basename(fileName))).length === 1 ? 'basename' : null;
 }
 return null;
}

function updateReferences(set: {id:string,name:string}, oldName: string, newName: string | null) {
 const frames = [...S.template.elements, ...S.cards.flatMap(card => card.extraElements || [])];
 for(const frame of frames) {
  if(frame.kind === 'image' && (frame.autoSet === set.id || frame.autoSet === set.name) && match(frame.singleImage || '', oldName))
   frame.singleImage = newName || '';
 }
 for(const card of S.cards) {
  for(const [elementId,override] of Object.entries(card.overrides || {})) {
   const original = S.template.elements.find(e => e.id === elementId);
   const assignedSet = override.autoSet ?? original?.autoSet;
   if((assignedSet === set.id || assignedSet === set.name) && match(override.singleImage || '',oldName))
    override.singleImage = newName || '';
  }
  for(const [elementId,value] of Object.entries(card.values || {})) {
   if(typeof value !== 'string') continue;
   const kind = referencedValue(value,set.name,oldName);
   if(!kind) continue;
   card.values[elementId] = newName === null ? 'none' : kind === 'qualified' ? set.name + '/' + newName : kind === 'basename' ? basename(newName) : newName;
  }
 }
}

export function renameImage(setId: string, oldName: string, requestedName: string) {
 const set = S.sets.find(set => set.id === setId);
 if(!set) throw Error('Image set not found');
 const image = set.images.find(im => im.name === oldName);
 if(!image) throw Error('Image not found');
 const newName = requestedName.trim();
 if(!newName) throw Error('Enter a filename');
 if(/[\\/]/.test(newName)) throw Error('Filenames cannot contain slashes');
 if(newName === oldName) return false;
 if(set.images.some(im => im !== image && match(im.name,newName))) throw Error('Another image in this set already has that name');
 updateReferences(set, oldName, newName);
 image.name = newName;
 imageCache.clear();
 return true;
}

export function removeImage(setId: string, fileName: string) {
 const set = S.sets.find(set => set.id === setId);
 if(!set) throw Error('Image set not found');
 const index = set.images.findIndex(im => im.name === fileName);
 if(index < 0) throw Error('Image not found');
 // Clear references before deleting, so ambiguous unqualified names are handled correctly.
 updateReferences(set, fileName, null);
 set.images.splice(index,1);
 imageCache.clear();
}
