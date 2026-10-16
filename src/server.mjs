import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createStore } from './store.mjs';
import { dispatch } from './app.mjs';
const key=process.env.SEOTAKATAK_SIGNING_KEY;
let store=null;
try{store=createStore({baseUrl:process.env.SEO_SUPABASE_URL,serviceKey:process.env.SEO_SUPABASE_SERVICE_ROLE_KEY});}catch{}
if(process.env.NODE_ENV==='production'&&(!store||!key||key.length<32)){console.error('SEOTAKATAK production configuration missing');process.exit(1);}
const port=Number(process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
const server=http.createServer(async(req,res)=>{
 const started=Date.now(),requestId=randomUUID();
 res.setHeader('X-Request-ID',requestId);
 // Never log raw URLs, query strings, tokens, IPs, request bodies or customer identifiers.
 let routeGroup='api';
 res.on('finish',()=>console.info(JSON.stringify({
  event:'http_request',requestId,routeGroup,method:String(req.method||'').slice(0,12),
  status:res.statusCode,durationMs:Date.now()-started
 })));
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
 let url;
 try{url=new URL(req.url||'/', 'http://localhost:'+port);}
 catch{res.writeHead(400).end(JSON.stringify({ok:false,error:'invalid_path'}));return;}
 routeGroup=url.pathname==='/health'?'health':url.pathname==='/ready'?'ready':'api';
 if(req.method==='OPTIONS'){res.writeHead(405).end(JSON.stringify({ok:false,error:'method_not_allowed'}));return;}
 let body;
 // Reject oversized uploads while streaming bytes, not after UTF-8 decoding.
 // Stop parsing as soon as the 64 KiB transport limit is exceeded.
 if(req.method==='POST'||req.method==='PATCH'||req.method==='DELETE'){
  if(!(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415).end(JSON.stringify({ok:false,error:'json_required'}));return;}
  try{
   const chunks=[];let bytes=0,tooLarge=false;
   for await(const part of req){
    bytes+=part.byteLength;
    if(bytes>65536){tooLarge=true;break;}
    chunks.push(part);
   }
   if(tooLarge){res.writeHead(413).end(JSON.stringify({ok:false,error:'payload_too_large'}));return;}
   body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{res.writeHead(400).end(JSON.stringify({ok:false,error:'invalid_json'}));return;}
 }
 let response;
 try{
  response=await dispatch({method:req.method,path:url.pathname,query:Object.fromEntries(url.searchParams),authorization:req.headers.authorization,body},{store,signingKey:key});
 }catch{
  console.error(JSON.stringify({event:'unhandled_api_error',requestId}));
  if(!res.headersSent)res.writeHead(503).end(JSON.stringify({ok:false,error:'service_unavailable'}));
  else res.end();
  return;
 }
 if(response.headers)for(const [name,value] of Object.entries(response.headers))res.setHeader(name,value);
 if(typeof response.raw==='string'){
  res.setHeader('Content-Type',response.contentType);
  res.setHeader('Content-Disposition','attachment; filename="'+response.fileName+'"');
  res.writeHead(response.code).end(response.raw);
 }else{
  res.writeHead(response.code).end(JSON.stringify(response.result));
 }
});
server.requestTimeout=12000;server.headersTimeout=10000;
server.listen(port,'0.0.0.0',()=>console.log('SEOTAKATAK listening on '+port));
