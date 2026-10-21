const ORIGIN='https://tv10.egydead.live';
const decode=s=>String(s||'').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const text=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const attr=(s,n)=>decode((s.match(new RegExp('(?:^|\\s)'+n+'\\s*=\\s*["\']([^"\']*)["\']','i'))||[])[1]||'');
function sourceURL(raw){const u=new URL(raw);if(u.origin!==ORIGIN||u.username||u.password)throw Error('Invalid source');return u}
function publicHTTPS(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname)&&u.hostname.includes('.')}catch{return false}}
async function source(u,post=false){sourceURL(u);const r=await fetch(u,{method:post?'POST':'GET',headers:{'User-Agent':'Mozilla/5.0 (compatible; LayaliPersonalCatalog/1.0)','Accept':'text/html',...(post?{'content-type':'application/x-www-form-urlencoded'}:{})},...(post?{body:'View=1'}:{}),redirect:'manual',signal:AbortSignal.timeout(15000)});if(r.status>=300&&r.status<400){const dest=new URL(r.headers.get('location'),u);sourceURL(dest.href);if(dest.href===u)throw Error('Source redirect loop');const next=await fetch(dest,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!next.ok)throw Error('Source unavailable');return next.text()}if(!r.ok)throw Error('Source unavailable');return r.text()}
function parseCatalog(html){const out=[];const seen=new Set();for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){const imageTag=(m[2].match(/<img\b[^>]*>/i)||[])[0];if(!imageTag)continue;const url=attr(m[1],'href'),image=attr(imageTag,'src'),originalTitle=attr(m[1],'title')||attr(imageTag,'alt');if(!originalTitle||!image||seen.has(url))continue;try{sourceURL(url);sourceURL(image)}catch{continue}seen.add(url);const type=/انمي|كرتون/.test(originalTitle)?'anime':/مسلسل|برنامج/.test(originalTitle)?'series':'movies';out.push({id:url,title:originalTitle.replace(/^(مشاهدة فيلم|مشاهدة|مسلسل|انمي|برنامج)\s*/,'').replace(/\s*(مترجم.*|مدبلج.*)$/,'').trim(),originalTitle,url,image,type,year:(originalTitle.match(/\b(20\d{2}|19\d{2})\b/)||[])[0]||''})}return out}
// Read the provider's ordinary public player metadata; never execute its scripts.
async function resolveProvider(server) {
  if (new URL(server.url).hostname !== 'q7v3k8m2p1.top') return null;
  const url = new URL(server.url);
  url.searchParams.set('nt', '1');
  const htmlResponse = await fetch(url, {signal: AbortSignal.timeout(6000), redirect: 'error'});
  if (!htmlResponse.ok) return null;
  const html = await htmlResponse.text();
  const match = html.match(/<script[^>]*data-page="app"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  const initial = JSON.parse(match[1]);
  const response = await fetch(url, {headers: {
    'X-Inertia': 'true', 'X-Inertia-Version': initial.version,
    'X-Inertia-Partial-Component': initial.component,
    'X-Inertia-Partial-Data': 'streams', 'X-Requested-With': 'XMLHttpRequest'
  }, signal: AbortSignal.timeout(6000), redirect: 'error'});
  if (!response.ok) return null;
  const data = await response.json();
  const servers = [];
  for (const quality of data.props?.streams?.data || []) {
    for (const mirror of quality.mirrors || []) {
      const link = new URL(mirror.link, url).href;
      if (publicHTTPS(link)) servers.push({url: link, name: mirror.driver + ' · ' + quality.label, driver: mirror.driver});
    }
  }
  const ruby = servers.find(s => s.driver === 'streamruby' && new URL(s.url).hostname === 'stmruby.com');
  if (ruby) {
    try {
      const r = await fetch(ruby.url, {signal: AbortSignal.timeout(6000), redirect: 'error'});
      if (r.ok) {
        const body = await r.text();
        const packed = body.match(/\}\('((?:\\.|[^'])*)',\s*(\d+),\s*(\d+),\s*'((?:\\.|[^'])*)'\.split\('\|'\)/);
        if (packed && Number(packed[2]) >= 2 && Number(packed[2]) <= 36) {
          const words = packed[4].split('|'), base = Number(packed[2]);
          const unpacked = packed[1].replace(/\\'/g, "'").replace(/\b\w+\b/g, word => {
            const index = parseInt(word, base);
            return Number.isFinite(index) && words[index] ? words[index] : word;
          });
          const media = unpacked.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)/)?.[1];
          if (publicHTTPS(media) && /\.streamruby\.net$/.test(new URL(media).hostname)) return {servers, media, format: 'hls'};
        }
      }
    } catch { /* Retain the public mirror list if direct video is unavailable. */ }
  }
  return {servers: servers.length ? servers : [{...server, url: url.href}], media: null};
}

const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, max-age=120','x-content-type-options':'nosniff'}});
export default {async fetch(request,env,ctx){const u=new URL(request.url);try{
if(u.pathname==='/assets/hls.min.js')return new Response(HLS_LIBRARY,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'public,max-age=86400'}});
if(u.pathname==='/api/image'){const target=sourceURL(u.searchParams.get('url'));if(!target.pathname.startsWith('/wp-content/uploads/')||!/\.(jpe?g|png|webp)$/i.test(target.pathname))return new Response('Invalid image',{status:400});const r=await fetch(target,{redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))return new Response('Image unavailable',{status:502});return new Response(r.body,{headers:{'content-type':r.headers.get('content-type'),'cache-control':'public,max-age=86400','x-content-type-options':'nosniff'}})}
if(u.pathname==='/api/catalog'){const q=(u.searchParams.get('q')||'').slice(0,100),p=Math.min(10000,Math.max(1,parseInt(u.searchParams.get('page')||'1')||1));const target=q?ORIGIN+'/?s='+encodeURIComponent(q):p===1?ORIGIN+'/h3/':ORIGIN+'/page/'+p+'/';const items=parseCatalog(await source(target));if(!items.length)throw Error('Empty source catalog');return json({items,page:p})}
if(u.pathname==='/api/detail'){const target=sourceURL(u.searchParams.get('url'));const h=await source(target.href);const story=text((h.match(/class=["']extra-content["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)||h.match(/class=["']singleStory["'][^>]*>([\s\S]*?)<\/div>/i)||[])[1]);const episodes=[];const seen=new Set();for(const m of h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){const url=attr(m[1],'href'),title=attr(m[1],'title')||text(m[2]);if(!url.startsWith(ORIGIN+'/episode/')||!title||seen.has(url))continue;seen.add(url);episodes.push({url,title})}return json({story,episodes:episodes.slice(0,100)})}
if(u.pathname==='/api/play'){const target=sourceURL(u.searchParams.get('url'));const h=await source(target.href,true);const servers=[];for(const m of h.matchAll(/<li\b([^>]*\bdata-link\s*=\s*["'][^"']+["'][^>]*)>([\s\S]*?)<\/li>/gi)){const url=attr(m[1],'data-link');if(publicHTTPS(url)&&!servers.some(s=>s.url===url))servers.push({url,name:text(m[2])})}const raw=(h.match(/<(?:source|video)\b[^>]*src=["']([^"']+\.mp4(?:\?[^"']*)?)["']/i)||[])[1];if(!raw&&servers.length){try{const resolved=await resolveProvider(servers[0]);if(resolved)return json(resolved)}catch{}}return json({servers:servers.slice(0,8),media:publicHTTPS(raw)?decode(raw):null})}
if(u.pathname!=='/')return new Response('Not found',{status:404});return new Response(PAGE,{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.streamruby.net; media-src https: blob:; worker-src 'self' blob:; frame-src https:; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'self'"}})
}catch(e){return json({error:'The source is unavailable. Please try again later.'},502)}}};
