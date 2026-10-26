import http from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import worker from './worker/index.js';

http.createServer(async(req,res)=>{
  try{
    const out=await worker.fetch(new Request('http://localhost:4173'+req.url,{method:req.method,headers:req.headers}));
    res.writeHead(out.status,Object.fromEntries(out.headers));
    if(req.method==='HEAD'){await out.body?.cancel();res.end()}
    else if(out.body)await pipeline(Readable.fromWeb(out.body),res);
    else res.end();
  }catch(error){
    if(res.destroyed)return;
    if(res.headersSent)res.destroy(error);
    else{res.writeHead(500);res.end('Local server request failed')}
  }
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
