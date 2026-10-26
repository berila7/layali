// Use a timeout compatible with the hosted Worker runtime.
async function fetchTimed(url,options={}) {
 const {timeoutMs=15000,...settings}=options;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{return await fetch(url,{...settings,redirect:settings.redirect==='error'?'manual':(settings.redirect||'manual'),signal:controller.signal})}finally{clearTimeout(timer)}
}
const ORIGIN='https://tv10.egydead.live';
const SOURCES={egydead:{id:'egydead',name:'EgyDead',origin:ORIGIN},topcinema:{id:'topcinema',name:'TopCinema',origin:'https://topcinema.film'}};
function provider(id='egydead'){if(!Object.hasOwn(SOURCES,id))throw Error('Invalid source');return SOURCES[id]}
function sourceError(code,message){return Object.assign(new Error(message),{code})}
function checkSourceHTML(html){if(/<title>\s*Just a moment|window\._cf_chl_opt|id=["'](?:challenge-form|cf-challenge-running)["']/i.test(html))throw sourceError('source_verification','This source requires verification and cannot currently be scraped.');return html}

const decode=s=>String(s||'').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const text=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const attr=(s,n)=>decode((s.match(new RegExp('(?:^|\\s)'+n+'\\s*=\\s*["\']([^"\']*)["\']','i'))||[])[1]||'');
function sourceURL(raw){const u=new URL(raw);if(!Object.values(SOURCES).some(s=>s.origin===u.origin)||u.username||u.password)throw Error('Invalid source');return u}
function publicHTTPS(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname)&&u.hostname.includes('.')}catch{return false}}
async function source(u,post=false){sourceURL(u);const r=await fetchTimed(u,{method:post?'POST':'GET',headers:{'User-Agent':'Mozilla/5.0 (compatible; LayaliPersonalCatalog/1.0)','Accept':'text/html',...(post?{'content-type':'application/x-www-form-urlencoded'}:{})},...(post?{body:'View=1'}:{}),redirect:'manual',timeoutMs:15000});if(r.status>=300&&r.status<400){const dest=new URL(r.headers.get('location'),u);sourceURL(dest.href);if(dest.origin!==new URL(u).origin)throw Error('Invalid source redirect');if(dest.href===u)throw Error('Source redirect loop');const next=await fetchTimed(dest,{timeoutMs:10000,redirect:'error'});const html=checkSourceHTML(await next.text());if(!next.ok)throw Error('Source unavailable');return html}const html=checkSourceHTML(await r.text());if(!r.ok)throw Error('Source unavailable');return html}
function parseCatalog(html,site=SOURCES.egydead){
 const out=[],seen=new Set();
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const imageTag=(m[2].match(/<img\b[^>]*>/i)||[])[0];if(!imageTag)continue;
  const originalTitle=attr(m[1],'title')||attr(imageTag,'alt')||text(m[2]);
  let url,image;
  try{url=new URL(attr(m[1],'href'),site.origin).href;image=new URL(attr(imageTag,'data-src')||attr(imageTag,'data-lazy-src')||attr(imageTag,'src'),site.origin).href;sourceURL(url);sourceURL(image)}catch{continue}
  if(!originalTitle||seen.has(url)||new URL(url).origin!==site.origin||new URL(image).origin!==site.origin||!new URL(image).pathname.startsWith('/wp-content/uploads/'))continue;
  seen.add(url);
  const type=/انمي|أنمي|كرتون/.test(originalTitle)?'anime':/مسلسل|برنامج|الحلقة|الموسم/.test(originalTitle)?'series':'movies';
  out.push({id:url,source:site.id,title:originalTitle.replace(/^(مشاهدة فيلم|مشاهدة|فيلم|مسلسل|انمي|برنامج)\s*/,'').replace(/\s*(مترجم.*|مدبلج.*)$/,'').trim(),originalTitle,url,image,type,year:(originalTitle.match(/\b(20\d{2}|19\d{2})\b/)||[])[0]||''});
 }
 return out;
}
function isStreamRuby(server) {
  return server.driver === 'streamruby' || /^streamruby(?:\s|$)/i.test(server.name || '');
}
async function resolveStreamRuby(server) {
  const url = new URL(server.url);
  if (!['stmruby.com', 'rubyvidhub.com'].includes(url.hostname)) return null;
  const response = await fetchTimed(url, {timeoutMs: 6000, redirect: 'error'});
  if (!response.ok) return null;
  const body = await response.text();
  const packed = body.match(/\}\('((?:\\.|[^'])*)',\s*(\d+),\s*(\d+),\s*'((?:\\.|[^'])*)'\.split\('\|'\)/);
  if (!packed || Number(packed[2]) < 2 || Number(packed[2]) > 36) return null;
  const words = packed[4].split('|'), base = Number(packed[2]);
  const unpacked = packed[1].replace(/\\'/g, "'").replace(/\b\w+\b/g, word => {
    const index = parseInt(word, base);
    return Number.isFinite(index) && words[index] ? words[index] : word;
  });
  const media = unpacked.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)/)?.[1];
  return publicHTTPS(media) && /\.streamruby\.net$/.test(new URL(media).hostname) ? media : null;
}
function unpackPlayer(body){
 const packed=body.match(/\}\('((?:\\.|[^'])*)',\s*(\d+),\s*(\d+),\s*'((?:\\.|[^'])*)'\.split\('\|'\)/);
 if(!packed||Number(packed[2])<2||Number(packed[2])>36)return null;
 const words=packed[4].split('|'),base=Number(packed[2]);
 return packed[1].replace(/\\'/g,"'").replace(/\b\w+\b/g,word=>{const index=parseInt(word,base);return Number.isFinite(index)&&words[index]?words[index]:word});
}
const DIRECT_MIRRORS={
 videotube:{origin:'https://down.vidtube.one',cdn:'.cdn-video.xyz'},
 okstream:{origin:'https://okstream.online',cdn:'.cloudcdn.casa'},
 updown:{origin:'https://updown.cam',cdn:'.gamescdn.online'},
 lulustream:{origin:'https://luluvdo.com',cdn:'.cdn-tnmr.org'}
};
async function resolveTopCinema(html,watchURL,requestedServer=null){
 const mirrors=[];
 for(const m of html.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)){
  if(!/\bserver--item\b/.test(attr(m[1],'class')))continue;
  const postId=attr(m[1],'data-id'),id=attr(m[1],'data-server'),name=text(m[2]);
  if(!/^\d{1,12}$/.test(postId)||!/^\d{1,2}$/.test(id)||!name||mirrors.some(x=>x.id===id))continue;
  mirrors.push({id,postId,name,active:/\bactive\b/.test(attr(m[1],'class'))});
 }
 const initial=html.match(/<div\b[^>]*class=["'][^"']*\bplayer--iframe\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||html;
 const embedIn=body=>{
  for(const m of body.matchAll(/<iframe\b([^>]*)>/gi)){
   try{const url=new URL(attr(m[1],'src'),watchURL);if(publicHTTPS(url.href))return url.href}catch{}
  }return null;
 };
 // Some older pages provide a compatible player without server rows.
 if(!mirrors.length){const embed=embedIn(initial);if(embed){const entry=Object.entries(DIRECT_MIRRORS).find(([,rule])=>new URL(embed).origin===rule.origin);if(entry)mirrors.push({id:'0',name:{videotube:'VideoTube',okstream:'OkStream',updown:'UpDown',lulustream:'LuluStream'}[entry[0]],active:true,embed})}}
 const publicMirrors=mirrors.map(({id,name})=>({id,name}));
 if(requestedServer!==null&&!mirrors.some(m=>m.id===requestedServer))throw sourceError('invalid_server','This server is not available for the selected title.');
 async function load(mirror){
  let embed=mirror.embed||(mirror.active?embedIn(initial):null);
  if(!embed&&mirror.postId){
   const response=await fetchTimed(SOURCES.topcinema.origin+'/wp-content/themes/movies2023/Ajaxat/Single/Server.php',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest','Referer':watchURL.href},
    body:new URLSearchParams({id:mirror.postId,i:mirror.id}).toString(),timeoutMs:4000,redirect:'manual'
   });
   const body=checkSourceHTML(await response.text());if(response.ok)embed=embedIn(body);
  }
  const base={media:null,mirrors:publicMirrors,selectedServer:mirror.id,provider:mirror.name,servers:embed?[{url:embed,name:mirror.name,driver:'topcinema-embed'}]:[],reason:'server_unavailable'};
  const rule=DIRECT_MIRRORS[mirror.name.toLowerCase()];
  if(!embed||!rule)return base;
  const url=new URL(embed);
  if(url.origin!==rule.origin||!/^\/(?:embed-[a-z0-9-]+\.html|e\/[a-z0-9]+)$/i.test(url.pathname))return base;
  try{
   const response=await fetchTimed(url,{headers:{Referer:watchURL.href},timeoutMs:4000,redirect:'manual'});
   if(!response.ok)return base;
   const unpacked=unpackPlayer(checkSourceHTML(await response.text()));
   const raw=unpacked?.match(/(?:sources\s*:\s*\[\s*\{\s*)?file\s*:\s*["']([^"']+)/)?.[1];
   const media=streamURL(raw);
   if(!media.hostname.endsWith(rule.cdn))return base;
   return {...base,media:media.href,format:media.pathname.endsWith('.m3u8')?'hls':'mp4',proxied:true,servers:[],reason:null};
  }catch{return base}
 }
 if(requestedServer!==null)return load(mirrors.find(m=>m.id===requestedServer));
 const candidates=[...mirrors].sort((a,b)=>{const order=['videotube','okstream','updown','lulustream'];const rank=m=>{const i=order.indexOf(m.name.toLowerCase());return i<0?99:i};return rank(a)-rank(b)});
 let fallback;
 for(const mirror of candidates.filter(m=>DIRECT_MIRRORS[m.name.toLowerCase()]).slice(0,2)){
  try{const result=await load(mirror);if(result.media)return result;fallback||=result}catch{}
 }
 if(fallback)return fallback;
 if(mirrors.length){try{return await load(mirrors[0])}catch{}}
 return {media:null,servers:[],mirrors:publicMirrors,reason:'incompatible_providers'};
}
async function playback(target,requestedServer=null) {
  let html = await source(target, new URL(target).origin===ORIGIN);
  // New source pages link to a separate watch page; older pages contain servers inline.
  // Follow only the selected title's same-origin watch URL, never arbitrary page links.
  const titleURL = sourceURL(target);
  const watchURL = new URL(titleURL.href);
  watchURL.pathname = titleURL.pathname.replace(/\/$/, '') + '/watch/';
  watchURL.search = '';
  watchURL.hash = '';
  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const href = attr(match[1], 'href');
    if (!href) continue;
    let link;
    try { link = new URL(href, titleURL); } catch { continue; }
    if (link.href === watchURL.href) {
      html = await source(watchURL.href);
      break;
    }
  }
  if(titleURL.origin===SOURCES.topcinema.origin)return resolveTopCinema(html,watchURL,requestedServer);
  const servers = [];
  for (const match of html.matchAll(/<li\b([^>]*\bdata-link\s*=\s*["'][^"']+["'][^>]*)>([\s\S]*?)<\/li>/gi)) {
    const url = attr(match[1], 'data-link');
    if (publicHTTPS(url) && !servers.some(s => s.url === url)) servers.push({url, name: text(match[2])});
  }
  // Accept only the already supported public Ruby embeds from an additional catalog.
  for(const m of html.matchAll(/<(?:iframe|a)\b([^>]*)>/gi)){
    const raw=attr(m[1],'src')||attr(m[1],'href');
    try{const link=new URL(raw,target);if(['stmruby.com','rubyvidhub.com'].includes(link.hostname)&&link.protocol==='https:'&&!servers.some(s=>s.url===link.href))servers.push({url:link.href,name:'StreamRuby'})}catch{}
  }
  const compatible = servers.filter(isStreamRuby);
  const raw = (html.match(/<(?:source|video)\b[^>]*src=["']([^"']+\.mp4(?:\?[^"']*)?)["']/i) || [])[1];
  if (publicHTTPS(raw)) return {servers: compatible, media: decode(raw)};
  // Older titles list mirrors directly, whereas newer titles use an aggregator.
  // Search the full list so a sandbox-incompatible first entry cannot hide Ruby.
  for (const server of compatible.slice(0, 2)) {
    try {
      const media = await resolveStreamRuby(server);
      if (media) return {servers: compatible, media, format: 'hls'};
    } catch { /* Preserve the compatible iframe fallback. */ }
  }
  for (const server of servers.filter(s => new URL(s.url).hostname === 'q7v3k8m2p1.top').slice(0, 1)) {
    try {
      const resolved = await resolveProvider(server);
      if (resolved?.media || resolved?.servers?.length) return resolved;
    } catch { /* Give a useful unavailable state instead of an incompatible frame. */ }
  }
  return {servers: compatible, media: null, reason: compatible.length ? null : 'incompatible_providers'};
}
// Read the provider's ordinary public player metadata; never execute its scripts.
async function resolveProvider(server) {
  if (new URL(server.url).hostname !== 'q7v3k8m2p1.top') return null;
  const url = new URL(server.url);
  url.searchParams.set('nt', '1');
  const htmlResponse = await fetchTimed(url, {timeoutMs: 6000, redirect: 'error'});
  if (!htmlResponse.ok) return null;
  const html = await htmlResponse.text();
  const match = html.match(/<script[^>]*data-page="app"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  const initial = JSON.parse(match[1]);
  const response = await fetchTimed(url, {headers: {
    'X-Inertia': 'true', 'X-Inertia-Version': initial.version,
    'X-Inertia-Partial-Component': initial.component,
    'X-Inertia-Partial-Data': 'streams', 'X-Requested-With': 'XMLHttpRequest'
  }, timeoutMs: 6000, redirect: 'error'});
  if (!response.ok) return null;
  const data = await response.json();
  const servers = [];
  for (const quality of data.props?.streams?.data || []) {
    for (const mirror of quality.mirrors || []) {
      const link = new URL(mirror.link, url).href;
      if (publicHTTPS(link)) servers.push({url: link, name: mirror.driver + ' · ' + quality.label, driver: mirror.driver});
    }
  }
  const compatible = servers.filter(isStreamRuby);
  for (const ruby of compatible.slice(0, 2)) {
    try {
      const media = await resolveStreamRuby(ruby);
      if (media) return {servers: compatible, media, format: 'hls'};
    } catch { /* Try another compatible source without loading provider scripts. */ }
  }
  return {servers: compatible, media: null, reason: compatible.length ? null : 'incompatible_providers'};
}

function streamURL(raw, base) {
  const url = new URL(raw, base);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !(url.hostname.endsWith('.streamruby.net')||url.hostname.endsWith('.cloudcdn.casa')||url.hostname.endsWith('.cdn-video.xyz')||url.hostname.endsWith('.gamescdn.online')||url.hostname.endsWith('.cdn-tnmr.org'))) throw Error('Unsupported video host');
  return url;
}
const streamProxyURL = url => '/api/stream?url=' + encodeURIComponent(url);
async function streamResponse(request, raw) {
  let target = streamURL(raw);
  const headers = {Accept: '*/*'};
  if (request.headers.has('range')) headers.Range = request.headers.get('range');
  let response;
  // Validate every redirect before requesting it; never forward browser origin or cookies.
  for (let hop = 0; hop < 4; hop++) {
    // These CDNs require the public player origin as the media request referrer.
    // Use the fixed origin for that CDN; never forward the browser's referrer.
    const providerReferrer=target.hostname.endsWith('.cdn-video.xyz')?'https://down.vidtube.one/':target.hostname.endsWith('.gamescdn.online')?'https://updown.cam/':null;
    if(providerReferrer)headers.Referer=providerReferrer;else delete headers.Referer;
    response = await fetchTimed(target, {headers, redirect: 'manual', timeoutMs: 12000});
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || hop === 3) throw Error('Video redirect failed');
    target = streamURL(location, target);
  }
  if (!response.ok) return new Response('Video source unavailable. Retry playback.', {status: 502});
  const type = response.headers.get('content-type') || 'application/octet-stream';
  if (target.pathname.endsWith('.m3u8') || /mpegurl/i.test(type)) {
    const playlist = await response.text();
    if (!playlist.trimStart().startsWith('#EXTM3U')) throw Error('Invalid video playlist');
    const rewrite = raw => streamProxyURL(streamURL(raw, target).href);
    const body = playlist.split(/\r?\n/).map(line => {
      if (!line.trim()) return line;
      return line.startsWith('#')
        ? line.replace(/URI="([^"]+)"/g, (_, url) => 'URI="' + rewrite(url) + '"')
        : rewrite(line.trim());
    }).join('\n');
    return new Response(body, {headers: {'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff'}});
  }
  const out = {'content-type': type, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff'};
  for (const name of ['content-range', 'content-length', 'accept-ranges']) {
    if (response.headers.has(name)) out[name] = response.headers.get(name);
  }
  return new Response(response.body, {status: response.status, headers: out});
}

const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, max-age=120','x-content-type-options':'nosniff'}});
export default {async fetch(request,env,ctx){const u=new URL(request.url);try{
if(u.pathname==='/api/stream')return await streamResponse(request,u.searchParams.get('url'));
if(u.pathname==='/assets/hls.min.js')return new Response(HLS_LIBRARY,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'public,max-age=86400'}});
if(u.pathname==='/api/image'){const target=sourceURL(u.searchParams.get('url'));if(!target.pathname.startsWith('/wp-content/uploads/')||!/\.(jpe?g|png|webp)$/i.test(target.pathname))return new Response('Invalid image',{status:400});const r=await fetchTimed(target,{redirect:'error',timeoutMs:12000});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))return new Response('Image unavailable',{status:502});return new Response(r.body,{headers:{'content-type':r.headers.get('content-type'),'cache-control':'public,max-age=86400','x-content-type-options':'nosniff'}})}
if(u.pathname==='/api/catalog'){const site=provider(u.searchParams.get('source')||'egydead');const q=(u.searchParams.get('q')||'').slice(0,100),p=Math.min(10000,Math.max(1,parseInt(u.searchParams.get('page')||'1')||1));const target=site.id==='topcinema'?site.origin+(q?'/search/?query='+encodeURIComponent(q):p===1?'/recent/':'/recent/page/'+p+'/'):q?site.origin+'/?s='+encodeURIComponent(q):p===1?site.origin+'/h3/':site.origin+'/page/'+p+'/';const items=parseCatalog(await source(target),site);if(!items.length&&!q)throw Error('Empty source catalog');return json({items,page:p,source:site.id})}
if(u.pathname==='/api/detail'){const target=sourceURL(u.searchParams.get('url'));const h=await source(target.href);const story=text((h.match(/class=["']extra-content["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)||h.match(/class=["'](?:singleStory|story)["'][^>]*>([\s\S]*?)<\/div>/i)||[])[1]);const episodes=[];const seen=new Set();const episodeHTML=target.origin===SOURCES.topcinema.origin?(h.match(/<section\b[^>]*class=["'][^"']*\ballepcont\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1]||''):h;for(const m of episodeHTML.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){const raw=attr(m[1],'href');let url;try{url=new URL(raw,target).href;sourceURL(url)}catch{continue}const title=attr(m[1],'title')||text(m[2]);if(new URL(url).origin!==target.origin||!(/\/episodes?\//.test(new URL(url).pathname)||target.origin!==ORIGIN&&/الحلقة/.test(title))||!title||seen.has(url))continue;seen.add(url);episodes.push({url,title})}return json({story,episodes:episodes.slice(0,100)})}
if(u.pathname==='/api/play'){
 const target=sourceURL(u.searchParams.get('url'));
 const site=Object.values(SOURCES).find(site=>site.origin===target.origin);
 const expected=u.searchParams.get('source');
 if(expected&&expected!==site.id)return json({code:'source_mismatch',error:'The title does not belong to the selected playback source.'},400);
 return json({...await playback(target.href,u.searchParams.get('server')),source:site.id});
}
if(u.pathname!=='/')return new Response('Not found',{status:404});return new Response(PAGE,{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.streamruby.net; media-src 'self' https: blob:; worker-src 'self' blob:; frame-src https:; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'self'"}})
}catch(e){const response=json({error:['source_verification','invalid_server'].includes(e.code)?e.message:'The source is unavailable. Please try again later.',code:e.code||'source_unavailable'},e.code==='source_verification'?503:e.code==='invalid_server'?400:502);response.headers.set('cache-control','no-store');return response}}};
