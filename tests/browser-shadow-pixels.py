"""Optional real-Chromium pixel tests: python tests/browser-shadow-pixels.py.
Requires `pip install playwright` and an installed Chromium browser. This is
not a mock: it reads actual PNG-export canvas pixels and editor screenshots.
"""
import asyncio
import io
import os
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = (ROOT / 'dist/app.js').read_text()
assert BUNDLE.endswith("load('main');\n})();\n")
BUNDLE = BUNDLE.replace("load('main');\n})();\n",
    "window.__shadowTest={model:load('model'),png:load('png-renderer'),preview:load('preview')};load('main');\n})();\n")
SCENARIO = r'''async ({scenario,mode})=>{
 const {model,png,preview}=window.__shadowTest;
 const state=model.initial();
 state.template.width=80;state.template.height=80;state.template.unit='px';state.template.dpi=96;
 state.zoom=1;state.mode='template';state.selected=null;state.template.shadowOverlapMode=mode;
 const background=model.makeElement('shape',{name:'Card background',x:0,y:0,w:80,h:80,fillMode:'solid',fill1:'#ffffff'});
 const blue=model.makeElement('shape',{name:'Blue lower artwork',x:10,y:25,w:50,h:20,fillMode:'solid',fill1:'#0000ff'});
 const sh1=model.makeElement('shape',{name:'First shadow',x:10,y:10,w:15,h:10,fillMode:'solid',fill1:'#ff0000',shadowEnabled:true,shadowOpacity:50,shadowColor:'#000000',shadowOffsetX:0,shadowOffsetY:20,shadowSpread:0});
 const sh2=model.makeElement('shape',{name:'Second shadow',x:13,y:10,w:15,h:10,fillMode:'solid',fill1:'#00ff00',shadowEnabled:true,shadowOpacity:50,shadowColor:'#000000',shadowOffsetX:0,shadowOffsetY:20,shadowSpread:0});
 if(scenario==='image'){
  const c=document.createElement('canvas');c.width=20;c.height=20;
  const cctx=c.getContext('2d');cctx.fillStyle='#ff0000';cctx.fillRect(6,6,8,8);
  state.sets=[{id:'a',name:'A',images:[{name:'ball.png',data:c.toDataURL('image/png')}]}];
  const img=model.makeElement('image',{name:'Transparent image',x:10,y:10,w:20,h:20,fillMode:'none',borderWidth:2,borderColor:'#000000',shadowEnabled:true,shadowColor:'#000000',shadowOpacity:50,shadowOffsetY:25,shadowSpread:0,autoSet:'A',autoMode:'single',singleImage:'ball.png'});
  state.template.elements=[background,img];
 }else if(scenario==='zero')state.template.elements=[background];
 else state.template.elements=[background,...(scenario==='blue'?[blue]:[]),sh1,...(scenario==='one'?[]:[sh2])];
 model.replaceState(state);
 const canvas=await png.canvasCard(0,'template');
 preview.renderStage();
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const pts=[[18,35],[5,35],[24,35],[18,16],[18,45],[20,45],[14,45],[10,45]];
 return {pixels:Object.fromEntries(pts.map(([x,y])=>[`${x},${y}`,Array.from(ctx.getImageData(x,y,1,1).data)]))};
}'''

async def main():
 async with async_playwright() as playwright:
  browser=await playwright.chromium.launch(
   executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),
   args=['--no-sandbox','--disable-dev-shm-usage'],headless=True)
  page=await browser.new_page(viewport={'width':1200,'height':900},device_scale_factor=1)
  html=(ROOT/'index.html').read_text()
  html=html.replace('<link rel="stylesheet" href="./styles.css">', '<style>'+ (ROOT/'styles.css').read_text()+'</style>')
  html=html.replace('<script src="./vendor/jszip.min.js"></script>','')
  html=html.replace('<script src="./dist/app.js" defer></script>','')
  await page.set_content(html)
  await page.add_script_tag(content=(ROOT/'vendor/jszip.min.js').read_text())
  await page.add_script_tag(content=BUNDLE)
  await page.wait_for_function('!!window.__shadowTest')
  for scenario,mode,expected in [
   ('one','merge',[127,127,127,255]),
   ('two','merge',[127,127,127,255]),
   ('two','add',[63,63,63,255]),
   ('blue','merge',[0,0,127,255]),
   ('zero','merge',[255,255,255,255]),
  ]:
   result=await page.evaluate(SCENARIO,{'scenario':scenario,'mode':mode})
   actual=result['pixels']['18,35']
   assert actual==expected, f'{scenario} {mode}: PNG expected {expected}, got {actual}'
   shot=Image.open(io.BytesIO(await page.locator('#stage').screenshot())).convert('RGBA')
   assert list(shot.getpixel((18,35)))==expected, f'{scenario} {mode}: preview differs: {shot.getpixel((18,35))}'
  result=await page.evaluate(SCENARIO,{'scenario':'image','mode':'merge'})
  for point,expected in [('20,45',[127,127,127,255]),('14,45',[255,255,255,255]),('10,45',[127,127,127,255])]:
   actual=result['pixels'][point]
   assert actual==expected, f'transparent image {point}: PNG expected {expected}, got {actual}'
  shot=Image.open(io.BytesIO(await page.locator('#stage').screenshot())).convert('RGBA')
  for x,y,expected in [(20,45,[127,127,127,255]),(14,45,[255,255,255,255])]:
   assert list(shot.getpixel((x,y)))==expected, f'transparent image preview {(x,y)} differs: {shot.getpixel((x,y))}'
  await browser.close()
  print('Passed: 6 real Chromium scenarios, preview and exported PNG pixel checks (including transparent image).')

if __name__=='__main__': asyncio.run(main())
