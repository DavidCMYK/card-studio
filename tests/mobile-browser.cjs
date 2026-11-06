/* Real Chromium smoke test for desktop and touch interfaces. Run after build:pages. */
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium,devices}=require('playwright');
const root=path.resolve(__dirname,'../public');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.readFile(file,(err,bytes)=>{
  if(err){res.writeHead(404);res.end('missing');return}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);
 });
});
(async()=>{
 const live=process.env.CARD_STUDIO_URL;
 if(!live)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=live||'http://127.0.0.1:'+server.address().port+'/';
 const shutdown=()=>{if(server.listening)server.close()};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
  const errors=[];
  const desktop=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  const dp=await desktop.newPage();dp.on('pageerror',e=>errors.push('desktop: '+e.message));
  await dp.addInitScript(()=>{
   Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:async()=>({
    name:'portable-test.cardstudio.json',
    createWritable:async()=>({
     write:async(value)=>{window.__savedPortableProject=String(value)},
     close:async()=>{}
    })
   })});
  });
  await dp.goto(url);
  await dp.locator('#stage .element').first().waitFor();
  // Separate project: guide modes, physical size preservation and creation dialog.
  const guideContext=await browser.newContext({viewport:{width:1360,height:900},acceptDownloads:true});
  const gp=await guideContext.newPage();gp.on('pageerror',e=>errors.push('guides: '+e.message));
  await gp.goto(url);
  await gp.locator('#stage .element').first().waitFor();
  await gp.locator('#inspector [data-inspector-fold="setup-guides"] summary').click();
  const guideElementGeometry=await gp.locator('#stage .element').evaluateAll(els=>
   els.map(el=>({id:el.dataset.id,left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height})));
  await gp.locator('#inspector [data-prop="guide.bleedMode"]').selectOption('bleed');
  assert.deepEqual(await gp.locator('#stage .element').evaluateAll(els=>
   els.map(el=>({id:el.dataset.id,left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height}))),
   guideElementGeometry,'changing bleed mode never alters saved element positions or sizes');
  assert.equal(Number(await gp.locator('[data-prop="template.width"]').inputValue()),69,'mode switch adds configured bleed to canvas');
  assert.equal(Number(await gp.locator('[data-prop="guide.cut.width"]').inputValue()),63,'mode switch preserves cut width');
  assert.equal(await gp.locator('#stage .guide-trim').count(),1,'trim guide visible inside canvas');
  assert.equal(await gp.locator('#stage .guide-safe').count(),1,'safe line displayed');
  assert.equal(await gp.locator('#inspector [data-prop="guide.radius.canvas"]').count(),0,'canvas edge is not an independently rounded guide');
  await gp.locator('#inspector [data-prop="guide.radius.cut"]').fill('3');
  await gp.locator('#inspector [data-prop="guide.radius.cut"]').press('Tab');
  await gp.locator('#inspector [data-prop="guide.radius.safe"]').fill('2');
  await gp.locator('#inspector [data-prop="guide.radius.safe"]').press('Tab');
  assert.match(await gp.locator('#stage .guide-trim').getAttribute('style'),/border-radius:/,'cut guide is rounded');
  assert.match(await gp.locator('#stage .guide-safe').getAttribute('style'),/border-radius:/,'safe guide is rounded');
  assert.equal(await gp.locator('#stage .guide-canvas').count(),0,'no canvas-edge guide is drawn');

  await gp.locator('#inspector [data-prop="guide.unit"]').selectOption('px');
  assert.equal(Number(await gp.locator('[data-prop="guide.radius.cut"]').inputValue()),35,'cut radius is rounded to a whole pixel');
  assert.equal(Number(await gp.locator('[data-prop="guide.radius.safe"]').inputValue()),24,'safe radius is rounded to a whole pixel');
  assert.equal(Number(await gp.locator('[data-prop="guide.bleed.top"]').inputValue()),35,'bleed mm-to-pixel conversion rounds to an integer');
  await gp.locator('[data-prop="guide.bleed.top"]').fill('59.055118');
  await gp.locator('[data-prop="guide.bleed.top"]').press('Tab');
  assert.equal(Number(await gp.locator('[data-prop="guide.bleed.top"]').inputValue()),59,'fractional pixel entry is normalized after editing');
  assert.equal(await gp.locator('[data-prop="guide.bleed.top"]').getAttribute('step'),'1','guide pixel inputs use integer steps');
  assert.ok(Math.abs(Number(await gp.locator('[data-prop="template.width"]').inputValue())-(63+2*59*25.4/300))<.001,'fractional pixel bleed input rounds before expanding canvas');
  assert.equal(Number(await gp.locator('[data-prop="guide.cut.width"]').inputValue()),63,'bleed keeps cut locked');
  await gp.locator('[data-prop="guide.cut.width"]').fill('66');
  await gp.locator('[data-prop="guide.cut.width"]').press('Tab');
  assert.ok(Math.abs(Number(await gp.locator('[data-prop="template.width"]').inputValue())-(66+2*59*25.4/300))<.001,'cut input expands canvas while retaining rounded bleed');
  assert.equal(Number(await gp.locator('[data-prop="guide.cut.width"]').inputValue()),66,'cut edits the finished size');
  await gp.locator('[data-prop="template.width"]').fill('80');
  await gp.locator('[data-prop="template.width"]').press('Tab');
  assert.equal(Number(await gp.locator('[data-prop="guide.cut.width"]').inputValue()),66,'canvas input holds cut fixed');
  assert.equal(Number(await gp.locator('[data-prop="guide.bleed.left"]').inputValue()),83,'canvas recomputes and displays bleed in whole pixels');
  await gp.locator('[data-prop="guide.safeZone.width"]').fill('61');
  await gp.locator('[data-prop="guide.safeZone.width"]').press('Tab');
  assert.equal(Number(await gp.locator('[data-prop="guide.cut.width"]').inputValue()),66,'safe-zone edit holds cut fixed');
  assert.equal(Number(await gp.locator('[data-prop="guide.safeZone.width"]').inputValue()),61,'safe-zone dimension editable');
  assert.equal(Number(await gp.locator('[data-prop="template.width"]').inputValue()),80,'safe zone cannot resize canvas');
  await gp.locator('[data-prop="guide.safeZone.width"]').fill('67');
  await gp.locator('[data-prop="guide.safeZone.width"]').press('Tab');
  assert.equal(Number(await gp.locator('[data-prop="guide.safeZone.width"]').inputValue()),61,'safe zone above cut is rejected');
  assert.deepEqual(await gp.locator('#stage .element').evaluateAll(els=>
   els.map(el=>({id:el.dataset.id,left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height}))),
   guideElementGeometry,'editing canvas, cut, bleed and safe zone never changes artwork geometry');
  await gp.locator('#inspector [data-prop="guide.bleedMode"]').selectOption('trim');
  assert.equal(Number(await gp.locator('[data-prop="template.width"]').inputValue()),66,'removing bleed shrinks canvas to cut');
  assert.equal(Number(await gp.locator('[data-prop="guide.cut.width"]').inputValue()),66,'cut retained when disabling bleed');
  assert.equal(await gp.locator('#stage .guide-trim').count(),1,'rounded cut guide remains visible when cut coincides with canvas edge');
  await gp.locator('#inspector [data-prop="template.unit"]').selectOption('px');
  assert.equal(await gp.locator('#inspector [data-prop="template.width"]').getAttribute('step'),'1','canvas pixel size uses integer steps');
  assert.equal(await gp.locator('#inspector [data-prop="guide.cut.width"]').getAttribute('step'),'1','cut pixel size uses integer steps');
  assert.equal(Number(await gp.locator('[data-prop="template.width"]').inputValue()),Math.round(66*300/25.4),'displayed canvas pixel dimension is an integer');
  await gp.locator('#inspector [data-prop="template.width"]').fill('781.7');
  await gp.locator('#inspector [data-prop="template.width"]').press('Tab');
  assert.equal(Number(await gp.locator('[data-prop="template.width"]').inputValue()),782,'fractional canvas pixels round before applying');
  assert.equal(Number(await gp.locator('[data-prop="guide.cut.width"]').inputValue()),Math.round(66*300/25.4),'canvas pixel edit keeps cut size locked');

  await gp.evaluate(()=>document.activeElement?.blur());
  await gp.keyboard.press('g');
  assert.equal(await gp.locator('#stage .guide-safe').count(),0,'G toggles guides');
  await gp.locator('#fileMenu summary').click();
  await gp.locator('#fileMenu [data-action="new-project"]').click();
  await gp.locator('#newProjectDialog').waitFor({state:'visible'});
  await gp.locator('#newProjectDialog [name="mode"]').selectOption('bleed');
  assert.equal(await gp.locator('#newProjectDialog [name="width"]').inputValue(),'69','new project wizard adds bleed without changing cut');
  await gp.locator('#newProjectDialog [name="cutWidth"]').fill('65');
  await gp.locator('#newProjectDialog [name="cutWidth"]').press('Tab');
  assert.equal(await gp.locator('#newProjectDialog [name="width"]').inputValue(),'71','new project cut edit changes canvas');
  await gp.locator('#newProjectDialog [name="width"]').fill('77');
  await gp.locator('#newProjectDialog [name="width"]').press('Tab');
  assert.equal(await gp.locator('#newProjectDialog [name="cutWidth"]').inputValue(),'65','new project canvas edit holds cut fixed');
  await gp.locator('#newProjectDialog [name="safeWidth"]').fill('60');
  await gp.locator('#newProjectDialog [name="safeWidth"]').press('Tab');
  assert.equal(await gp.locator('#newProjectDialog [name="cutWidth"]').inputValue(),'65','new project safe-zone edit holds cut fixed');
  await gp.locator('#newProjectDialog [name="safeWidth"]').fill('70');
  await gp.locator('#newProjectDialog [name="safeWidth"]').press('Tab');
  assert.match(await gp.locator('#newProjectError').textContent(),/cannot exceed/,'new project rejects unsafe dimensions');
  await gp.locator('#newProjectDialog [name="unit"]').selectOption('px');
  assert.equal(await gp.locator('#newProjectDialog [name="cutWidth"]').getAttribute('step'),'1','new project pixel dimensions use integer steps');
  assert.match(await gp.locator('#newProjectDialog [name="cutWidth"]').inputValue(),/^\d+$/,'new project displays integer pixel cut size');
  await gp.locator('#newProjectDialog [name="cutWidth"]').fill('807.6');
  await gp.locator('#newProjectDialog [name="cutWidth"]').press('Tab');
  assert.equal(await gp.locator('#newProjectDialog [name="cutWidth"]').inputValue(),'808','new project rounds fractional pixel input');

  await gp.locator('#newProjectDialog [data-new-project="cancel"]').click();
  await gp.locator('#newProjectDialog').waitFor({state:'detached'});
  await gp.locator('#fileMenu summary').click();
  await gp.locator('#fileMenu [data-action="new-project"]').click();
  await gp.locator('#newProjectDialog [name="mode"]').selectOption('bleed');
  assert.equal(await gp.locator('#newProjectDialog [name="radiusCanvas"]').count(),0,'wizard has no canvas-edge radius');
  await gp.locator('#newProjectDialog [name="radiusCut"]').fill('3');
  await gp.locator('#newProjectDialog [name="radiusCut"]').press('Tab');
  await gp.locator('#newProjectDialog [name="radiusSafe"]').fill('2');
  await gp.locator('#newProjectDialog [name="radiusSafe"]').press('Tab');
  assert.equal(await gp.locator('#newProjectDialog [name="width"]').inputValue(),'69','corner rounding does not alter canvas');
  assert.equal(await gp.locator('#newProjectDialog [name="width"]').inputValue(),'69','new-project defaults retain standard cut and bleed');
  await gp.locator('#newProjectDialog button[type="submit"]').click();
  await gp.locator('#newProjectDialog').waitFor({state:'detached'});
  assert.equal(Number(await gp.locator('[data-prop="template.width"]').inputValue()),69,"new project's canvas size is explicit");
  assert.equal(await gp.locator('#stage .guide-trim').count(),1,'new project starts with trim guide');
  const cutRadiusPixels=await gp.locator('#stage .guide-trim').evaluate(el=>parseFloat(el.style.borderRadius));
  const safeRadiusPixels=await gp.locator('#stage .guide-safe').evaluate(el=>parseFloat(el.style.borderRadius));
  assert.ok(cutRadiusPixels>0&&safeRadiusPixels>0,'new project saves both radius settings');
  assert.ok(Math.abs(cutRadiusPixels/safeRadiusPixels-1.5)<.001,'cut and safe radii stay independent at any editor zoom');
  await gp.locator('.top [data-action="print-sheets"]').click();
  assert.match(await gp.locator('#prSummary').textContent(),/Cards: 63 × 88 mm/,'print sheet uses finished trim dimensions, not canvas');
  assert.equal(await gp.locator('#printModal [name="bleed"]').isDisabled(),true,'no second edge-extension bleed on full-bleed canvas');
  await gp.locator('#printModal [data-print="close"]').click();
  const trimmedDownloadWait=gp.waitForEvent('download',{timeout:45000});
  await gp.locator('#fileMenu summary').click();
  await gp.locator('#fileMenu [data-action="export-trimmed"]').click();
  const trimmedDownload=await trimmedDownloadWait;
  const trimmedBytes=fs.readFileSync(await trimmedDownload.path());
  assert.equal(trimmedBytes.subarray(1,4).toString(),'PNG','trimmed output is a PNG');
  assert.equal(trimmedBytes.readUInt32BE(16),Math.round(63*300/25.4),'trimmed image has finished-card width in export pixels');
  await guideContext.close();
  // Multiple shared templates, set assignments, portable template files and backs.
  const multiContext=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  const multi=await multiContext.newPage();
  multi.on('pageerror',e=>errors.push('multi-template: '+e.message));
  await multi.addInitScript(()=>{
   Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:undefined});
   Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:async()=>({
    name:'saved.template.json',createWritable:async()=>({
     write:async(data)=>{window.__latestSaved=String(data)},close:async()=>{}
    })
   })});
  });
  await multi.goto(url);
  await multi.locator('.sidebar-templates [data-action="duplicate-template"]').first().click();
  assert.equal(await multi.locator('.sidebar-templates .asset-title [data-template-id]').count(),2,
   'duplicate creates a second shared template');
  const templateIds=await multi.locator('.sidebar-templates .asset-title [data-template-id]').evaluateAll(els=>els.map(e=>e.dataset.templateId));
  assert.equal(templateIds.length,2,'two project templates are available');
  multi.once('dialog',d=>d.accept('Second set'));
  await multi.locator('.sidebar-cardsets [data-action="new-card-set"]').click();
  assert.equal(await multi.locator('.sidebar-cardsets [data-set-side="front"]').count(),2,'new card set is listed');
  await multi.locator('.sidebar-cardsets [data-set-side="front"]').nth(1).selectOption(templateIds[1]);
  await multi.locator('.sidebar-cardsets [data-set-side="back"]').nth(0).selectOption(templateIds[1]);
  await multi.locator('.sidebar-cardsets [data-set-side="back"]').nth(1).selectOption(templateIds[0]);
  assert.equal(await multi.locator('.sidebar-cards .card-row[data-cardindex]').count(),2,'each set contains a card');
  await multi.locator('.sidebar-cards .card-row[data-cardindex="0"]').click();
  await multi.locator('#cardSideSelector').selectOption('back');
  assert.equal(await multi.locator('#stage .element').count(),6,'assigned back template renders in editor');
  await multi.locator('.sidebar-templates .asset-title [data-template-id]').first().click();
  assert.equal(await multi.locator('#btnTemplate').getAttribute('aria-pressed'),'true','shared template is editable');
  await multi.locator('#fileMenu summary').click();
  await multi.locator('#fileMenu [data-action="save-project"]').click();
  const projectJson=JSON.parse(await multi.evaluate(()=>window.__latestSaved));
  assert.equal(projectJson.templates.length,2,'project contains all shared templates');
  assert.equal(projectJson.cardSets.length,2,'project contains both card sets');
  assert.equal(projectJson.cards.length,2,'project contains both cards');
  assert.equal(projectJson.cardSets[0].backTemplateId,templateIds[1]);
  assert.equal(projectJson.cardSets[1].frontTemplateId,templateIds[1]);
  assert.equal(projectJson.cardSets[1].backTemplateId,templateIds[0]);
  await multi.locator('#fileMenu summary').click();
  await multi.locator('#fileMenu [data-action="save-template-as"]').click();
  const savedTemplateJson=JSON.parse(await multi.evaluate(()=>window.__latestSaved));
  assert.equal(savedTemplateJson.type,'cardstudio-template','save template exports only one reusable template');
  await multi.locator('#openTemplateFile').setInputFiles({
   name:'imported.template.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(savedTemplateJson))
  });
  assert.equal(await multi.locator('.sidebar-templates .asset-title [data-template-id]').count(),3,'loading a template adds instead of replacing');
  assert.equal(await multi.locator('.sidebar-cards .card-row[data-cardindex]').count(),2,'loading a template keeps card data');
  const allTemplatesWait=multi.waitForEvent('download',{timeout:45000});
  await multi.locator('#fileMenu summary').click();
  await multi.locator('#fileMenu [data-action="save-all-templates"]').click();
  const allTemplatesDownload=await allTemplatesWait;
  assert.match(allTemplatesDownload.suggestedFilename(),/_templates\.zip$/);
  const allZip=await require('../vendor/jszip.min.js').loadAsync(fs.readFileSync(await allTemplatesDownload.path()));
  assert.equal(Object.keys(allZip.files).filter(n=>n.endsWith('.template.json')).length,3,'save all exports each template separately');
  await multiContext.close();
  // Print-sheet workflow: quantities, preview, shared backs, duplex PDF.
  await dp.locator('.top [data-action="print-sheets"]').click();
  assert.equal(await dp.locator('#printModal').isVisible(),true,'print dialog opens');
  await dp.locator('#printModal [data-pr-quantity="0"]').fill('2');
  await dp.locator('#printModal [data-pr-quantity="0"]').press('Tab');
  assert.match(await dp.locator('#prSummary').textContent(),/2 copies/,'copies update sheet count');
  await dp.locator('#printModal [data-print="preview"]').click();
  await dp.locator('#prPreview').waitFor({state:'visible',timeout:30000});
  const backPng=await dp.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#5c2ab5';ctx.fillRect(0,0,16,16);
   return canvas.toDataURL('image/png').split(',')[1];
  });
  await dp.locator('#printModal [data-print-file="shared"]').setInputFiles({
   name:'card-back.png',mimeType:'image/png',buffer:Buffer.from(backPng,'base64')
  });
  await dp.waitForFunction(()=>document.querySelector('#prSharedStatus')?.textContent==='Shared back loaded');
  await dp.locator('#printModal select[name="duplex"]').selectOption('long');
  assert.match(await dp.locator('#prSummary').textContent(),/2 PDF page/,'duplex doubles page count');
  await dp.locator('#printModal [data-print="preview-back"]').click();
  await dp.locator('#prPreviewInfo').waitFor({state:'visible'});
  const printDownloadWait=dp.waitForEvent('download',{timeout:60000});
  await dp.locator('#printModal [data-print="pdf"]').click();
  const printDownload=await printDownloadWait;
  assert.match(printDownload.suggestedFilename(),/_print_sheets\.pdf$/,'PDF filename');
  const printedPdf=fs.readFileSync(await printDownload.path()).toString('latin1');
  assert.ok(printedPdf.startsWith('%PDF-1.4'),'downloaded file is PDF');
  assert.match(printedPdf,/\/Count 2\b/,'front and back pages exported');
  await dp.locator('#printModal [data-print="close"]').click();
  assert.equal(await dp.locator('#printModal').count(),0,'print dialog closes');
  assert.equal(await dp.locator('.top').isVisible(),true,'desktop toolbar visible');
  assert.equal(await dp.locator('#mobileShell').isVisible(),false,'mobile toolbar hidden on desktop');
  assert.equal(await dp.locator('#inspector .inspector-fold').count(),5,'card setup includes a dedicated guides section');
  assert.equal(await dp.locator('#inspector [data-inspector-fold="setup-dimensions"]').getAttribute('open'),'','dimensions initially expanded');
  await dp.locator('#inspector [data-inspector-fold="setup-rendering"] summary').click();
  assert.equal(await dp.locator('#inspector [data-inspector-fold="setup-rendering"]').getAttribute('open'),'','rendering can expand');

  // Desktop: double-click enters image-content mode; drag and wheel change only image placement.
  await dp.locator('#stage .element').nth(2).dblclick({position:{x:42,y:42}});
  assert.equal(await dp.locator('#imageRepositionBar').isVisible(),true,'double-click enters image reposition mode');
  assert.equal(await dp.locator('#stage .element.repositioning').count(),1,'reposition frame marked');
  assert.equal(await dp.locator('#stage .element.repositioning .resize-handle').count(),0,'no frame handles in crop mode');
  await dp.locator('#inspector [data-inspector-tab="content"]').click();
  assert.equal(await dp.locator('#inspector [data-inspector-tab="content"]').getAttribute('aria-selected'),'true');
  await dp.locator('#inspector [data-prop="imageFit"]').selectOption('free');
  await dp.locator('#inspector [data-prop="imgScale"]').waitFor();
  assert.equal(await dp.locator('#inspector [data-prop="imgZoom"]').count(),0,'old zoom removed');
  const beforeFrameLeft=await dp.locator('#stage .element.repositioning').evaluate(el=>el.style.left);
  const beforeImageOffset=Number(await dp.locator('#inspector [data-prop="imgOffsetX"]').inputValue());
  let cropRect=await dp.locator('#stage .element.repositioning').boundingBox();
  let cropX=cropRect.x+cropRect.width*.43,cropY=cropRect.y+cropRect.height*.42;
  await dp.mouse.move(cropX,cropY);await dp.mouse.down();
  await dp.mouse.move(cropX+27,cropY+12,{steps:4});await dp.mouse.up();
  assert.notEqual(Number(await dp.locator('#inspector [data-prop="imgOffsetX"]').inputValue()),beforeImageOffset,
   'drag changes image offset');
  assert.equal(await dp.locator('#stage .element.repositioning').evaluate(el=>el.style.left),beforeFrameLeft,
   'drag must not move frame');
  await dp.mouse.move(cropX,cropY);await dp.mouse.wheel(0,-180);
  await dp.waitForFunction(()=>Number(document.querySelector('#inspector [data-prop="imgScale"]')?.value)>1);
  // Fit width must ignore horizontal dragging; fit height must ignore vertical dragging.
  await dp.locator('#inspector [data-prop="imageFit"]').selectOption('width');
  assert.equal(await dp.locator('#inspector [data-prop="imgScale"]').count(),0,'fit width cannot scale');
  assert.equal(await dp.locator('#inspector [data-prop="imgOffsetX"]').count(),0,'fit width locks X');
  const widthY=Number(await dp.locator('#inspector [data-prop="imgOffsetY"]').inputValue());
  await dp.mouse.move(cropX,cropY);await dp.mouse.down();await dp.mouse.move(cropX+40,cropY,{steps:3});await dp.mouse.up();
  assert.equal(Number(await dp.locator('#inspector [data-prop="imgOffsetY"]').inputValue()),widthY,'horizontal drag has no effect in width fit');
  await dp.locator('#inspector [data-prop="imageFit"]').selectOption('height');
  assert.equal(await dp.locator('#inspector [data-prop="imgOffsetY"]').count(),0,'fit height locks Y');
  const heightX=Number(await dp.locator('#inspector [data-prop="imgOffsetX"]').inputValue());
  await dp.mouse.move(cropX,cropY);await dp.mouse.down();await dp.mouse.move(cropX,cropY+30,{steps:3});await dp.mouse.up();
  assert.equal(Number(await dp.locator('#inspector [data-prop="imgOffsetX"]').inputValue()),heightX,'vertical drag has no effect in height fit');
  await dp.locator('#imageRepositionBar button').click();
  assert.equal(await dp.locator('#imageRepositionBar').isVisible(),false,'Done ends crop mode');
  cropRect=await dp.locator('#stage .element.selected').boundingBox();
  cropX=cropRect.x+cropRect.width*.44;cropY=cropRect.y+cropRect.height*.45;
  await dp.mouse.move(cropX,cropY);await dp.mouse.down();
  await dp.mouse.move(cropX+20,cropY,{steps:3});await dp.mouse.up();
  assert.notEqual(await dp.locator('#stage .element.selected').evaluate(el=>el.style.left),beforeFrameLeft,
   'normal drag resumes frame movement after Done');
  const desktopElements=await dp.locator('#stage .element').count();
  await dp.locator('.work-tools [data-action="add-shape"]').click();
  assert.equal(await dp.locator('#stage .element').count(),desktopElements+1,'desktop add shape');
  await dp.locator('.work-tools [data-action="undo"]').click();
  assert.equal(await dp.locator('#stage .element').count(),desktopElements,'desktop undo');
  await dp.locator('.work-tools [data-action="redo"]').click();
  assert.equal(await dp.locator('#stage .element').count(),desktopElements+1,'desktop redo');
  // Confirm installed-font access is requested in the click's transient
  // activation, before any confirmation dialog can consume it.
  await dp.evaluate(()=>{
   window.__fontActivationCheck={active:false,order:[]};
   window.queryLocalFonts=()=>{
    window.__fontActivationCheck.active=navigator.userActivation.isActive;
    window.__fontActivationCheck.order.push('query');
    return Promise.resolve([]);
   };
   window.confirm=()=>{window.__fontActivationCheck.order.push('confirm');return false};
  });
  await dp.locator('#fileMenu summary').click();
  await dp.locator('#fileMenu [data-action="embed-used-fonts"]').click();
  await dp.waitForFunction(()=>window.__fontActivationCheck.order.length===2);
  const activation=await dp.evaluate(()=>window.__fontActivationCheck);
  assert.equal(activation.active,true,'font access requested during a user click');
  assert.deepEqual(activation.order,['query','confirm'],'permission request precedes licensing confirmation');
  // Font discovery must visibly expose discovered families, not just change a hidden datalist.
  await dp.locator('[data-layer]').filter({hasText:'Card Title'}).click();
  await dp.locator('#inspector [data-inspector-tab="content"]').click();
  await dp.evaluate(()=>{window.queryLocalFonts=()=>Promise.resolve([
   {family:'New Fantasy Font',fullName:'New Fantasy Font Regular'},
   {family:'Arial',fullName:'Arial Regular'},
   {family:'New Fantasy Font',fullName:'New Fantasy Font Bold'}
  ])});
  await dp.locator('#inspector [data-action="scan-fonts"]').click();
  await dp.locator('#inspector .font-browser').waitFor({state:'visible'});
  assert.equal(await dp.locator('#inspector .font-browser-list button').filter({hasText:'New Fantasy Font'}).count(),1,'font scan deduplicates family and shows selection');
  await dp.locator('#inspector [data-font-filter="search"]').fill('fantasy');
  assert.equal(await dp.locator('#inspector .font-browser-list button:visible').count(),1,'font search filters results');
  await dp.locator('#inspector [data-action="choose-font"]').filter({hasText:'New Fantasy Font'}).click();
  assert.equal(await dp.locator('#inspector [data-prop="font"]').inputValue(),'New Fantasy Font','selecting discovered font updates text');
  await dp.locator('#inspector [data-action="browse-fonts"]').click();
  assert.equal(await dp.locator('#inspector [data-action="choose-font"]').filter({hasText:'New Fantasy Font'}).count(),1,'discovered list persists after selection');
  await dp.locator('#inspector [data-action="browse-fonts"]').click();
    // Embed a real test-runner font, save a JSON project, and reopen it on mobile.
  let portableProject=null,desktopPng=null;
  let fontPath='';
  try{fontPath=execFileSync('fc-match',['-f','%{file}\\n','DejaVu Sans'],{encoding:'utf8'}).trim().split('\\n')[0]}catch{}
  if(fontPath&&fs.existsSync(fontPath)&&fs.statSync(fontPath).size<12*1024*1024){
   dp.once('dialog',dialog=>dialog.accept('Portable Integration'));
   await dp.locator('#fontFiles').setInputFiles({name:'Portable-Integration.ttf',mimeType:'font/ttf',buffer:fs.readFileSync(fontPath)});
   await dp.waitForFunction(()=>[...document.fonts].some(f=>f.family==='Portable Integration'&&f.status==='loaded'),null,{timeout:12000});
   await dp.locator('[data-layer]').filter({hasText:'Card Title'}).click();
   await dp.locator('#inspector [data-inspector-tab="content"]').click();
   await dp.locator('#inspector input[data-prop="font"]').fill('Portable Integration');
   await dp.locator('#inspector input[data-prop="font"]').press('Tab');
   await dp.waitForTimeout(30);
   assert.equal(await dp.evaluate(()=>document.activeElement?.dataset.action),'scan-fonts',
    'Tab from changed font input proceeds to next control');
   await dp.keyboard.press('Shift+Tab');
   assert.equal(await dp.evaluate(()=>document.activeElement?.dataset.prop),'font',
    'Shift+Tab returns to the previous input');
   // A second default text element uses Georgia. Embed its actual font too:
   // all used font faces must be portable for exact cross-device PNG output.
   await dp.locator('[data-layer]').filter({hasText:'Description'}).click();
   await dp.locator('#inspector input[data-prop="font"]').fill('Portable Integration');
   await dp.locator('#inspector input[data-prop="font"]').press('Tab');
   await dp.locator('#fileMenu summary').click();
   await dp.locator('#fileMenu [data-action="save-project"]').click();
   await dp.waitForFunction(()=>Boolean(window.__savedPortableProject));
   portableProject=await dp.evaluate(()=>window.__savedPortableProject);
   const parsed=JSON.parse(portableProject);
   assert.equal(parsed.fonts[0].family,'Portable Integration','font family bundled');
   assert.ok(parsed.fonts[0].data.startsWith('data:'),'font file bytes saved in project');
   const desktopDownloadPromise=dp.waitForEvent('download');
   await dp.locator('.top [data-action="export-current"]').click();
   const desktopExport=await desktopDownloadPromise;
   desktopPng=fs.readFileSync(await desktopExport.path());
   assert.equal(desktopPng.subarray(1,4).toString('ascii'),'PNG','real PNG export');
   assert.ok(desktopPng.readUInt32BE(16)>500&&desktopPng.readUInt32BE(20)>700,'print-resolution dimensions');
  }else console.warn('Skipping optional real font check: fontconfig unavailable');
  await dp.screenshot({path:'test-results/desktop.png'});
  // Large-file regression: same image frame, but a multi-megabyte JPEG.
  // An earlier renderer embedded that entire Base64 string into stage HTML
  // on every pointerdown and could miss the second click under load.
  const heavyContext=await browser.newContext({viewport:{width:1440,height:900}});
  const heavy=await heavyContext.newPage();
  heavy.on('pageerror',e=>errors.push('large artwork: '+e.message));
  await heavy.goto(url);
  const largeData=await heavy.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=2300;canvas.height=3200;
   const ctx=canvas.getContext('2d'),raster=ctx.createImageData(canvas.width,canvas.height);
   const pixels=raster.data;
   for(let i=0;i<pixels.length;i+=4){
    const v=(i*16807+((i>>>6)*813))|0;
    pixels[i]=(v>>>1)&255;pixels[i+1]=(v>>>8)&255;
    pixels[i+2]=(v>>>16)&255;pixels[i+3]=255;
   }
   ctx.putImageData(raster,0,0);
   return canvas.toDataURL('image/jpeg',.94);
  });
  assert.ok(largeData.length>2_000_000,'fixture must be a genuinely large image file');
  const hugeProject=require('../.build/model.js').initial();
  const hugeFrame=hugeProject.template.elements.find(e=>e.kind==='image');
  hugeFrame.autoSet='large-files';hugeFrame.autoMode='single';hugeFrame.singleImage='huge.jpg';
  hugeProject.sets=[{id:'large-files',name:'Large artwork',images:[{name:'huge.jpg',data:largeData}]}];
  await heavy.locator('#openProjectFile').setInputFiles({
   name:'large-image.cardstudio.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(hugeProject))
  });
  await heavy.waitForFunction(()=>
   document.querySelector('#stage .image-content img')?.getAttribute('src')?.startsWith('blob:'),
   null,{timeout:30000});
  const urlLength=await heavy.locator('#stage .image-content img').first()
   .evaluate(el=>el.getAttribute('src').length);
  assert.ok(urlLength<150,'large previews must not embed Base64 in the canvas HTML');
  const session=await heavyContext.newCDPSession(heavy);
  await session.send('Emulation.setCPUThrottlingRate',{rate:8});
  const box=await heavy.locator('#stage .element').nth(2).boundingBox();
  const x=box.x+box.width*.45,y=box.y+box.height*.45;
  await heavy.mouse.click(x,y);
  await new Promise(resolve=>setTimeout(resolve,130));
  await heavy.mouse.click(x,y);
  await heavy.waitForFunction(()=>Boolean(document.querySelector('#stage .element.repositioning')),
    null,{timeout:5000});
  assert.equal(await heavy.locator('#stage .element.repositioning').count(),1,
   'large file double-click enters reposition mode with a normal-sized frame');
  await session.send('Emulation.setCPUThrottlingRate',{rate:1});
  await heavyContext.close();
  await desktop.close();

  // Independent text editing: linked shapes remain fixed through drag/resize,
  // then resume following their text when normal editing returns.
  const independentContext=await browser.newContext({viewport:{width:1440,height:900}});
  const independent=await independentContext.newPage();
  independent.on('pageerror',error=>errors.push('independent-text: '+error.message));
  await independent.goto(url);
  await independent.locator('#stage .element').first().waitFor();
  const textId=await independent.locator('[data-layer]').filter({hasText:'Card Title'}).getAttribute('data-layer');
  await independent.locator('.work-tools [data-action="add-shape"]').click();
  const followerId=await independent.locator('#stage .element.selected').getAttribute('data-id');
  await independent.locator('#inspector [data-inspector-tab="rules"]').click();
  await independent.locator('#inspector [data-prop="linkedTextId"]').selectOption(textId);
  await independent.locator('#inspector [data-inspector-tab="layout"]').click();
  await independent.locator('#inspector [data-inspector-fold="anchor-edges"] summary').click();
  for(const edge of ['Left','Right','Top','Bottom']){
   await independent.locator('#inspector [data-prop="anchor'+edge+'"]').check();
  }
  const follower=independent.locator('#stage .element[data-id="'+followerId+'"]');
  const titleEl=independent.locator('#stage .element[data-id="'+textId+'"]');
  const oldFollower=await follower.getAttribute('style');
  await titleEl.dblclick({position:{x:16,y:16}});
  assert.equal(await independent.locator('#stage .text-isolated[data-id="'+textId+'"]').count(),1,
   'double-click enters independent text editing');
  assert.equal(await independent.locator('#imageRepositionBar').isVisible(),true,'independent text toolbar appears');
  const oldTitle=await titleEl.getAttribute('style');
  const titleRect=await titleEl.boundingBox();
  await independent.mouse.move(titleRect.x+30,titleRect.y+17);
  await independent.mouse.down();
  await independent.mouse.move(titleRect.x+52,titleRect.y+30,{steps:3});
  await independent.mouse.up();
  assert.notEqual(await titleEl.getAttribute('style'),oldTitle,'independent text drag moves text');
  assert.equal(await follower.getAttribute('style'),oldFollower,'linked shape does not move with independent text');
  const sizeBefore=await titleEl.evaluate(el=>el.style.width);
  // The title sits near the card's right edge; the west handle stays inside the card after moving.
  const resize=await titleEl.locator('[data-handle="w"]').boundingBox();
  await independent.mouse.move(resize.x+resize.width/2,resize.y+resize.height/2);
  await independent.mouse.down();
  await independent.mouse.move(resize.x+resize.width/2-32,resize.y+resize.height/2,{steps:4});
  await independent.mouse.up();
  assert.notEqual(await titleEl.evaluate(el=>el.style.width),sizeBefore,'independent text resize changes text width');
  assert.equal(await follower.getAttribute('style'),oldFollower,'linked shape does not stretch with text');
  await independent.locator('#imageRepositionBar button').click();
  assert.equal(await independent.locator('#stage .text-isolated').count(),0,'Done exits independent text mode');
  const normalRect=await titleEl.boundingBox();
  await independent.mouse.move(normalRect.x+20,normalRect.y+16);
  await independent.mouse.down();
  await independent.mouse.move(normalRect.x+39,normalRect.y+27,{steps:3});
  await independent.mouse.up();
  assert.notEqual(await follower.getAttribute('style'),oldFollower,'linked shape follows ordinary text drag');
  await independentContext.close();

  const phone=await browser.newContext({...devices['Pixel 7'],acceptDownloads:true});
  const page=await phone.newPage();page.on('pageerror',e=>errors.push('mobile: '+e.message));
  await page.goto(url);
  await page.locator('#mobileShell').waitFor({state:'visible'});
  if(portableProject){
   await page.locator('#openProjectFile').setInputFiles({name:'portable-test.cardstudio.json',mimeType:'application/json',buffer:Buffer.from(portableProject)});
   await page.waitForFunction(()=>[...document.fonts].some(f=>f.family==='Portable Integration'&&f.status==='loaded'),null,{timeout:12000});
   const mobileDownloadPromise=page.waitForEvent('download');
   await page.locator('.m-appbar [data-mobile="export"]').click();
   await page.locator('.m-actions [data-action="export-current"]').click();
   const mobileExport=await mobileDownloadPromise;
   const mobilePng=fs.readFileSync(await mobileExport.path());
   if(!desktopPng.equals(mobilePng)){
    fs.writeFileSync('test-results/desktop-export.png',desktopPng);
    fs.writeFileSync('test-results/mobile-export.png',mobilePng);
    const result=await page.evaluate(async(pairs)=>{
     async function rgba(b64){
      const bytes=Uint8Array.from(atob(b64),ch=>ch.charCodeAt(0));
      const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
      const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(bitmap,0,0);
      return {pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data,w:canvas.width,h:canvas.height};
     }
     const a=await rgba(pairs[0]),b=await rgba(pairs[1]);
     if(a.w!==b.w||a.h!==b.h)return {sizeMismatch:true,a:[a.w,a.h],b:[b.w,b.h]};
     let different=0,first=null;
     for(let i=0;i<a.pixels.length;i+=4){
      if(a.pixels[i]!==b.pixels[i]||a.pixels[i+1]!==b.pixels[i+1]||a.pixels[i+2]!==b.pixels[i+2]||a.pixels[i+3]!==b.pixels[i+3]){
       different++;
       if(!first)first={x:(i/4)%a.w,y:Math.floor((i/4)/a.w),a:[...a.pixels.slice(i,i+4)],b:[...b.pixels.slice(i,i+4)]};
      }
     }
     return {sizeMismatch:false,different,first,w:a.w,h:a.h};
    },[desktopPng.toString('base64'),mobilePng.toString('base64')]);
    console.log('PNG desktop/mobile comparison:',JSON.stringify({desktopBytes:desktopPng.length,mobileBytes:mobilePng.length,...result}));
    assert.equal(result.different,0,'desktop/mobile exported pixels identical');
   }
  }

  // Mobile: touch double-tap enters crop mode; Done restores ordinary editing.
  const mobileImage=page.locator('#stage .element').nth(2);
  await mobileImage.tap();await mobileImage.tap();
  assert.equal(await page.locator('#imageRepositionBar').isVisible(),true,'double-tap enters image reposition mode');
  assert.equal(await page.locator('#stage .element.repositioning').count(),1,'mobile crop frame marked');
  // Switch the existing (currently closed) properties view to Content without
  // opening the full-height mobile panel over the gesture target.
  await page.evaluate(()=>{
   document.querySelector('#inspector [data-inspector-tab="content"]').click();
   const field=document.querySelector('#inspector [data-prop="imageFit"]');
   field.value='free';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.querySelector('#inspector [data-prop="imgScale"]'));
  const mobileBeforeFrame=await page.locator('#stage .element.repositioning').evaluate(el=>el.style.left);
  const mobileBeforeOffset=Number(await page.locator('#inspector [data-prop="imgOffsetX"]').inputValue());
  const mobileBeforeScale=Number(await page.locator('#inspector [data-prop="imgScale"]').inputValue());
  const mobileBeforeStageWidth=await page.locator('#stage').evaluate(el=>el.style.width);
  const imageRect=await page.locator('#stage .element.repositioning').boundingBox();
  const midX=Math.round(imageRect.x+imageRect.width*.50),midY=Math.round(imageRect.y+imageRect.height*.52);
  const client=await page.context().newCDPSession(page);
  const finger=(id,x,y)=>({id,x,y});
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(11,midX,midY)]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(11,midX+24,midY+13)]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.notEqual(Number(await page.locator('#inspector [data-prop="imgOffsetX"]').inputValue()),mobileBeforeOffset,
    'touch drag updates image offset');
  assert.equal(await page.locator('#stage .element.repositioning').evaluate(el=>el.style.left),mobileBeforeFrame,
    'touch drag leaves frame stationary');
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(21,midX-25,midY)]});
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(21,midX-25,midY),finger(22,midX+25,midY)]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(21,midX-43,midY),finger(22,midX+43,midY)]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(Number(await page.locator('#inspector [data-prop="imgScale"]').inputValue())>mobileBeforeScale,
    'two-finger pinch increases Free image scale');
  assert.equal(await page.locator('#stage').evaluate(el=>el.style.width),mobileBeforeStageWidth,
    'image pinch must not zoom the whole card');
  await client.detach();
  await page.locator('#imageRepositionBar button').tap();
  assert.equal(await page.locator('#imageRepositionBar').isVisible(),false,'mobile Done ends crop mode');
  // An explicit control is available when a double-tap isn't recognised.
  const phoneMoveArtwork=page.locator('#mobileArtworkModeButton');
  assert.equal(await phoneMoveArtwork.isVisible(),true,'selected image offers Move artwork');
  await phoneMoveArtwork.tap();
  assert.equal(await page.locator('#stage .element.repositioning').count(),1,'button enters image crop mode');
  assert.equal(await phoneMoveArtwork.getAttribute('aria-pressed'),'true');
  await phoneMoveArtwork.tap();
  assert.equal(await page.locator('#stage .element.repositioning').count(),0,'button exits image crop mode');
  assert.equal(await phoneMoveArtwork.getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('.top').isVisible(),false,'desktop controls hidden on phone');
  // Double-tap allows the same text-only editing mode on touch screens.
  const mobileTitle=page.locator('#stage .element').nth(3);
  await mobileTitle.tap();await mobileTitle.tap();
  assert.equal(await page.locator('#stage .element.text-isolated').count(),1,'mobile double-tap isolates text');
  assert.equal(await page.locator('#imageRepositionBar').isVisible(),true,'mobile independent text toolbar visible');
  // Verify a genuine tap exits the mode, separately from low-level CDP touch injection.
  await page.locator('#imageRepositionBar button').tap();
  assert.equal(await page.locator('#stage .text-isolated').count(),0,'touch Done exits independent text mode');
  await mobileTitle.tap();await mobileTitle.tap();
  assert.equal(await page.locator('#stage .text-isolated').count(),1,'mobile can re-enter independent text mode');
  const mobileTextBefore=await page.locator('#stage .element.text-isolated').evaluate(el=>el.style.left);
  const textPosition=await page.locator('#stage .element.text-isolated').boundingBox();
  const touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:31,x:Math.round(textPosition.x+24),y:Math.round(textPosition.y+12)}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:31,x:Math.round(textPosition.x+44),y:Math.round(textPosition.y+12)}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await touch.detach();
  assert.notEqual(await page.locator('#stage .element.text-isolated').evaluate(el=>el.style.left),mobileTextBefore,
   'mobile isolated text can be moved');
  // A CDP-injected drag suppresses the next synthesized touch click in Chromium.
  // Use a mouse click to verify the action after testing the real touch Done above.
  assert.equal(await page.locator('#imageRepositionBar button').getAttribute('data-action'),'finish-text-isolation');
  await page.locator('#imageRepositionBar button').click();
  assert.equal(await page.locator('#stage .text-isolated').count(),0,'Done exits independent text editing after drag');
  await page.locator('.m-mode [data-action="mode-cards"]').click();
  await page.locator('#mobileCardNav').waitFor({state:'visible',timeout:5000});
  await page.locator('.m-dock [data-mobile="properties"]').click();
  const filter=page.locator('#inspector [data-card-filter="search"]');
  await filter.waitFor({state:'visible'});
  const allRows=await page.locator('#inspector [data-card-row]:visible').count();
  assert.ok(allRows>=2,'card data has several editable fields');
  await filter.fill('no-field-matches-this');
  assert.equal(await page.locator('#inspector [data-card-row]:visible').count(),0,'search filters card values');
  await filter.fill('Card Title');
  assert.equal(await page.locator('#inspector [data-card-row]:visible').count(),1,'search finds matching field');
  await filter.fill('');
  assert.equal(await page.locator('#inspector [data-card-row]:visible').count(),allRows,'clearing search restores all fields');
  await page.locator('.side-right [data-mobile="close"]').click();
  await page.locator('.m-dock [data-mobile="cards"]').click();
  await page.locator('.side-left').waitFor({state:'visible',timeout:5000});
  await page.waitForFunction(()=>document.querySelector('img[data-card-thumb="0"]')?.getAttribute('src')?.startsWith('data:image/png'),null,{timeout:10000});
  await page.locator('.sidebar-cards [data-action="add-card"]').click();
  assert.match(await page.locator('#mobileCardLabel').innerText(),/Card 002/,'new card selected');
  await page.locator('.m-dock [data-mobile="add"]').click();
  await page.locator('.m-actions').waitFor({state:'visible',timeout:5000});
  await page.locator('.m-actions [data-action="add-text"]').click();
  await page.locator('#mobileSelection').waitFor({state:'visible',timeout:5000});
  await page.locator('.m-selection [data-mobile="quick"]').click();
  await page.locator('#mobileQuickText').fill('Mobile editing works');
  await page.locator('[data-mobile="apply-text"]').click();
  assert.match(await page.locator('#stage').innerText(),/Mobile editing\s+works/,'per-card text replaced');
  await page.locator('.m-appbar [data-action="undo"]').click();
  assert.doesNotMatch(await page.locator('#stage').innerText(),/Mobile editing\s+works/,'mobile undo');
  await page.locator('.m-appbar [data-action="redo"]').click();
  assert.match(await page.locator('#stage').innerText(),/Mobile editing\s+works/,'mobile redo');
  const beforeNudge=await page.locator('#stage .element.selected').getAttribute('style');
  await page.locator('.m-selection [data-mobile="nudge"]').click();
  await page.locator('.m-actions [data-mobile="nudge-right"]').click();
  const afterNudge=await page.locator('#stage .element.selected').getAttribute('style');
  assert.notEqual(afterNudge,beforeNudge,'mobile precision nudge changes geometry');
  await page.locator('.m-actions [data-mobile="nudge-step"]').click();
  assert.match(await page.locator('.m-actions [data-mobile="nudge-step"]').innerText(),/10 px/);
  await page.locator('.m-actions [data-mobile="close"]').click();
  await page.locator('.m-dock [data-mobile="properties"]').click();
  await page.locator('.side-right').waitFor({state:'visible',timeout:5000});
  assert.equal(await page.locator('#inspector [data-inspector-tab]').count(),4,'mobile shares property tabs');
  await page.locator('#inspector [data-inspector-tab="layout"]').click();
  assert.ok(await page.locator('#inspector input[data-prop="x"]').count(),'Layout shows position');
  await page.locator('#inspector [data-inspector-tab="style"]').click();
  assert.ok(await page.locator('#inspector [data-prop="fillMode"]').count(),'Style shows appearance');
  await page.locator('#inspector [data-inspector-tab="rules"]').click();
  assert.ok(await page.locator('#inspector [data-prop="hidden"]').count(),'Rules shows visibility');
  assert.ok((await page.locator('.side-right .inspect').innerText()).length>10);
  await page.locator('.side-right [data-mobile="close"]').click();
  await page.locator('.m-dock [data-mobile="fit"]').click();
  await page.screenshot({path:'test-results/mobile.png'});
  assert.deepEqual(errors,[],'no browser exceptions');
  await phone.close();

  // Tablet rotation retains the live document and stays in the touch layout.
  const tablet=await browser.newContext({viewport:{width:810,height:1100},hasTouch:true,isMobile:true});
  const tp=await tablet.newPage();tp.on('pageerror',e=>errors.push('tablet: '+e.message));
  await tp.goto(url);
  await tp.locator('#mobileShell').waitFor({state:'visible'});
  const tabletImage=tp.locator('#stage .element').nth(2);
  await tabletImage.tap();
  const tabletMove=tp.locator('#mobileArtworkModeButton');
  assert.equal(await tabletMove.isVisible(),true,'tablet exposes Move artwork control');
  await tabletMove.tap();
  assert.equal(await tp.locator('#stage .element.repositioning').count(),1,
   'tablet button enters crop mode without double-tap');
  await tabletMove.tap();
  assert.equal(await tp.locator('#stage .element.repositioning').count(),0,
   'tablet button exits crop mode');
  await tp.locator('.m-dock [data-mobile="add"]').click();
  await tp.locator('.m-actions [data-action="add-shape"]').click();
  const countBeforeRotate=await tp.locator('#stage .element').count();
  await tp.setViewportSize({width:1100,height:810});
  await tp.waitForFunction(()=>document.documentElement.dataset.layout==='mobile'&&
   document.querySelector('#stage')?.getBoundingClientRect().width>0);
  assert.equal(await tp.locator('#stage .element').count(),countBeforeRotate,'orientation keeps edits');
  await tablet.close();

  // Fresh browser storage: a completed edit is backed up locally and survives reload.
  const recovery=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  const rp=await recovery.newPage();rp.on('pageerror',e=>errors.push('recovery: '+e.message));
  await rp.goto(url);
  await rp.waitForFunction(()=>document.getElementById('recoveryStatus')?.textContent==='Local recovery ready');
  assert.equal(await rp.locator('#recoveryDialog').count(),0,'new profile has no recovery copy');
  const defaultCount=await rp.locator('#stage .element').count();
  await rp.locator('.work-tools [data-action="add-shape"]').click();
  await rp.waitForFunction(()=>document.getElementById('recoveryStatus')?.textContent==='Backed up locally',null,{timeout:12000});
  await rp.reload();
  await rp.locator('#recoveryDialog').waitFor({state:'visible',timeout:8000});
  assert.match(await rp.locator('#recoveryDialog').innerText(),/Untitled deck/);
  await rp.locator('#recoveryRestore').click();
  await rp.locator('#recoveryDialog').waitFor({state:'detached',timeout:8000});
  assert.equal(await rp.locator('#stage .element').count(),defaultCount+1,'restored unsaved element after reload');
  // Restoring must not silently consume or delete the recovery copy.
  await rp.reload();
  await rp.locator('#recoveryDialog').waitFor({state:'visible',timeout:8000});
  await rp.locator('#recoveryDiscard').click();
  await rp.locator('#recoveryDialog').waitFor({state:'detached',timeout:8000});
  await rp.reload();
  await rp.waitForFunction(()=>document.getElementById('recoveryStatus')?.textContent==='Local recovery ready');
  assert.equal(await rp.locator('#recoveryDialog').count(),0,'discarded backup stays discarded');
  assert.equal(await rp.locator('#stage .element').count(),defaultCount,'discard does not replace the document');

  // An explicit successful project save clears its local recovery. Downloads
  // without a native file handle do not pretend the project was saved.
  await rp.evaluate(()=>{
   window.showSaveFilePicker=async()=>({
    name:'recovery-browser.cardstudio.json',
    createWritable:async()=>({
     write:async(contents)=>{window.__projectSavedText=String(contents)},
     close:async()=>{window.__projectSaveClosed=true}
    })
   });
  });
  await rp.locator('.work-tools [data-action="add-shape"]').click();
  await rp.waitForFunction(()=>document.getElementById('recoveryStatus')?.textContent==='Backed up locally',null,{timeout:12000});
  await rp.locator('#fileMenu summary').click();
  await rp.locator('#fileMenu [data-action="save-project"]').click();
  await rp.waitForFunction(()=>window.__projectSaveClosed&&document.getElementById('recoveryStatus')?.textContent==='Project saved');
  const savedProject=await rp.evaluate(()=>window.__projectSavedText);
  await rp.reload();
  await rp.waitForFunction(()=>document.getElementById('recoveryStatus')?.textContent==='Local recovery ready');
  assert.equal(await rp.locator('#recoveryDialog').count(),0,'confirmed project save clears recovery');

  // Large deck: ensure the entire JSON, all staged cards and embedded images
  // survive IndexedDB storage without depending on localStorage quota.
  const base=JSON.parse(savedProject);
  const titleElement=base.template.elements.find(e=>e.kind==='text');
  base.projectName='Large deck recovery smoke test';
  base.cards=Array.from({length:240},(_,i)=>({
   id:'bulk-'+i,name:'Card '+String(i+1).padStart(3,'0'),
   values:{[titleElement.id]:'Card title '+i},overrides:{},extraElements:[]
  }));
  // Use real high-entropy PNG data, not tiny images that fit localStorage.
  const pixel=await rp.evaluate(()=>{
   const c=document.createElement('canvas');c.width=512;c.height=512;
   const x=c.getContext('2d'),image=x.createImageData(c.width,c.height);
   let seed=20261104;
   for(let i=0;i<image.data.length;i+=4){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    image.data[i]=seed&255;image.data[i+1]=(seed>>>8)&255;
    image.data[i+2]=(seed>>>16)&255;image.data[i+3]=255;
   }
   x.putImageData(image,0,0);
   return c.toDataURL('image/png');
  });
  base.sets=[{id:'bulk-images',name:'Artwork',images:Array.from({length:12},(_,i)=>({
   name:'image-'+i+'.png',data:pixel
  }))}];
  assert.ok(Buffer.byteLength(JSON.stringify(base))>5*1024*1024,'large deck exceeds typical localStorage quota');
  await rp.locator('#openProjectFile').setInputFiles({
   name:'large-deck.cardstudio.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(base))
  });
  await rp.waitForFunction(()=>document.querySelectorAll('.sidebar-cards .card-row').length===240,null,{timeout:20000});
  await rp.locator('.work-tools [data-action="add-shape"]').click();
  await rp.waitForFunction(()=>document.getElementById('recoveryStatus')?.textContent==='Backed up locally',null,{timeout:15000});
  await rp.reload();
  await rp.locator('#recoveryDialog').waitFor({state:'visible',timeout:8000});
  const downloadPromise=rp.waitForEvent('download');
  await rp.locator('#recoveryDownload').click();
  const recoveredDownload=await downloadPromise;
  const recoveredPath=await recoveredDownload.path();
  const recoveredData=JSON.parse(fs.readFileSync(recoveredPath,'utf8'));
  assert.equal(recoveredData.cards.length,240,'large deck card count retained');
  assert.equal(recoveredData.sets[0].images.length,12,'all embedded artwork retained');
  assert.equal(recoveredData.template.elements.length,base.template.elements.length+1,'unsaved edit retained in backup');
  await rp.locator('#recoveryRestore').click();
  await rp.locator('#recoveryDialog').waitFor({state:'detached',timeout:8000});
  assert.equal(await rp.locator('.sidebar-cards .card-row').count(),240);
  assert.equal(await rp.locator('#stage .element').count(),defaultCount+2,'loaded and recovered edits remain');
  await recovery.close();

  // Installed PWA must still run, edit and recover a project with the network off.
  const offline=await browser.newContext({viewport:{width:900,height:1100},hasTouch:true,isMobile:true,acceptDownloads:true,serviceWorkers:'allow'});
  const op=await offline.newPage();op.on('pageerror',e=>errors.push('offline: '+e.message));
  await op.goto(url);
  await op.evaluate(()=>navigator.serviceWorker.ready);
  await op.reload();
  await op.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:15000});
  const manifest=await op.evaluate(async()=>await (await fetch('./manifest.webmanifest')).json());
  assert.equal(manifest.display,'standalone');
  const appIcon=await op.evaluate(async()=>{
   const picture=await createImageBitmap(await (await fetch('./icons/card-512.png')).blob());
   return [picture.width,picture.height];
  });
  assert.deepEqual(appIcon,[512,512],'install icon is a decodable PNG');
  await offline.setOffline(true);
  await op.reload({waitUntil:'domcontentloaded',timeout:15000});
  await op.locator('#stage .element').first().waitFor({timeout:8000});
  assert.equal(await op.locator('#mobileShell').isVisible(),true,'installed offline phone/tablet UI');
  await op.locator('.m-dock [data-mobile="add"]').click();
  await op.locator('.m-actions [data-action="add-shape"]').click();
  await op.waitForFunction(()=>document.getElementById('recoveryStatus')?.textContent==='Backed up locally',null,{timeout:12000});
  await op.reload({waitUntil:'domcontentloaded',timeout:15000});
  await op.locator('#recoveryDialog').waitFor({state:'visible',timeout:8000});
  await op.locator('#recoveryRestore').click();
  await op.locator('#recoveryDialog').waitFor({state:'detached',timeout:8000});
  assert.equal(await op.locator('#stage .element').count(),7,'offline recovery keeps edited document');
  await offline.setOffline(false);
  await offline.close();
  assert.deepEqual(errors,[],'no browser exceptions');
  console.log('Browser checks passed: editing, PNG parity, tablet rotation, recovery, 240 cards, and offline PWA');
 }finally{await browser.close();shutdown()}
})().catch(e=>{console.error(e);if(server.listening)server.close();process.exitCode=1});
