import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {signedMediaURL,authorizedMediaURL} from '../media-proxy.mjs';
const secret='public-test-fixture-key';const env={MEDIA_PROXY_SECRET:secret};
async function withFetch(fn, run) { const original=globalThis.fetch;globalThis.fetch=fn;try {await run()}finally{globalThis.fetch=original} }
test('catalog scraping extracts data without carrying source page scripts',async()=>{
 await withFetch(async()=>new Response('<script>untrusted()</script><script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{defaultSections:[{name:'trending',movies:[]}],messages:{unneeded:true}}}})+'</script>'),async()=>{const r=await worker.fetch(new Request('http://localhost/api/home'));const d=await r.json();assert.equal(r.status,200);assert.ok(d.defaultSections);assert.equal(d.messages,undefined);assert.equal(JSON.stringify(d).includes('untrusted'),false)});
});
test('Arabic SRT subtitles become browser-compatible VTT with timestamps preserved',async()=>{
 await withFetch(async url=>{assert.equal(new URL(url).hostname,'subtitles.vidy.st');return new Response('1\n00:00:02,000 --> 00:00:05,250\nمرحبا بالعالم\n')},async()=>{const r=await worker.fetch(new Request('http://localhost/api/subtitle?url='+encodeURIComponent('https://subtitles.vidy.st/download?id=fixture')));assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'text/vtt; charset=utf-8');assert.match(await r.text(),/^WEBVTT\n\n1\n00:00:02\.000 --> 00:00:05\.250\nمرحبا بالعالم/)});
});
test('HLS proxy signs newly advertised CDN hosts without a hardcoded allowlist',async()=>{
 const root='https://moon.zenoak.top/video/index.m3u8';
 const init='https://peakpine.top/video/init.mp4', segment='https://another-cdn.example/video/seg-1.m4s';
 const signed=await signedMediaURL(root,secret);
 await withFetch(async(url,options)=>{assert.equal(options.headers.Referer,'https://www.movy.sx/');return new Response('#EXTM3U\n#EXT-X-MAP:URI="'+init+'"\n#EXTINF:6,\n'+segment+'\n',{headers:{'content-type':'application/vnd.apple.mpegurl'}})},async()=>{
  const r=await worker.fetch(new Request('http://localhost'+signed),env);const body=await r.text();assert.equal(r.status,200);
  const initURL=body.match(/URI="([^"]+)"/)[1],segmentURL=body.split('\n').find(line=>line.startsWith('/api/'));
  assert.equal((await authorizedMediaURL(new URL('http://localhost'+initURL).searchParams,secret)).href,init);
  assert.equal((await authorizedMediaURL(new URL('http://localhost'+segmentURL).searchParams,secret)).href,segment);
 });
});
test('modified hosts, unsigned URLs and expired grants are rejected before any upstream request',async()=>{
 const signed=await signedMediaURL('https://peakpine.top/init.mp4',secret);
 const changed=new URL('http://localhost'+signed);changed.searchParams.set('url','https://attacker.example/init.mp4');
 const expired=await signedMediaURL('https://peakpine.top/init.mp4',secret,Math.floor(Date.now()/1000)-10);
 await withFetch(async()=>{assert.fail('Must not fetch invalid media links')},async()=>{
  for(const path of [changed.href,'http://localhost'+expired,'http://localhost/api/media?url=https://peakpine.top/init.mp4']){
   const r=await worker.fetch(new Request(path),env);assert.equal(r.status,403);
  }
 });
});
test('signed chunk requests preserve Range and partial response headers',async()=>{
 const signed=await signedMediaURL('https://peakpine.top/chunk.mp4',secret);
 await withFetch(async(url,options)=>{assert.equal(options.headers.Range,'bytes=0-3');return new Response('data',{status:206,headers:{'content-type':'video/mp4','content-range':'bytes 0-3/100','content-length':'4'}})},async()=>{
  const r=await worker.fetch(new Request('http://localhost'+signed,{headers:{Range:'bytes=0-3'}}),env);assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 0-3/100');assert.equal(await r.text(),'data');
 });
});
test('proxy endpoints and title lookup reject arbitrary upstream URLs',async()=>{
 await withFetch(async()=>{throw Error('Must not make upstream request')},async()=>{for(const path of ['/api/detail?path=https://example.com/','/api/subtitle?url=https://example.com/file.srt']){const r=await worker.fetch(new Request('http://localhost'+path));assert.equal(r.status,502)}});
});
