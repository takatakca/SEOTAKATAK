import http from 'node:http';
import { createStore } from './store.mjs';
import { dispatch } from './app.mjs';
const key=process.env.SEOTAKATAK_SIGNING_KEY;
let store=null;
try{store=createStore({baseUrl:process.env.SEO_SUPABASE_URL,serviceKey:process.env.SEO_SUPABASE_SERVICE_ROLE_KEY});}catch{}
if(process.env.NODE_ENV==='production'&&(!store||!key||key.length<32)){console.error('SEOTAKATAK production configuration missing');process.exit(1);}
const port=Number(process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
 const url=new URL(req.url||'/', 'http://localhost:'+port);
 if(req.method==='OPTIONS'){res.writeHead(405).end(JSON.stringify({ok:false,error:'method_not_allowed'}));return;}
 let body;
 if(req.method==='POST'||req.method==='PATCH'){
  if(!(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415).end(JSON.stringify({ok:false,error:'json_required'}));return;}
  try{
   let raw='';
   for await(const part of req){raw+=part;if(raw.length>65536){res.writeHead(413).end(JSON.stringify({ok:false,error:'payload_too_large'}));return;}}
   body=JSON.parse(raw);
  }catch{res.writeHead(400).end(JSON.stringify({ok:false,error:'invalid_json'}));return;}
 }
 const {code,result}=await dispatch({method:req.method,path:url.pathname,authorization:req.headers.authorization,body},{store,signingKey:key});
 res.writeHead(code).end(JSON.stringify(result));
});
server.requestTimeout=12000;server.headersTimeout=10000;
server.listen(port,'0.0.0.0',()=>console.log('SEOTAKATAK listening on '+port));
