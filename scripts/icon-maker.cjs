/** Build small PNG app icons with Node built-ins; no external design dependencies. */
const zlib=require('node:zlib');
const fs=require('node:fs');
const path=require('node:path');
function crc(bytes){
 let value=0xffffffff;
 for(const byte of bytes){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^(value&1?0xedb88320:0)}
 return (value^0xffffffff)>>>0;
}
function chunk(kind,data=Buffer.alloc(0)){
 const tag=Buffer.from(kind,'ascii'),len=Buffer.alloc(4),sum=Buffer.alloc(4);
 len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([tag,data])));
 return Buffer.concat([len,tag,data,sum]);
}
const inRounded=(x,y,l,t,r,b,radius)=>{
 if(x<l||x>r||y<t||y>b)return false;
 const cx=Math.max(l+radius,Math.min(r-radius,x));
 const cy=Math.max(t+radius,Math.min(b-radius,y));
 return Math.hypot(x-cx,y-cy)<=radius;
};
function iconPng(size){
 const pixels=Buffer.alloc(size*(size*4+1));
 const navy=[20,37,59],pale=[145,179,220],white=[250,252,255],blue=[57,118,228],ink=[33,62,101];
 function paint(x,y){
  const X=x/size,Y=y/size;
  let rgb=navy;
  // The two offset rectangles evoke stacked collectible cards.
  if(inRounded(X,Y,.16,.22,.66,.81,.045))rgb=pale;
  if(inRounded(X,Y,.28,.15,.84,.87,.052))rgb=white;
  if(inRounded(X,Y,.35,.23,.77,.29,.013))rgb=ink;
  if(inRounded(X,Y,.35,.36,.77,.64,.018))rgb=blue;
  if(inRounded(X,Y,.39,.40,.73,.60,.01))rgb=[31,77,149];
  if(inRounded(X,Y,.35,.70,.77,.745,.008))rgb=ink;
  if(inRounded(X,Y,.35,.78,.62,.80,.005))rgb=pale;
  return rgb;
 }
 for(let y=0;y<size;y++){
  let offset=y*(size*4+1);pixels[offset++]=0;
  for(let x=0;x<size;x++){
   const c=paint(x,y);
   pixels[offset++]=c[0];pixels[offset++]=c[1];pixels[offset++]=c[2];pixels[offset++]=255;
  }
 }
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);
 ihdr[8]=8;ihdr[9]=6; // RGBA, 8 bits/channel
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(pixels,{level:9})),chunk('IEND')]);
}
function writeIcons(output){
 const folder=path.join(output,'icons');fs.mkdirSync(folder,{recursive:true});
 for(const size of [192,512])fs.writeFileSync(path.join(folder,'card-'+size+'.png'),iconPng(size));
}
module.exports={iconPng,writeIcons};
if(require.main===module)writeIcons(path.resolve(__dirname,'..','public'));
