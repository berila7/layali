const localMediaSecret=crypto.randomUUID();
const signingKeys=new Map();
async function mediaKey(secret){if(!signingKeys.has(secret))signingKeys.set(secret,crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']));return signingKeys.get(secret)}
function publicMediaURL(raw){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':')||/\.(local|internal|localhost)$/.test(u.hostname))throw Error('Invalid media URL');return u}
export async function signedMediaURL(raw,secret,expires=Math.floor(Date.now()/1000)+21600,tokens=new Map()){
 const target=publicMediaURL(raw),scope=target.origin+'|'+expires;
 if(!tokens.has(scope))tokens.set(scope,(async()=>{const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',await mediaKey(secret),new TextEncoder().encode('media-origin-v1|'+scope)));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')})());
 return '/api/media?url='+encodeURIComponent(target.href)+'&expires='+expires+'&signature='+await tokens.get(scope);
}
export async function authorizedMediaURL(params,secret){
 const target=publicMediaURL(params.get('url')),expires=Number(params.get('expires')),signature=params.get('signature')||'';
 if(!Number.isInteger(expires)||expires<Date.now()/1000||expires>Date.now()/1000+28800||!/^[a-f0-9]{64}$/.test(signature))return null;
 const bytes=Uint8Array.from(signature.match(/../g),n=>parseInt(n,16));
 const valid=await crypto.subtle.verify('HMAC',await mediaKey(secret),bytes,new TextEncoder().encode('media-origin-v1|'+target.origin+'|'+expires));
 return valid?target:null;
}

