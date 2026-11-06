/** Run explicitly with: node tests/large-artwork.browser.cjs
 * Requires Playwright and npm run build:pages. Exercise the real editor,
 * rather than emulating selection logic, with an inline multi-megabyte image.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const model=require('../.build/model.js');
const root=path.resolve(__dirname,'../public');
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,bytes)=>{
  if(err){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(bytes);
 });
});
(async()=>{
 const target=process.env.CARD_STUDIO_URL;
 if(!target)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=target||'http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  const largeData=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');
   canvas.width=1800;canvas.height=2400;
   const ctx=canvas.getContext('2d'),raster=ctx.createImageData(canvas.width,canvas.height);
   for(let i=0;i<raster.data.length;i+=4){
    const v=Math.imul(i+1,16807)^Math.imul(i>>>8,813);
    raster.data[i]=v&255;raster.data[i+1]=(v>>>8)&255;
    raster.data[i+2]=(v>>>16)&255;raster.data[i+3]=255;
   }
   ctx.putImageData(raster,0,0);
   return canvas.toDataURL('image/jpeg',.94);
  });
  assert.ok(largeData.length>2_000_000,'Fixture needs a multi-megabyte image file');
  const project=model.initial();
  const art=project.template.elements.find(e=>e.kind==='image');
  const title=project.template.elements.find(e=>e.kind==='text');
  assert.ok(art&&title,'Expected initial template to contain image and text');
  // This is a normal-sized frame, with an intentionally large source file.
  art.x=32;art.y=35;art.w=140;art.h=185;
  art.autoSet='repro-art';art.autoMode='single';art.singleImage='large.jpg';
  art.linkedTextId=title.id;art.anchorLeft=true;art.anchorOffsetLeft=art.x-title.x;
  project.template.elements=[title,art];project.templates=[project.template];
  project.template.guides.showTemplate=true;
  project.template.guides.showCards=true;
  project.sets=[{id:'repro-art',name:'Large artwork',images:[{name:'large.jpg',data:largeData}]}];
  await page.locator('#openProjectFile').setInputFiles({
   name:'large-artwork.cardstudio.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(project))
  });
  const image=page.locator('#stage .element[data-id="'+art.id+'"]');
  await image.waitFor();
  await page.waitForFunction(()=>Boolean(document.querySelector('#stage .image-content img')?.complete),
    null,{timeout:30000});
  const original=await image.evaluate(el=>({left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height}));
  assert.equal(await page.locator('#stage .guide-safe').count(),1,'guide visible on load');
  const position=await image.boundingBox();
  const x=position.x+position.width*.46,y=position.y+position.height*.48;
  const cpu=await context.newCDPSession(page);
  await cpu.send('Emulation.setCPUThrottlingRate',{rate:16});
  await page.mouse.click(x,y);
  await page.waitForTimeout(130);
  await page.mouse.click(x,y);
  await page.locator('#stage .element.repositioning').waitFor({timeout:9000});
  assert.equal(await page.locator('#imageRepositionBar').isVisible(),true,
   'large inline image enters reposition mode after two normal clicks');
  assert.deepEqual(await image.evaluate(el=>({left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height})),
   original,'double click cannot change saved frame geometry or anchors');
  assert.equal(await page.locator('#stage .guide-safe').count(),1,'guide survives double-click');
  await cpu.send('Emulation.setCPUThrottlingRate',{rate:1});
  await page.locator('#imageRepositionBar button').click();
  await page.waitForTimeout(850);
  assert.equal(await page.locator('#stage .guide-safe').count(),1,'deferred repaint preserves guide');
  assert.deepEqual(await image.evaluate(el=>({left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height})),original);
  assert.deepEqual(errors,[],'no browser exceptions');
  console.log('Large image double-click, anchored geometry and guides passed.');
  await context.close();
 }finally{await browser.close();if(server.listening)server.close();}
})().catch(e=>{console.error(e);if(server.listening)server.close();process.exitCode=1});
