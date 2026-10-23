import assert from 'node:assert/strict';
import {crc32} from 'node:zlib';

// A stored ZIP containing only generated technical content. No real books.
export function epub(size){
  const entries=[['mimetype',Buffer.from('application/epub+zip')],['META-INF/container.xml',Buffer.from('<container/>')],['book.opf',Buffer.from('<package/>')],['padding.bin',Buffer.alloc(0)]];
  const overhead=entries.reduce((n,[name,bytes])=>n+76+2*Buffer.byteLength(name)+bytes.length,22);
  entries[3][1]=Buffer.alloc(size-overhead,97);
  const local=[],central=[];let offset=0;
  for(const [name,bytes] of entries){
    const filename=Buffer.from(name),header=Buffer.alloc(30),directory=Buffer.alloc(46);
    const checksum=crc32(bytes);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(checksum,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26);
    directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt32LE(checksum,16);directory.writeUInt32LE(bytes.length,20);directory.writeUInt32LE(bytes.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
    local.push(header,filename,bytes);central.push(directory,filename);offset+=30+filename.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}

export async function inspector(mf){
  const base=await mf.getInspectorURL();base.protocol='http:';
  const targets=await (await fetch(new URL('/json/list',base))).json();
  const target=targets.find(t=>t.id==='core:user:upload-profile');assert.ok(target,'Upload worker inspector target');
  const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let sequence=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=({data})=>{const message=JSON.parse(data),call=pending.get(message.id);if(call){pending.delete(message.id);message.error?call.reject(new Error(JSON.stringify(message.error))):call.resolve(message.result)}};
  return {
    call(method){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method}));})},
    async close(){const closed=new Promise(resolve=>ws.addEventListener('close',resolve,{once:true}));ws.close();await closed;}
  };
}
