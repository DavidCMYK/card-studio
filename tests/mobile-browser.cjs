/* Real Chromium smoke test for desktop and touch interfaces. Run after build:pages. */
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium,devices}=require('playwright');
const root=path.resolve(__dirname,'../public');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'};
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
  assert.equal(await dp.locator('.top').isVisible(),true,'desktop toolbar visible');
  assert.equal(await dp.locator('#mobileShell').isVisible(),false,'mobile toolbar hidden on desktop');
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
  // Embed a real test-runner font, save a JSON project, and reopen it on mobile.
  let portableProject=null;
  let fontPath='';
  try{fontPath=execFileSync('fc-match',['-f','%{file}\\n','DejaVu Sans'],{encoding:'utf8'}).trim().split('\\n')[0]}catch{}
  if(fontPath&&fs.existsSync(fontPath)&&fs.statSync(fontPath).size<12*1024*1024){
   dp.once('dialog',dialog=>dialog.accept('Portable Integration'));
   await dp.locator('#fontFiles').setInputFiles({name:'Portable-Integration.ttf',mimeType:'font/ttf',buffer:fs.readFileSync(fontPath)});
   await dp.waitForFunction(()=>[...document.fonts].some(f=>f.family==='Portable Integration'&&f.status==='loaded'),null,{timeout:12000});
   await dp.locator('[data-layer]').filter({hasText:'Card Title'}).click();
   await dp.locator('#inspector input[data-prop="font"]').fill('Portable Integration');
   await dp.locator('#inspector input[data-prop="font"]').press('Tab');
   await dp.locator('#fileMenu summary').click();
   await dp.locator('#fileMenu [data-action="save-project"]').click();
   await dp.waitForFunction(()=>Boolean(window.__savedPortableProject));
   portableProject=await dp.evaluate(()=>window.__savedPortableProject);
   const parsed=JSON.parse(portableProject);
   assert.equal(parsed.fonts[0].family,'Portable Integration','font family bundled');
   assert.ok(parsed.fonts[0].data.startsWith('data:'),'font file bytes saved in project');
  }else console.warn('Skipping optional real font check: fontconfig unavailable');
  await dp.screenshot({path:'test-results/desktop.png'});
  await desktop.close();

  const phone=await browser.newContext({...devices['Pixel 7'],acceptDownloads:true});
  const page=await phone.newPage();page.on('pageerror',e=>errors.push('mobile: '+e.message));
  await page.goto(url);
  await page.locator('#mobileShell').waitFor({state:'visible'});
  if(portableProject){
   await page.locator('#openProjectFile').setInputFiles({name:'portable-test.cardstudio.json',mimeType:'application/json',buffer:Buffer.from(portableProject)});
   await page.waitForFunction(()=>[...document.fonts].some(f=>f.family==='Portable Integration'&&f.status==='loaded'),null,{timeout:12000});
  }
  assert.equal(await page.locator('.top').isVisible(),false,'desktop controls hidden on phone');
  await page.locator('.m-mode [data-action="mode-cards"]').click();
  await page.locator('#mobileCardNav').waitFor({state:'visible',timeout:5000});
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
  assert.ok((await page.locator('.side-right .inspect').innerText()).length>10);
  await page.locator('.side-right [data-mobile="close"]').click();
  await page.locator('.m-dock [data-mobile="fit"]').click();
  await page.screenshot({path:'test-results/mobile.png'});
  assert.deepEqual(errors,[],'no browser exceptions');
  await phone.close();

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
  const pixel=await rp.evaluate(()=>{
   const c=document.createElement('canvas');c.width=96;c.height=96;
   const x=c.getContext('2d');x.fillStyle='#b4a7d6';x.fillRect(0,0,96,96);
   return c.toDataURL('image/png');
  });
  base.sets=[{id:'bulk-images',name:'Artwork',images:Array.from({length:24},(_,i)=>({
   name:'image-'+i+'.png',data:pixel
  }))}];
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
  assert.equal(recoveredData.sets[0].images.length,24,'all embedded artwork retained');
  assert.equal(recoveredData.template.elements.length,base.template.elements.length+1,'unsaved edit retained in backup');
  await rp.locator('#recoveryRestore').click();
  await rp.locator('#recoveryDialog').waitFor({state:'detached',timeout:8000});
  assert.equal(await rp.locator('.sidebar-cards .card-row').count(),240);
  assert.equal(await rp.locator('#stage .element').count(),defaultCount+2,'loaded and recovered edits remain');
  await recovery.close();
  assert.deepEqual(errors,[],'no browser exceptions');
  console.log('Browser checks passed: desktop/mobile editing, local autosave, restore, discard, manual save and 240-card recovery');
 }finally{await browser.close();shutdown()}
})().catch(e=>{console.error(e);if(server.listening)server.close();process.exitCode=1});
