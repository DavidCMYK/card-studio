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
  await page.locator('.m-dock [data-mobile="properties"]').click();
  await page.locator('.side-right').waitFor({state:'visible',timeout:5000});
  assert.ok((await page.locator('.side-right .inspect').innerText()).length>10);
  await page.locator('.side-right [data-mobile="close"]').click();
  await page.locator('.m-dock [data-mobile="fit"]').click();
  await page.screenshot({path:'test-results/mobile.png'});
  assert.deepEqual(errors,[],'no browser exceptions');
  await phone.close();
  console.log('Browser checks passed: desktop, phone navigation, card creation, properties and fit');
 }finally{await browser.close();shutdown()}
})().catch(e=>{console.error(e);if(server.listening)server.close();process.exitCode=1});
