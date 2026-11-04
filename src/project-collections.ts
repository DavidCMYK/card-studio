/** Shared card template and card-set management. A template never belongs to just one side. */
import type {CardSet,CardTemplate,CardSide,StagedCard} from './types';
import {S,uid,templateById,cardSetFor,assignedTemplate,selectProjectTemplate,syncEditorTemplate} from './model';
import {trimDimensionsMm} from './card-guides';

export function cloneTemplate(source:CardTemplate,name:string):CardTemplate{
 const copy=structuredClone(source);
 const mapping=new Map<string,string>();
 for(const el of copy.elements){const newId=uid();mapping.set(el.id,newId);el.id=newId;}
 for(const el of copy.elements)if(el.linkedTextId)el.linkedTextId=mapping.get(el.linkedTextId)||'';
 copy.id=uid();copy.name=name;
 return copy;
}
export function createTemplate(source?:CardTemplate):CardTemplate{
 const template=source?cloneTemplate(source,source.name+' copy'):{
  ...structuredClone(S.template),id:uid(),name:'New template',elements:[]
 };
 S.templates!.push(template);
 selectProjectTemplate(template.id!);
 return template;
}
export function deleteTemplate(id:string):void{
 if(S.templates!.length<=1)throw Error('At least one template is required');
 if(S.cardSets!.some(set=>set.frontTemplateId===id||set.backTemplateId===id))
  throw Error('This template is assigned to a card set. Reassign its fronts and backs before deleting it.');
 const index=S.templates!.findIndex(t=>t.id===id);
 if(index<0)return;
 S.templates!.splice(index,1);
 if(S.selectedTemplateId===id)selectProjectTemplate(S.templates![0].id!);
}
export function newCardSet(name:string,frontTemplateId?:string):CardSet{
 const id=frontTemplateId||S.selectedTemplateId||S.templates![0].id!;
 if(!templateById(id))throw Error('Select a valid front template');
 const set:CardSet={id:uid(),name:name.trim()||'New card set',frontTemplateId:id};
 S.cardSets!.push(set);
 return set;
}
export function deleteCardSet(id:string):void{
 if(S.cardSets!.length<=1)throw Error('At least one card set is required');
 if(S.cards.some(c=>c.setId===id))throw Error('Move or delete cards in this set before deleting it.');
 S.cardSets=S.cardSets!.filter(s=>s.id!==id);
}
export function checkSetSize(set:CardSet):boolean{
 if(!set.backTemplateId)return true;
 const front=templateById(set.frontTemplateId),back=templateById(set.backTemplateId);
 if(!front||!back)return false;
 const a=trimDimensionsMm(front),b=trimDimensionsMm(back);
 return Math.abs(a.width-b.width)<0.01&&Math.abs(a.height-b.height)<0.01;
}
export function assignSetTemplate(setId:string,side:CardSide,templateId:string):void{
 const set=S.cardSets!.find(s=>s.id===setId);if(!set)throw Error('Card set not found');
 if(!templateId&&side==='back'){
  delete set.backTemplateId;
  if(S.mode==='cards'&&S.side==='back'&&cardSetFor(S.cards[S.cardIndex])?.id===setId){S.side='front';syncEditorTemplate();}
  return;
 }
 const template=templateById(templateId);if(!template)throw Error('Template not found');
 const prior=side==='front'?set.frontTemplateId:set.backTemplateId;
 if(side==='front')set.frontTemplateId=templateId;else set.backTemplateId=templateId;
 if(!checkSetSize(set)){
  if(side==='front')set.frontTemplateId=prior!;else set.backTemplateId=prior;
  throw Error('Front and back templates must have matching finished cut dimensions');
 }
 if(S.mode==='cards'&&cardSetFor(S.cards[S.cardIndex])?.id===setId)syncEditorTemplate();
}
export function moveCardToSet(card:StagedCard,setId:string):void{
 const set=S.cardSets!.find(s=>s.id===setId);if(!set)throw Error('Card set not found');
 card.setId=set.id;
 if(S.mode==='cards'){if(S.side==='back'&&!assignedTemplate(S.cardIndex,'back'))S.side='front';syncEditorTemplate();}
}
