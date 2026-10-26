import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
const root='https://video.streamruby.net/hls/master.m3u8?token=signed';
const proxy=u=>'http://localhost/api/stream?url='+encodeURIComponent(u);
async function mocked(fetcher,run){const original=globalThis.fetch;globalThis.fetch=fetcher;try{await run()}finally{globalThis.fetch=original}}
test('proxies playlists without Origin, Referer, cookies or browser authorization',async()=>{
 await mocked(async(url,options)=>{assert.equal(String(url),root);assert.deepEqual(options.headers,{Accept:'*/*'});return new Response('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nvariant/index.m3u8\nhttps://second.streamruby.net/chunk.ts\n')},async()=>{
  const r=await worker.fetch(new Request(proxy(root),{headers:{Origin:'https://layali.example',Referer:'https://layali.example/',Cookie:'private',Authorization:'Bearer secret'}}));const s=await r.text();assert.equal(r.status,200);for(const path of ['https://video.streamruby.net/hls/init.mp4','https://video.streamruby.net/hls/key.bin','https://video.streamruby.net/hls/variant/index.m3u8','https://second.streamruby.net/chunk.ts'])assert.ok(s.includes('/api/stream?url='+encodeURIComponent(path)));assert.equal(r.headers.get('cache-control'),'private, no-store');
 });
});
test('preserves range requests and streams partial video responses',async()=>{
 await mocked(async(url,options)=>{assert.equal(options.headers.Range,'bytes=0-3');return new Response('data',{status:206,headers:{'content-type':'video/mp2t','content-range':'bytes 0-3/100','content-length':'4','accept-ranges':'bytes'}})},async()=>{const r=await worker.fetch(new Request(proxy('https://video.streamruby.net/chunk.ts'),{headers:{Range:'bytes=0-3'}}));assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 0-3/100');assert.equal(await r.text(),'data')});
});
test('rejects unrelated hosts, lookalikes, credentials and unsafe redirects',async()=>{
 let calls=0;await mocked(async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://unrelated.example/video'}})},async()=>{
  for(const url of ['http://video.streamruby.net/a','https://streamruby.net.evil.example/a','https://user:pass@video.streamruby.net/a','https://127.0.0.1/a'])assert.equal((await worker.fetch(new Request(proxy(url)))).status,502);
  assert.equal(calls,0);assert.equal((await worker.fetch(new Request(proxy(root)))).status,502);assert.equal(calls,1);
 });
});
test('reports failed or non-playlist upstream data instead of returning HTML as video',async()=>{
 for(const response of [new Response('Forbidden',{status:403}),new Response('<html>Error</html>')])await mocked(async()=>response,async()=>assert.equal((await worker.fetch(new Request(proxy(root)))).status,502));
});
test('TopCinema media requests use only the matching public provider referrer',async()=>{
 for(const [host,referer] of [['node.cdn-video.xyz','https://down.vidtube.one/'],['node.gamescdn.online','https://updown.cam/']]){
  await mocked(async(url,options)=>{assert.equal(new URL(url).hostname,host);assert.equal(options.headers.Referer,referer);assert.equal(options.headers.Range,'bytes=0-3');assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Origin,undefined);return new Response('data',{status:206,headers:{'content-type':'video/mp4','content-range':'bytes 0-3/100'}})},async()=>{
   const r=await worker.fetch(new Request(proxy('https://'+host+'/video.mp4'),{headers:{Referer:'https://private-browser.example/',Origin:'https://private-browser.example',Cookie:'session=secret',Range:'bytes=0-3'}}));assert.equal(r.status,206);assert.equal(await r.text(),'data');
  });
 }
});
test('a CDN redirect resets the fixed provider referrer for the destination host',async()=>{
 let calls=0;await mocked(async(url,options)=>{calls++;if(calls===1){assert.equal(options.headers.Referer,'https://down.vidtube.one/');return new Response(null,{status:302,headers:{location:'https://node.streamruby.net/chunk.ts'}})}assert.equal(options.headers.Referer,undefined);return new Response('data',{headers:{'content-type':'video/mp2t'}})},async()=>{const r=await worker.fetch(new Request(proxy('https://node.cdn-video.xyz/chunk.ts')));assert.equal(r.status,200);assert.equal(calls,2)});
});
