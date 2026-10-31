// @ts-nocheck
import { S, card, safeFile } from './model';
import { $, download, toast } from './dom';
import { canvasCard } from './png-renderer';
const toBlob=cvs=>new Promise(resolve=>cvs.toBlob(resolve,'image/png'));
export async function exportPNG(){try{const ci=S.cardIndex,cvs=await canvasCard(ci,S.mode==='cards'?'cards':'template'),blob=await toBlob(cvs);if(!blob)throw Error('Could not create PNG');download(blob,safeFile(S.mode==='cards'?card().name:S.template.name)+'.png');toast('PNG exported at '+S.template.dpi+' DPI')}catch(err){alert('PNG export failed: '+err.message)}}
export async function exportAll(){if(!S.cards.length){toast('No cards staged');return}const b=$('[data-action="export-all"]'),previous=b.textContent;b.disabled=true;try{const zip=new JSZip();const used={};for(let i=0;i<S.cards.length;i++){b.textContent=`Exporting ${i+1}/${S.cards.length}`;const cvs=await canvasCard(i,'cards'),blob=await toBlob(cvs);if(!blob)throw Error('PNG generation failed');let name=safeFile(S.cards[i].name),suffix=1;while(used[name.toLowerCase()])name=safeFile(S.cards[i].name)+'_'+(++suffix);used[name.toLowerCase()]=true;zip.file(name+'.png',blob);if(i%3===2)await new Promise(r=>setTimeout(r,0))}b.textContent='Creating ZIP…';const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});download(blob,safeFile(S.projectName)+'_cards.zip');toast('Exported '+S.cards.length+' cards to ZIP')}catch(err){alert('Batch export failed: '+err.message)}finally{b.textContent=previous;b.disabled=false}}

