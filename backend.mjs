const MOVY='https://www.movy.sx', STREAM='https://api.wecollege.net', DB='https://db.wecollege.net/3';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private,max-age=60','x-content-type-options':'nosniff'}});
async function upstream(url,options={}) {
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 try{const r=await fetch(url,{signal:controller.signal,redirect:'manual',...options});if(!r.ok)throw Error('Upstream unavailable: '+r.status+' at '+new URL(url).hostname+new URL(url).pathname.slice(0,70));return r}finally{clearTimeout(timer)}
}
const pageCache=new Map();
async function pageData(path){const cached=pageCache.get(path);if(cached&&cached.expires>Date.now())return cached.data;const html=await(await upstream(MOVY+path)).text();const m=html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);if(!m)throw Error('Catalog markup unavailable');const data=JSON.parse(m[1]).props.pageProps;if(pageCache.size>100)pageCache.clear();pageCache.set(path,{data,expires:Date.now()+90000});return data}

function titlePath(raw){if(!/^\/(movie|tv)\/\d+$/.test(raw||''))throw Error('Invalid title');return raw}
function mediaURL(raw){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||!['zenoak.top','paleoak.top','greenkite.top','limedisk.top'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('Unsupported media host');return u}
const sourceCache=new Map();
async function movieSources(path,season,episode,secret){const key=path+':'+season+':'+episode;const cached=sourceCache.get(key);if(cached&&cached.expires>Date.now())return cached.data;const {details:d}=await pageData(path);const seed=await(await upstream(STREAM+'/seed?mediaId='+d.tmdbId)).json();const params=new URLSearchParams({title:encodeURIComponent(d.titleEnglish||d.title),mediaType:d.mediaType,year:String(d.year||''),totalSeasons:String(d.seasons?.length||0),tmdbId:String(d.tmdbId),imdbId:d.imdbId||'',enc:'2',seed:seed.seed});if(d.mediaType==='tv'){params.set('seasonId',season);params.set('episodeId',episode)}let stream;for(const provider of ['miami','boise','seattle']){try{const encrypted=await(await upstream(STREAM+'/'+provider+'/sources?'+params)).text();const result=JSON.parse(decodeMovyPayload(encrypted,seed.seed,d.tmdbId));if(result.sources?.length){stream=result;break}}catch{}}
if(!stream)throw Error('No playable video source');const sources=(await Promise.all(stream.sources.filter(s=>{try{mediaURL(s.url);return true}catch{return false}}).map(async s=>({label:s.quality,height:parseInt(s.quality)||0,url:await signedMediaURL(s.url,secret),format:'hls'})))).sort((a,b)=>b.height-a.height);if(!sources.length)throw Error('No supported video source');let subtitles=[];try{const q=new URLSearchParams({id:d.tmdbId});if(d.mediaType==='tv'){q.set('season',season);q.set('episode',episode)}const tracks=await(await upstream('https://subtitles.vidy.st/search?'+q)).json();subtitles=tracks.filter(s=>s.url?.startsWith('https://subtitles.vidy.st/download?')).sort((a,b)=>(b.language==='ar')-(a.language==='ar')||Number(b.isTrusted)-Number(a.isTrusted)||Number(b.downloadCount||0)-Number(a.downloadCount||0)).slice(0,60).map(s=>({language:s.language,label:s.display,release:s.release||'',url:'/api/subtitle?url='+encodeURIComponent(s.url)}))}catch{}
const data={sources,subtitles,title:d.title};if(sourceCache.size>60)sourceCache.clear();sourceCache.set(key,{data,expires:Date.now()+180000});return data}
function srtToVtt(s){return s.replace(/^\uFEFF/,'').startsWith('WEBVTT')?s:'WEBVTT\n\n'+s.replace(/^\uFEFF/,'').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2')}
export default {async fetch(request,env={}){const u=new URL(request.url);try{const secret=env.MEDIA_PROXY_SECRET||(['localhost','127.0.0.1','local'].includes(u.hostname)?(localMediaSecret??=crypto.randomUUID()):null);
if(u.pathname==='/assets/hls.min.js')return new Response(HLS_LIBRARY,{headers:{'content-type':'text/javascript','cache-control':'public,max-age=86400'}});
if(u.pathname==='/api/home'){const d=await pageData('/');delete d.messages;return json(d)}
if(u.pathname==='/api/search'){const q=(u.searchParams.get('q')||'').slice(0,100),type=u.searchParams.get('type');const path=q?'/search/multi':'/discover/'+(type==='tv'?'tv':'movie');const params=new URLSearchParams({query:q,page:String(Math.max(1,parseInt(u.searchParams.get('page'))||1)),language:'en',sort_by:'popularity.desc'});if(type==='anime')params.set('with_genres','16');if(/^\d+$/.test(u.searchParams.get('genre')||''))params.set('with_genres',u.searchParams.get('genre'));return json(await(await upstream(DB+path+'?'+params)).json())}
if(u.pathname==='/api/detail')return json((await pageData(titlePath(u.searchParams.get('path')))).details);
if(u.pathname==='/api/season'){const path=titlePath(u.searchParams.get('path'));if(!path.startsWith('/tv/'))throw Error('Not a show');const season=Math.max(1,parseInt(u.searchParams.get('season'))||1);return json(await(await upstream(DB+path+'/season/'+season+'?language=en')).json())}
if(u.pathname==='/api/play'){if(!secret)throw Error('Media signing is not configured');return json(await movieSources(titlePath(u.searchParams.get('path')),String(Math.max(1,parseInt(u.searchParams.get('season'))||1)),String(Math.max(1,parseInt(u.searchParams.get('episode'))||1)),secret));}
if(u.pathname==='/api/subtitle'){const src=new URL(u.searchParams.get('url'));if(src.origin!=='https://subtitles.vidy.st'||src.pathname!=='/download')throw Error('Invalid subtitle');const s=await(await upstream(src)).text();return new Response(srtToVtt(s),{headers:{'content-type':'text/vtt; charset=utf-8','cache-control':'private,max-age=3600'}})}
if(u.pathname==='/api/media'){
 if(!secret)throw Error('Media signing is not configured');
 const target=await authorizedMediaURL(u.searchParams,secret);
 if(!target)return json({error:'Video link expired or is invalid. Retry playback to refresh it.'},403);
 const headers={Referer:MOVY+'/',Origin:MOVY};if(request.headers.get('range'))headers.Range=request.headers.get('range');
 const r=await upstream(target,{headers});const type=r.headers.get('content-type')||'application/octet-stream';
 if(target.pathname.endsWith('.m3u8')||type.includes('mpegurl')){
  const content=await r.text(),tokens=new Map(),expires=Number(u.searchParams.get('expires'));
  const rewrite=raw=>signedMediaURL(new URL(raw,target).href,secret,expires,tokens);
  const manifest=(await Promise.all(content.split('\n').map(async line=>{
   if(!line.trim())return line;
   if(!line.startsWith('#'))return rewrite(line.trim());
   const refs=[...line.matchAll(/URI="([^"]+)"/g)];
   for(const match of refs)line=line.replace(match[0],'URI="'+await rewrite(match[1])+'"');
   return line;
  }))).join('\n');
  return new Response(manifest,{headers:{'content-type':'application/vnd.apple.mpegurl','cache-control':'private,max-age=30'}});
 }
 const out={'content-type':type,'cache-control':'private,max-age=1800','accept-ranges':'bytes'};
 for(const key of ['content-range','content-length'])if(r.headers.get(key))out[key]=r.headers.get(key);
 return new Response(r.body,{status:r.status,headers:out});
}
if(u.pathname!=='/')return new Response('Not found',{status:404});return new Response(PAGE,{headers:{'content-type':'text/html; charset=utf-8','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https://wsrv.nl https://image.tmdb.org data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'"}})
}catch(error){console.error('Request failed',u.pathname,error.name,String(error.message).replace(/https?:\/\/\S+/g,'[upstream]'));return json({error:'The source is currently unavailable. Please retry or choose another title.'},502)}}};
