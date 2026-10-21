import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
async function withFetch(fn, run) { const original=globalThis.fetch;globalThis.fetch=fn;try {await run()}finally{globalThis.fetch=original} }
test('catalog scraping extracts data without carrying source page scripts',async()=>{
 await withFetch(async()=>new Response('<script>untrusted()</script><script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{defaultSections:[{name:'trending',movies:[]}],messages:{unneeded:true}}}})+'</script>'),async()=>{const r=await worker.fetch(new Request('http://localhost/api/home'));const d=await r.json();assert.equal(r.status,200);assert.ok(d.defaultSections);assert.equal(d.messages,undefined);assert.equal(JSON.stringify(d).includes('untrusted'),false)});
});
test('Arabic SRT subtitles become browser-compatible VTT with timestamps preserved',async()=>{
 await withFetch(async url=>{assert.equal(new URL(url).hostname,'subtitles.vidy.st');return new Response('1\n00:00:02,000 --> 00:00:05,250\nمرحبا بالعالم\n')},async()=>{const r=await worker.fetch(new Request('http://localhost/api/subtitle?url='+encodeURIComponent('https://subtitles.vidy.st/download?id=fixture')));assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'text/vtt; charset=utf-8');assert.match(await r.text(),/^WEBVTT\n\n1\n00:00:02\.000 --> 00:00:05\.250\nمرحبا بالعالم/)});
});
test('HLS media proxy rewrites segments and initialization URLs and sends provider headers',async()=>{
 await withFetch(async(url,options)=>{assert.equal(options.headers.Referer,'https://www.movy.sx/');return new Response('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6,\nseg-1.m4s\n',{headers:{'content-type':'application/vnd.apple.mpegurl'}})},async()=>{const r=await worker.fetch(new Request('http://localhost/api/media?url='+encodeURIComponent('https://moon.zenoak.top/video/index.m3u8')));const body=await r.text();assert.equal(r.status,200);assert.ok(body.includes('/api/media?url='+encodeURIComponent('https://moon.zenoak.top/video/init.mp4')));assert.ok(body.includes('/api/media?url='+encodeURIComponent('https://moon.zenoak.top/video/seg-1.m4s')))});
});
test('proxy endpoints and title lookup reject arbitrary upstream URLs',async()=>{
 await withFetch(async()=>{throw Error('Must not make upstream request')},async()=>{for(const path of ['/api/detail?path=https://example.com/','/api/media?url=https://example.com/test.m3u8','/api/subtitle?url=https://example.com/file.srt']){const r=await worker.fetch(new Request('http://localhost'+path));assert.equal(r.status,502)}});
});
