import {fail} from './http.js';
// Bounded ZIP structure validation. This is not a replacement for EPUBCheck.
export function validateEpub(bytes) {
  const invalid=()=>fail(415,'invalid_epub','The upload is not a supported EPUB ZIP archive.');
  if (bytes.length<58) invalid();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder();
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
    if(view.getUint32(i,true)===0x06054b50 && i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
  }
  if(end<0 || view.getUint16(end+4,true)!==0 || view.getUint16(end+6,true)!==0)invalid();
  const entries=view.getUint16(end+10,true),start=view.getUint32(end+16,true),size=view.getUint32(end+12,true);
  if(entries<3 || entries>10000 || view.getUint16(end+8,true)!==entries || start+size!==end)invalid();
  if(view.getUint32(0,true)!==0x04034b50 || view.getUint16(8,true)!==0)invalid();
  const firstNameLength=view.getUint16(26,true),extra=view.getUint16(28,true);
  if(firstNameLength!==8 || decoder.decode(bytes.subarray(30,38))!=='mimetype' || view.getUint32(18,true)!==20 || decoder.decode(bytes.subarray(38+extra,58+extra))!=='application/epub+zip')invalid();
  let cursor=start,total=0;const names=new Set();
  for(let i=0;i<entries;i++){
    if(cursor+46>end || view.getUint32(cursor,true)!==0x02014b50 || (view.getUint16(cursor+8,true)&1))invalid();
    const compressed=view.getUint32(cursor+20,true),uncompressed=view.getUint32(cursor+24,true),local=view.getUint32(cursor+42,true);
    const length=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true);
    if(cursor+46+length+extraLength+comment>end || local+30>start || view.getUint32(local,true)!==0x04034b50)invalid();
    const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+length));
    if(!name || name.startsWith('/') || name.includes('\\') || name.includes('\0') || name.split('/').includes('..') || names.has(name))invalid();
    if(local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true)+compressed>start)invalid();
    if(![0,8].includes(view.getUint16(cursor+10,true)))invalid();
    names.add(name);total+=uncompressed;if(total>256*1024*1024)invalid();
    cursor+=46+length+extraLength+comment;
  }
  if(cursor!==end || !names.has('mimetype') || !names.has('META-INF/container.xml') || ![...names].some(n=>n.endsWith('.opf')))invalid();
  return {entries,uncompressedBytes:total};
}
