const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../.build/model.js');
const collections=require('../.build/project-collections.js');
const {scanDeck}=require('../.build/preflight.js');
const {preflightCSV}=require('../.build/preflight-ui.js');

test('preflight scans assigned templates, reports missing artwork and text clipping without mutating cards',async()=>{
 const state=model.initial();model.replaceState(state);
 const card=state.cards[0],front=state.template;
 const title=front.elements.find(e=>e.name==='Card Title');
 const description=front.elements.find(e=>e.name==='Description');
 const artwork=front.elements.find(e=>e.kind==='image');
 card.name='Dragon';
 card.values[title.id]='DRAGON';
 card.values[description.id]='Very long description '.repeat(55);
 const before=JSON.stringify(state);
 const report=await scanDeck(async()=>{throw Error('No image assigned should be decoded')});
 assert.equal(JSON.stringify(state),before);
 assert.equal(report.checkedCards,1);
 assert.equal(report.checkedSides,1);
 assert.equal(report.checkedImages,0);
 assert.ok(report.findings.some(x=>x.code==='missing-artwork'&&x.elementName===artwork.name&&x.cardName==='Dragon'));
 assert.ok(report.findings.some(x=>x.code==='text-overflow'&&x.elementName===description.name));
 assert.ok(report.findings.some(x=>x.code==='unbundled-font'&&x.message.includes('Georgia')));
 assert.ok(report.findings.some(x=>x.code==='no-bleed'));
 assert.equal(report.findings.filter(x=>x.code==='no-bleed').length,1);
});

test('preflight evaluates different front/back templates and reuses image resolution reads',async()=>{
 const state=model.initial();model.replaceState(state);
 const first=state.cardSets[0],front=state.template;
 const other=collections.createTemplate(front);other.name='Item design';
 const back=collections.createTemplate(front);back.name='Reverse';
 collections.assignSetTemplate(first.id,'back',back.id);
 const second=collections.newCardSet('Equipment',other.id);
 const frontImage=front.elements.find(e=>e.kind==='image');
 const otherImage=other.elements.find(e=>e.kind==='image');
 const backImage=back.elements.find(e=>e.kind==='image');
 const imageData='data:image/png;base64,dGVzdA==';
 state.sets.push({id:'art',name:'Art',images:[{name:'picture.png',data:imageData}]});
 for(const e of [frontImage,otherImage,backImage]){
  e.autoSet='art';e.autoMode='single';e.singleImage='picture.png';
 }
 state.cards[0].name='Warrior';
 state.cards.push({id:'shield',setId:second.id,name:'Shield',values:{},overrides:{},extraElements:[]});
 const calls=[];
 const scan=await scanDeck(async src=>{calls.push(src);return {naturalWidth:120,naturalHeight:100}});
 assert.equal(scan.checkedCards,2);assert.equal(scan.checkedSides,3);
 assert.equal(scan.checkedImages,1);assert.deepEqual(calls,[imageData]);
 const low=scan.findings.filter(f=>f.code==='low-resolution');
 assert.equal(low.length,3);
 assert.ok(low.some(f=>f.cardName==='Warrior'&&f.side==='back'&&f.setName===first.name));
 assert.ok(low.some(f=>f.cardName==='Shield'&&f.side==='front'&&f.setName==='Equipment'));
 assert.ok(low.every(f=>f.severity==='error'));
 assert.ok(!scan.findings.some(f=>f.code==='missing-artwork'));
});

test('blank linked text hides optional artwork; bundled fonts suppress portability warnings',async()=>{
 const state=model.initial();model.replaceState(state);
 const front=state.template,art=front.elements.find(e=>e.kind==='image'),title=front.elements.find(e=>e.name==='Card Title');
 art.linkedTextId=title.id;
 state.cards[0].values[title.id]='';
 state.fonts=[{family:'Georgia',filename:'georgia.ttf',data:'data:font/ttf;base64,QQ==',weight:700,style:'normal'},
  {family:'Georgia',filename:'georgia-regular.ttf',data:'data:font/ttf;base64,QQ==',weight:400,style:'normal'}];
 const scan=await scanDeck(async()=>{throw Error('Hidden frames must not load')});
 assert.ok(!scan.findings.some(f=>f.code==='missing-artwork'));
 assert.ok(!scan.findings.some(f=>f.code==='unbundled-font'));
 assert.ok(!scan.findings.some(f=>f.code==='font-variant'));
});

test('card-only changes to art scale and text geometry are checked independently',async()=>{
 const state=model.initial();model.replaceState(state);
 const front=state.template,art=front.elements.find(e=>e.kind==='image'),
  title=front.elements.find(e=>e.name==='Card Title');
 state.sets.push({id:'art',name:'Art',images:[{name:'pic.png',data:'data:image/png;base64,QQ=='}]});
 art.autoSet='art';art.autoMode='single';art.singleImage='pic.png';
 state.cards[0].name='Small';
 state.cards[0].overrides[art.id]={w:400,h:400};
 state.cards[0].overrides[title.id]={h:1};
 state.cards[0].values[title.id]='Fitted differently';
 state.cards.push({id:'second',name:'Large',setId:state.cardSets[0].id,values:{[title.id]:'Okay'},overrides:{},extraElements:[]});
 const report=await scanDeck(async()=>({naturalWidth:900,naturalHeight:900}));
 assert.ok(report.findings.some(f=>f.cardName==='Small'&&f.code==='text-overflow'));
 assert.ok(!report.findings.some(f=>f.cardName==='Large'&&f.elementName==='Card Title'&&f.code==='text-overflow'));
 assert.ok(report.findings.some(f=>f.cardName==='Small'&&f.code==='low-resolution'));
 assert.ok(!report.findings.some(f=>f.cardName==='Large'&&f.code==='low-resolution'));
});

test('preflight CSV retains card identifiers and neutralizes spreadsheet formulas',()=>{
 const report={checkedCards:1,checkedSides:1,checkedImages:0,findings:[{
  severity:'error',code:'missing-artwork',cardIndex:0,cardName:'=HYPERLINK("bad")',
  setName:'Set A',side:'front',elementName:'Artwork',message:'No image assigned'
 }]};
 const csv=preflightCSV(report);
 assert.match(csv,/^\uFEFF"Severity"/);
 assert.match(csv,/"'=HYPERLINK\(""bad""\)"/);
 assert.match(csv,/"missing-artwork"/);
});

test('preflight is available in the desktop and mobile export workflows',()=>{
 const dir=path.join(__dirname,'..');
 const desktop=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const mobile=fs.readFileSync(path.join(dir,'src/mobile-interface.ts'),'utf8');
 const editor=fs.readFileSync(path.join(dir,'src/editor.ts'),'utf8');
 assert.match(desktop,/data-action="check-deck"/);
 assert.match(mobile,/\['check-deck','Check deck for print'\]/);
 assert.match(editor,/case 'check-deck':openPreflight\(\)/);
});
