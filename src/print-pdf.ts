/** Dependency-free PDF writer: one JPEG-encoded full-resolution print sheet per page. */
export interface PdfJpegPage {jpeg:Uint8Array;pixelWidth:number;pixelHeight:number;widthMm:number;heightMm:number;}
const encoder=new TextEncoder();
export function buildPrintPdf(pages:PdfJpegPage[]):Blob {
  if(!pages.length)throw Error('There are no print pages');
  const data:Uint8Array[]=[];
  const offsets:number[]=[0];
  let position=0;
  const add=(bytes:Uint8Array)=>{data.push(bytes);position+=bytes.byteLength;};
  const str=(s:string)=>add(encoder.encode(s));
  const obj=(id:number,text:string)=>{offsets[id]=position;str(id+' 0 obj\n'+text+'\nendobj\n');};
  str('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  const refs=pages.map((_,i)=>(3+i*3)+' 0 R').join(' ');
  obj(2,'<< /Type /Pages /Kids ['+refs+'] /Count '+pages.length+' >>');
  pages.forEach((page,i)=>{
    if(!page.jpeg.byteLength||page.pixelWidth<=0||page.pixelHeight<=0)throw Error('Invalid JPEG print sheet');
    const p=3+i*3,im=p+1,content=p+2;
    const w=(page.widthMm*72/25.4).toFixed(5),h=(page.heightMm*72/25.4).toFixed(5);
    obj(p,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+w+' '+h+'] /Resources << /XObject << /Sheet'+i+' '+im+' 0 R >> >> /Contents '+content+' 0 R >>');
    offsets[im]=position;
    str(im+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+page.pixelWidth+' /Height '+page.pixelHeight+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+page.jpeg.byteLength+' >>\nstream\n');
    add(page.jpeg);
    str('\nendstream\nendobj\n');
    const command=encoder.encode('q\n'+w+' 0 0 '+h+' 0 0 cm\n/Sheet'+i+' Do\nQ\n');
    offsets[content]=position;
    str(content+' 0 obj\n<< /Length '+command.byteLength+' >>\nstream\n');
    add(command);
    str('endstream\nendobj\n');
  });
  const startXref=position,count=pages.length*3+3;
  str('xref\n0 '+count+'\n0000000000 65535 f \n');
  for(let id=1;id<count;id++)str(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
  str('trailer\n<< /Size '+count+' /Root 1 0 R >>\nstartxref\n'+startXref+'\n%%EOF\n');
  // Collect all parts into an ArrayBuffer with a concrete, non-shared type.
  // TypeScript 5.9's BlobPart excludes Uint8Array<ArrayBufferLike>.
  const buffer=new ArrayBuffer(position);
  const bytes=new Uint8Array(buffer);
  let cursor=0;
  for(const chunk of data){bytes.set(chunk,cursor);cursor+=chunk.byteLength;}
  return new Blob([buffer],{type:'application/pdf'});
}