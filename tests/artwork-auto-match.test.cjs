const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../.build/model.js');
const collections=require('../.build/project-collections.js');
const history=require('../.build/history.js');
const {getImageRef}=require('../.build/image-sets.js');
const match=require('../.build/artwork-auto-match.js');
const {gridColumns}=require('../.build/card-data-grid.js');

function setup(){
 const state=model.initial();
 model.replaceState(state);history.resetHistory();
 const set=state.cardSets[0],image=state.template.elements.find(e=>e.kind==='image');
 const imgset={id:'art-set',name:'Characters',images:[]};
 state.sets.push(imgset);
 image.autoSet=imgset.id;image.autoMode='cycle';
 return {state,set,image,imgset};
}
const add=(set,name)=>set.images.push({name,data:'data:image/png;base64,'+Buffer.from(name).toString('base64')});
const params=(set,image,extra={})=>({setId:set.id,targetId:image.id,sourceId:match.CARD_NAME_KEY,...extra});

test('matching understands exact filename, separators, accents, suffixes, and word order',()=>{
 assert.deepEqual(match.matchScore('brakka.png','brakka.png'),{score:100,reason:'Exact filename'});
 assert.equal(match.matchScore('Seraphine Wildblood','seraphine_wildblood.png').score,97);
 assert.equal(match.matchScore('Elián','elian.jpg').score,97);
 assert.equal(match.matchScore('Orin Grey Scholar','Orin_Grey_Scholar-final.png').score,94);
 assert.equal(match.matchScore('Far Eye Tarin','Tarin Far Eye.png').score,91);
 assert.equal(match.matchScore('Mage','Unrelated Figure.png').score,0);
 assert.equal(match.matchScore('1','11.png').score,0,'Short IDs must not fuzzy-match');
});

test('one-to-one exact name auto-suggested with correct preferred image set; no data changed',()=>{
 const {state,set,image,imgset}=setup();
 state.cards[0].name='Seraphine Wildblood';
 add(imgset,'seraphine_wildblood.png');
 const before=JSON.stringify(state.cards);
 const rows=match.suggestArtwork(params(set,image));
 assert.equal(rows.length,1);
 assert.equal(rows[0].status,'exact');
 assert.equal(rows[0].suggested.name,'seraphine_wildblood.png');
 assert.match(rows[0].suggested.reason,/normalization/);
 assert.equal(JSON.stringify(state.cards),before);
});

test('ambiguous duplicate filenames in separate sets require approval',()=>{
 const {state,set,image,imgset}=setup();
 const other={id:'other',name:'Extra',images:[]};state.sets.push(other);
 add(imgset,'Knight.png');add(other,'Knight.png');
 state.cards[0].name='Knight';
 // Frame preference is a reliable tie-breaker when available.
 const preferred=match.suggestArtwork(params(set,image));
 assert.equal(preferred[0].suggested.setId,imgset.id);
 assert.equal(preferred[0].status,'exact');
 image.autoSet='';
 const ambiguous=match.suggestArtwork(params(set,image));
 assert.equal(ambiguous[0].status,'ambiguous');
 assert.equal(ambiguous[0].alternatives.length,2);
 const restricted=match.suggestArtwork(params(set,image,{imageSetId:other.id}));
 assert.equal(restricted[0].status,'exact');
 assert.equal(restricted[0].suggested.setId,other.id);
});

test('text field matching supports card IDs and never uses an unrelated set',()=>{
 const {state,set,image,imgset}=setup();
 const title=state.template.elements.find(e=>e.name==='Card Title');
 state.cards[0].name='Unrelated';
 state.cards[0].values[title.id]='100212';
 add(imgset,'100212.PNG');
 const result=match.suggestArtwork(params(set,image,{sourceId:title.id}));
 assert.equal(result[0].source,'100212');
 assert.equal(result[0].status,'exact');
 const other=collections.newCardSet('Another');
 assert.deepEqual(match.suggestArtwork(params(other,image)),[]); // no staged cards in other set
});

test('assigned art and fixed template art are protected by default',()=>{
 const {state,set,image,imgset}=setup();
 add(imgset,'Knight.png');add(imgset,'Knight-New.png');
 const c=state.cards[0];c.name='Knight';c.values[image.id]='Characters/Knight-New.png';
 assert.equal(match.suggestArtwork(params(set,image))[0].status,'assigned');
 assert.throws(()=>match.applyArtwork(params(set,image),[{
  cardId:c.id,imageKey:match.imageKey(imgset.id,'Knight.png')
 }]),/must not be overwritten/);
});

test('apply preview decisions is atomic, uses qualified names, and remains undoable',()=>{
 const {state,set,image,imgset}=setup();
 add(imgset,'Knight.png');add(imgset,'Mage.png');
 state.cards[0].name='Knight';
 state.cards.push({id:'mage',setId:set.id,name:'Mage',values:{},overrides:{},extraElements:[]});
 const suggestions=match.suggestArtwork(params(set,image));
 assert.deepEqual(suggestions.map(s=>s.status),['exact','exact']);
 const before=JSON.stringify(state.cards);
 assert.throws(()=>match.applyArtwork(params(set,image),[
  {cardId:state.cards[0].id,imageKey:match.imageKey(imgset.id,'Knight.png')},
  {cardId:'mage',imageKey:match.imageKey(imgset.id,'missing.png')}
 ]),/no longer available/);
 assert.equal(JSON.stringify(state.cards),before);
 assert.equal(match.applyArtwork(params(set,image),suggestions.map(row=>({
  cardId:row.cardId,imageKey:row.suggested.key
 }))),2);
 history.checkpoint();
 assert.equal(getImageRef(image,0,'cards').name,'Knight.png');
 assert.equal(getImageRef(image,1,'cards').name,'Mage.png');
 assert.equal(state.cards[0].values[image.id],'Characters/Knight.png');
 assert.equal(history.undo(),true);
 assert.equal(model.S.cards[0].values[image.id],undefined);
 assert.equal(history.redo(),true);
 assert.equal(getImageRef(image,0,'cards').name,'Knight.png');
});

test('fuzzy, no-match and missing image set are review-only, not silently assigned',()=>{
 const {state,set,image,imgset}=setup();
 add(imgset,'Marik Lost.png');add(imgset,'Lio Swiftstep.png');
 state.cards[0].name='Marik the Lost';
 let row=match.suggestArtwork(params(set,image))[0];
 assert.notEqual(row.status,'exact');
 assert.equal(state.cards[0].values[image.id],undefined);
 state.cards[0].name='Wholly unrelated';
 row=match.suggestArtwork(params(set,image))[0];
 assert.equal(row.status,'missing');
 const unavailable=match.findChoice(match.imageKey(imgset.id,'absent.png'));
 assert.equal(unavailable,null);
});

test('multiple front/back fields use the same XLSX column IDs and do not share values',()=>{
 const {state,set,image,imgset}=setup();
 const back=collections.createTemplate(state.template);
 collections.assignSetTemplate(set.id,'back',back.id);
 const backArt=back.elements.find(e=>e.kind==='image');
 backArt.autoMode='cycle';backArt.autoSet=imgset.id;
 state.cards[0].name='Dragon';
 add(imgset,'Dragon.png');
 const imageCols=gridColumns(set.id).filter(col=>col.kind==='image');
 assert.equal(imageCols.length,2);
 assert.ok(imageCols.some(col=>col.id===backArt.id));
 const changed=match.applyArtwork(params(set,backArt),[{
  cardId:state.cards[0].id,imageKey:match.imageKey(imgset.id,'Dragon.png')
 }]);
 assert.equal(changed,1);
 assert.equal(state.cards[0].values[image.id],undefined);
 assert.equal(state.cards[0].values[backArt.id],'Characters/Dragon.png');
});

test('match UI is available from the grid, desktop header, mobile menu and card set sidebar',()=>{
 const root=path.join(__dirname,'..');
 const editor=fs.readFileSync(path.join(root,'src/editor.ts'),'utf8');
 const grid=fs.readFileSync(path.join(root,'src/card-data-grid-ui.ts'),'utf8');
 const desktop=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const mobile=fs.readFileSync(path.join(root,'src/mobile-interface.ts'),'utf8');
 const sidebar=fs.readFileSync(path.join(root,'src/interface.ts'),'utf8');
 const matcher=fs.readFileSync(path.join(root,'src/artwork-auto-match-ui.ts'),'utf8');
 assert.match(editor,/case 'match-artwork':openArtworkMatcher/);
 assert.match(desktop,/data-action="match-artwork"/);
 assert.match(mobile,/\['match-artwork','Match artwork'\]/);
 assert.match(sidebar,/data-action="match-artwork" data-set-id=/);
 assert.match(grid,/data-dg="match-artwork"/);
 assert.match(grid,/data-dg-thumb-row=/);
 assert.match(matcher,/data-am="apply"/);
 assert.match(matcher,/data-am="folder"/);
 assert.match(matcher,/data-am-browse=/);
});
