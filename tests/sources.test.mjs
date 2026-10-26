import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
async function request(path,handler){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push([String(url),options]);return handler(String(url),options)};
 try{const response=await worker.fetch(new Request('http://localhost'+path));return {response,data:await response.json(),calls}}finally{globalThis.fetch=original}
}
test('catalog source routes search and pagination independently and tags titles',async()=>{
 const html='<a href="/movies/example/" title="فيلم Example 2024 مترجم"><img data-src="/wp-content/uploads/example.jpg" src="placeholder.svg"></a><a href="https://evil.example/title/" title="External"><img src="/wp-content/uploads/example.jpg"></a>';
 const r=await request('/api/catalog?source=topcinema&page=2',()=>new Response(html));
 assert.equal(r.response.status,200);assert.equal(r.calls[0][0],'https://topcinema.film/recent/page/2/');
 assert.equal(r.data.items.length,1);assert.equal(r.data.items[0].source,'topcinema');assert.equal(r.data.items[0].image,'https://topcinema.film/wp-content/uploads/example.jpg');
 const q=await request('/api/catalog?source=topcinema&q=Example',()=>new Response('No results'));
 assert.equal(q.data.items.length,0);assert.equal(q.calls[0][0],'https://topcinema.film/search/?query=Example');
});
test('verification pages produce a distinct uncached error, even with HTTP 200',async()=>{
 for(const status of [200,403]){
  const r=await request('/api/catalog?source=topcinema',()=>new Response('<title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/example"></script>',{status}));
  assert.equal(r.response.status,503);assert.equal(r.data.code,'source_verification');assert.equal(r.response.headers.get('cache-control'),'no-store');
 }
});
test('unregistered sources and external redirects are never requested',async()=>{
 const invalid=await request('/api/catalog?source=constructor',()=>{throw Error('No request expected')});assert.equal(invalid.calls.length,0);assert.equal(invalid.response.status,502);
 const redirect=await request('/api/catalog?source=topcinema',()=>new Response(null,{status:302,headers:{location:'https://evil.example/'}}));assert.equal(redirect.calls.length,1);assert.equal(redirect.response.status,502);
});
test('TopCinema details retain same-source relative episode links only',async()=>{
 const html='<div class="story">A story</div><section class="allepcont getMoreByScroll"><a href="/series/example/الحلقة-2/">الحلقة 2</a><a href="https://tv10.egydead.live/episode/example/">الحلقة 3</a></section>';
 const r=await request('/api/detail?url='+encodeURIComponent('https://topcinema.film/series/example/'),()=>new Response(html));
 assert.equal(r.data.story,'A story');assert.equal(r.data.episodes.length,1);assert.match(r.data.episodes[0].url,/topcinema.film/);
});
test('TopCinema uses GET and excludes unsupported external embeds',async()=>{
 const r=await request('/api/play?url='+encodeURIComponent('https://topcinema.film/movie/example/'),()=>new Response('<iframe src="https://unknown.example/embed"></iframe>'));
 assert.equal(r.calls[0][1].method,'GET');assert.equal(r.calls.length,1);assert.deepEqual(r.data.servers,[]);assert.equal(r.data.media,null);
});

test('playback rejects a catalog/source mismatch before contacting either site',async()=>{
 const r=await request('/api/play?source=topcinema&url='+encodeURIComponent('https://tv10.egydead.live/title/'),()=>{throw Error('No upstream request expected')});
 assert.equal(r.response.status,400);assert.equal(r.data.code,'source_mismatch');assert.equal(r.calls.length,0);
});
test('playback reports its actual catalog source instead of a different search destination',async()=>{
 const r=await request('/api/play?source=topcinema&url='+encodeURIComponent('https://topcinema.film/title/'),()=>new Response('<html>No compatible mirrors</html>'));
 assert.equal(r.response.status,200);assert.equal(r.data.source,'topcinema');assert.equal(r.calls.length,1);assert.match(r.calls[0][0],/^https:\/\/topcinema.film\//);
});
