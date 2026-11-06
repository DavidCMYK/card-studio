/** An edit session can show a template that is not assigned to the active
 * staged card. Resolve the correct card set for its data worksheet without
 * changing the card selection, template or project. */
import {S,cardSetFor,templateById,isDataExported,textKinds} from './model';
import type {CardSet,CardTemplate} from './types';

export function preferredDataSetId(explicitSetId?:string):string{
 const sets=S.cardSets||[];
 if(!sets.length)throw Error('No card sets in project');
 const explicitlyChosen=sets.find(s=>s.id===explicitSetId);
 if(explicitlyChosen)return explicitlyChosen.id;
 const cardSet=cardSetFor(S.cards[S.cardIndex]);
 if(S.mode==='template'){
  const templateId=S.selectedTemplateId||S.template.id;
  const linked=sets.filter(s=>s.frontTemplateId===templateId||s.backTemplateId===templateId);
  if(linked.length)return linked.find(s=>s.id===cardSet?.id)?.id||linked[0].id;
 }
 return cardSet?.id||sets[0].id;
}

export interface DataTemplateSource {
 side:'front'|'back';
 templateId:string;
 name:string;
 fieldNames:string[];
}
export function dataTemplateSources(setId:string):DataTemplateSource[]{
 const set=S.cardSets?.find(x=>x.id===setId);
 if(!set)throw Error('Card set not found');
 const sources:DataTemplateSource[]=[];
 const ids=[{side:'front' as const,id:set.frontTemplateId},{side:'back' as const,id:set.backTemplateId}];
 for(const source of ids){
  if(!source.id||sources.some(item=>item.templateId===source.id))continue;
  const template=templateById(source.id);
  if(!template)throw Error('Card set "'+set.name+'" references an unavailable template');
  sources.push({
   side:source.side,templateId:source.id,name:template.name,
   fieldNames:template.elements.filter(e=>textKinds.includes(e.kind)&&isDataExported(e)).map(e=>e.name)
  });
 }
 return sources;
}
/** All visible data columns must have a live element in a template assigned
 * to this exact set. Unused card.values keys never become columns. */
export function dataSetContext(setId:string):{
 setName:string;sources:DataTemplateSource[];activeTemplateName:string|null;activeTemplateUsed:boolean
}{
 const set=S.cardSets?.find(x=>x.id===setId);
 if(!set)throw Error('Card set not found');
 const sources=dataTemplateSources(setId);
 const active=S.mode==='template'?templateById(S.selectedTemplateId||S.template.id):undefined;
 return {
  setName:set.name,sources,activeTemplateName:active?.name||null,
  activeTemplateUsed:!active||sources.some(source=>source.templateId===active.id)
 };
}
