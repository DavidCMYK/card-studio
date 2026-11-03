/* Real Chromium smoke test for desktop and touch interfaces. Run after build:pages. */
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
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
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
  const errors=[];
  const desktop=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  const dp=await desktop.newPage();dp.on('pageerror',e=>errors.push('desktop: '+e.message));
  await dp.goto(url);
  await dp.locator('#stage .element').first().waitFor();
  assert.equal(await dp.locator('.top').isVisible(),true,'desktop toolbar visible');
  assert.equal(await dp.locator('#mobileShell').isVisible(),false,'mobile toolbar hidden on desktop');
  await dp.screenshot({path:'test-results/desktop.png'});
  await desktop.close();

  const phone=await browser.newContext({...devices['Pixel 7'],acceptDownloads:true});
  const page=await phone.newPage();page.on('pageerror',e=>errors.push('mobile: '+e.message));
  await page.goto(url);
  await page.locator('#mobileShell').waitFor({state:'visible'});
  assert.equal(await page.locator('.top').isVisible(),false,'desktop controls hidden on phone');
  await page.locator('.m-mode [data-action="mode-cards"]').click();
  assert.equal(await page.locator('#mobileCardNav').isVisible(),true);
  await page.locator('.m-dock [data-mobile="cards"]').click();
  assert.equal(await page.locator('.side-left').isVisible(),true,'cards tool opens');
  await page.locator('.sidebar-cards [data-action="add-card"]').click();
  assert.match(await page.locator('#mobileCardLabel').innerText(),/Card 002/,'new card selected');
  await page.locator('.m-dock [data-mobile="add"]').click();
  assert.equal(await page.locator('.m-actions').isVisible(),true,'add menu opens');
  await page.locator('.m-actions [data-action="add-text"]').click();
  assert.equal(await page.locator('#mobileSelection').isVisible(),true,'new element selected');
  await page.locator('.m-selection [data-mobile="quick"]').click();
  await page.locator('#mobileQuickText').fill('Mobile editing works');
  await page.locator('[data-mobile="apply-text"]').click();
  assert.match(await page.locator('#stage').innerText(),/Mobile editing works/,'per-card text replaced');
  await page.locator('.m-dock [data-mobile="properties"]').click();
  assert.equal(await page.locator('.side-right').isVisible(),true,'advanced properties sheet opens');
  assert.ok((await page.locator('.side-right .inspect').innerText()).length>10);
  await page.locator('.side-right [data-mobile="close"]').click();
  await page.locator('.m-dock [data-mobile="fit"]').click();
  await page.screenshot({path:'test-results/mobile.png'});
  assert.deepEqual(errors,[],'no browser exceptions');
  await phone.close();
  console.log('Browser checks passed: desktop, phone navigation, card creation, properties and fit');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
