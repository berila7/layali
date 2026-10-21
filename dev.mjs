import http from 'node:http';
import worker from './worker/index.js';
http.createServer(async(req,res)=>{try{const out=await worker.fetch(new Request('http://localhost:4173'+req.url));res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()))}catch(e){res.writeHead(500);res.end(String(e))}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
