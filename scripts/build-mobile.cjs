/* Produce a mobile-only entrypoint for future Capacitor/PWA packaging.
   The document model, rendering and actions stay in the same shared bundle. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'public'),destination=path.join(root,'mobile-build');
const index=path.join(source,'index.html');
if(!fs.existsSync(index)||!fs.existsSync(path.join(source,'dist/app.js'))){
 throw new Error('Run npm run build:pages before building mobile assets');
}
fs.rmSync(destination,{recursive:true,force:true});
fs.cpSync(source,destination,{recursive:true});
const outputIndex=path.join(destination,'index.html');
let html=fs.readFileSync(outputIndex,'utf8');
const marker='<script>document.documentElement.dataset.appTarget="mobile"</script>';
if(!html.includes(marker))html=html.replace('<head>','<head>'+marker);
fs.writeFileSync(outputIndex,html);
console.log('Mobile package web assets available in mobile-build/');
