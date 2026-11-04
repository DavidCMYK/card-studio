// Verify actual publicly deployed Cloudflare Pages content, not just a local build.
const assert=require('node:assert/strict');
const url=(process.env.CARD_STUDIO_URL||'').replace(/\/?$/,'/');
const expected=process.env.EXPECTED_SHA||'';
if(!url.startsWith('https://'))throw new Error('CARD_STUDIO_URL must be HTTPS');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function get(path) {
 const res=await fetch(url+path+'?check='+Date.now(),{headers:{'Cache-Control':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw new Error(path+': HTTP '+res.status);
 return res;
}
(async()=>{
 let last;
 // Cloudflare Pages may finish building after the GitHub push workflow starts.
 for(let attempt=0;attempt<40;attempt++){
  try {
   const marker=await (await get('build-info.json')).json();
   if(marker.branch!=='feature/mobile-studio')throw new Error('Wrong deployed branch: '+marker.branch);
   if(expected&&marker.commit!==expected)throw new Error('Deployment is not yet at expected commit; got '+marker.commit);
   const html=await (await get('')).text();
   assert.match(html,/mobile\.css/,'mobile stylesheet included');
   const css=await (await get('mobile.css')).text();
   assert.match(css,/data-layout="mobile"/,'mobile layout styles deployed');
   const js=await (await get('dist/app.js')).text();
   assert.match(js,/mobile-interface/,'mobile editor code deployed');
   const manifest=await (await get('manifest.webmanifest')).json();
   assert.equal(manifest.display,'standalone');
   assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512']);
   const sw=await (await get('service-worker.js')).text();
   assert.ok(sw.includes(marker.commit),'offline cache is versioned to deployed commit');
   assert.doesNotMatch(sw,/__CACHE_VERSION__/,'service worker build token replaced');
   for(const size of [192,512]){
    const bytes=Buffer.from(await (await get('icons/card-'+size+'.png')).arrayBuffer());
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),size);
    assert.equal(bytes.readUInt32BE(20),size);
   }
   console.log('Live Pages verified: '+url+' branch='+marker.branch+' commit='+marker.commit);
   return;
  }catch(e){last=e;if(attempt<39)await sleep(10000)}
 }
 throw last;
})().catch(e=>{console.error(e);process.exitCode=1});
