import test from 'node:test';import assert from 'node:assert/strict';import worker from '../worker/index.js';
const title='https://topcinema.film/movie-test/',watch=title+'watch/',ajax='https://topcinema.film/wp-content/themes/movies2023/Ajaxat/Single/Server.php',embed='https://okstream.online/embed-test123.html',media='https://test.cloudcdn.casa/master.m3u8';
const packed="eval(function(p,a,c,k,e,d){return p}('0({1:[{2:\"3\"}]})',36,4,'setup|sources|file|"+media+"'.split('|')))";
async function run(routes,server=null){const old=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{const key=String(url);calls.push({url:key,options});if(!(key in routes))throw Error('Unexpected fetch: '+key);return new Response(routes[key])};try{const r=await worker.fetch(new Request('http://localhost/api/play?url='+encodeURIComponent(title)+(server===null?'':'&server='+encodeURIComponent(server))));return {status:r.status,data:await r.json(),calls}}finally{globalThis.fetch=old}}
test('title click follows its watch page and normal OkStream server selection to a direct HLS source',async()=>{
 const r=await run({[title]:'<a class="watch" href="'+watch+'">Watch</a>',[watch]:'<li class="server--item active" data-id="1234" data-server="0">VideoTube</li><li class="server--item" data-id="1234" data-server="1"><span>OkStream</span></li><iframe src="https://down.vidtube.one/embed-test.html"></iframe>',['https://down.vidtube.one/embed-test.html']:'Embeds disabled',[ajax]:'<iframe src="'+embed+'"></iframe>',[embed]:packed});
 assert.equal(r.status,200);assert.equal(r.data.media,media);assert.equal(r.data.format,'hls');assert.deepEqual(r.data.servers,[]);assert.deepEqual(r.calls.map(x=>x.url),[title,watch,'https://down.vidtube.one/embed-test.html',ajax,embed]);assert.equal(r.calls[0].options.method,'GET');assert.equal(r.calls[3].options.method,'POST');assert.equal(r.calls[3].options.body,'id=1234&i=1');assert.equal(r.calls[3].options.headers.Referer,watch);
});
test('uses an existing compatible iframe without requesting unrelated mirrors or ad scripts',async()=>{
 const r=await run({[title]:'<iframe src="'+embed+'"></iframe><script src="https://ads.example/script.js"></script>',[embed]:packed});assert.equal(r.data.media,media);assert.deepEqual(r.calls.map(c=>c.url),[title,embed]);
});
test('invalid server metadata and external iframe hosts are never requested',async()=>{
 for(const html of ['<li class="server--item" data-id="../../secret" data-server="1">OkStream</li>','<iframe src="https://okstream.online.evil.example/embed-test.html"></iframe>','<iframe src="https://user:password@okstream.online/embed-test123.html"></iframe>']){const r=await run({[title]:html});assert.equal(r.calls.length,1);assert.equal(r.data.media,null)}
});
test('does not expose a playlist on an unapproved host',async()=>{
 const r=await run({[title]:'<iframe src="'+embed+'"></iframe>',[embed]:packed.replace(media,'https://evil.example/master.m3u8')});assert.equal(r.data.media,null);assert.equal(r.calls.length,2);
});
const tube='https://down.vidtube.one/embed-lanterns.html';
const tubeMedia='https://cdn11.cdn-video.xyz/master.m3u8';
const rows='<li class="server--item active" data-id="252575" data-server="0">VideoTube</li><li class="server--item" data-id="252575" data-server="1">UpDown</li><li class="server--item" data-id="252575" data-server="2">Byse</li><iframe src="'+tube+'"></iframe>';
test('Lanterns-style pages without OkStream play VideoTube and return the full server list',async()=>{
 const r=await run({[title]:rows,[tube]:packed.replace(media,tubeMedia)});
 assert.equal(r.data.provider,'VideoTube');assert.equal(r.data.media,tubeMedia);assert.equal(r.data.selectedServer,'0');assert.deepEqual(r.data.mirrors,[{id:'0',name:'VideoTube'},{id:'1',name:'UpDown'},{id:'2',name:'Byse'}]);assert.equal(r.calls[1].options.headers.Referer,watch);
});
test('explicit mirror selection uses that title/server pair and supports direct MP4',async()=>{
 const up='https://updown.cam/embed-example-1280x640.html',mp4='https://node.gamescdn.online/video.mp4';
 const r=await run({[title]:rows,[ajax]:'<iframe src="'+up+'"></iframe>',[up]:packed.replace(media,mp4)},'1');
 assert.equal(r.data.provider,'UpDown');assert.equal(r.data.selectedServer,'1');assert.equal(r.data.format,'mp4');assert.equal(r.data.proxied,true);assert.equal(r.data.media,mp4);assert.equal(r.calls[1].options.body,'id=252575&i=1');assert.ok(!r.calls.some(c=>c.url===tube));
});
test('unknown or forged mirror IDs are rejected without mirror requests',async()=>{
 for(const id of ['9','https://evil.example/','../secret']){const r=await run({[title]:rows},id);assert.equal(r.status,400);assert.equal(r.data.code,'invalid_server');assert.equal(r.calls.length,1)}
});
test('an external mirror keeps all server choices and does not execute provider scripts in the backend',async()=>{
 const r=await run({[title]:rows,[ajax]:'<iframe src="https://byseqekaho.com/e/example"></iframe>'},'2');
 assert.equal(r.data.media,null);assert.equal(r.data.provider,'Byse');assert.equal(r.data.servers[0].driver,'topcinema-embed');assert.equal(r.data.mirrors.length,3);assert.equal(r.calls.length,2);
});
test('a normal page with Cloudflare telemetry is not mistaken for a verification screen',async()=>{
 const r=await run({[title]:rows,[tube]:packed.replace(media,tubeMedia)+'<script src="/cdn-cgi/challenge-platform/scripts/precursor/main.js"></script>'});assert.equal(r.data.media,tubeMedia);
});
