import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

async function freePort(){
 const server=createServer();
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
async function start(){
 const port=await freePort();
 const child=spawn(process.execPath,['src/server.mjs'],{
  cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',PORT:String(port),SEOTAKATAK_SIGNING_KEY:'a'.repeat(64),
    SEO_SUPABASE_URL:'',SEO_SUPABASE_SERVICE_ROLE_KEY:''},
  stdio:['ignore','pipe','pipe']
 });
 let output='';
 child.stdout.on('data',chunk=>{output+=chunk.toString();});
 child.stderr.on('data',chunk=>{output+=chunk.toString();});
 const root='http://127.0.0.1:'+port;
 for(let attempt=0;attempt<60;attempt++){
  if(child.exitCode!==null)throw new Error('SEO service exited: '+output);
  try{
   const response=await fetch(root+'/health',{signal:AbortSignal.timeout(500)});
   if(response.ok)return {root,child};
  }catch{}
  await delay(50);
 }
 child.kill();
 throw new Error('SEO service did not start: '+output);
}
async function request(root,path,options){
 const response=await fetch(root+path,{...options,signal:AbortSignal.timeout(4000)});
 return {status:response.status,headers:response.headers,body:await response.json()};
}
test('real HTTP server rejects bad, multibyte and oversized JSON without leaking internals',async()=>{
 const {root,child}=await start();
 try{
  const alive=await request(root,'/health');
  assert.equal(alive.status,200);
  assert.equal(alive.body.service,'seotakatak');
  assert.equal(alive.headers.get('cache-control'),'no-store');
  assert.equal(alive.headers.get('x-content-type-options'),'nosniff');

  const noAuth=await request(root,'/v1/sites');
  assert.equal(noAuth.status,401);
  const invalid=await request(root,'/v1/sites',{method:'POST',headers:{'content-type':'application/json'},body:'{"oops"'});
  assert.equal(invalid.status,400);
  const unsupported=await request(root,'/v1/sites',{method:'POST',headers:{'content-type':'text/plain'},body:'hi'});
  assert.equal(unsupported.status,415);

  // The destructive endpoint must parse JSON and still enforce a signed manager.
  const deletionDenied=await request(root,'/v1/sites/7d87a2c9-fb84-474a-8ccc-43d6fe47605e',{
   method:'DELETE',headers:{'content-type':'application/json'},
   body:JSON.stringify({confirmDelete:true,confirmDomain:'takatak.ca'})
  });
  assert.equal(deletionDenied.status,401);

  const oversized=await request(root,'/v1/sites',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({long:'a'.repeat(65536)})});
  assert.equal(oversized.status,413);
  assert.equal(oversized.body.error,'payload_too_large');

  const multibyte=await request(root,'/v1/sites',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({long:'🔥'.repeat(18000)})});
  assert.equal(multibyte.status,413);
  assert.equal(multibyte.body.error,'payload_too_large');

  const healthyAfter=await request(root,'/health');
  assert.equal(healthyAfter.status,200);
 }finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(1000)]);
 }
});
