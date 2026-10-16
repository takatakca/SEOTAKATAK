import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,DatabaseError} from '../src/store.mjs';

const A='7d87a2c9-fb84-474a-8ccc-43d6fe47605c';
const SITE='7d87a2c9-fb84-474a-8ccc-43d6fe47605e';

test('PostgREST reads and updates always filter by authenticated tenant and site',async()=>{
 const calls=[];
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'test-key',
  fetchImpl:async (url,init)=>{
   calls.push({url:new URL(url),init});
   return new Response(JSON.stringify([{id:SITE}]),{status:200,headers:{'content-type':'application/json'}});
  }});
 await store.ownedSite(A,SITE);
 await store.updateProspect(A,SITE,SITE,{status:'contacted'});
 await store.importOpportunities(A,SITE,[{keyword:'seo',clicks:1,impressions:10,position:4,priority:60,source:'search_console'}]);
 for(const call of calls.slice(0,2)){
  assert.equal(call.url.searchParams.get('tenant_id'),'eq.'+A);
  assert.equal(call.url.searchParams.get('site_id'),call.url.pathname.endsWith('seo_sites')?null:'eq.'+SITE);
  assert.equal(call.init.headers.apikey,'test-key');
  assert.equal(call.init.headers.Authorization,'Bearer test-key');
  assert.equal(call.init.redirect,'error');
 }
 assert.equal(calls[1].url.searchParams.get('id'),'eq.'+SITE);
 assert.equal(calls[2].url.searchParams.get('on_conflict'),'tenant_id,site_id,keyword,source');
 const importBody=JSON.parse(calls[2].init.body);
 assert.equal(importBody[0].tenant_id,A);
 assert.equal(importBody[0].site_id,SITE);
});
test('PostgREST errors do not expose service credentials',async()=>{
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'VERY_PRIVATE',
  fetchImpl:async()=>new Response('secret',{status:403})});
 await assert.rejects(()=>store.listSites(A),error=>error instanceof DatabaseError&&error.status===403&&!error.message.includes('PRIVATE'));
});

test('readiness validates every table and DNS verification column without reading client data',async()=>{
 const seen=[];
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async url=>{
   const parsed=new URL(url);
   seen.push(parsed);
   return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
  }
 });
 assert.equal(await store.schemaReady(),true);
 assert.equal(seen.length,5);
 for(const url of seen)assert.equal(url.searchParams.get('limit'),'0');
 const sites=seen.find(url=>url.pathname.endsWith('/seo_sites'));
 assert.ok(sites);
 assert.match(sites.searchParams.get('select'),/verification_token,verification_issued_at,verified_at/);
 const briefs=seen.find(url=>url.pathname.endsWith('/seo_briefs'));
 assert.ok(briefs);
 assert.match(briefs.searchParams.get('select'),/reviewed_at,reviewed_by,review_note/);
 const deletionTable=seen.find(url=>url.pathname.endsWith('/seo_site_deletion_receipts'));
 assert.ok(deletionTable);
 assert.match(deletionTable.searchParams.get('select'),/opportunities_removed,prospects_removed,briefs_removed/);
});
test('readiness fails when database does not have DNS verification migration columns',async()=>{
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async url=>new Response('unknown column',{status:new URL(url).pathname.endsWith('seo_sites')?400:200})
 });
 await assert.rejects(()=>store.schemaReady(),error=>error instanceof DatabaseError&&error.status===400);
});

test('site deletion uses one atomic service-role RPC with authenticated tenant and actor',async()=>{
 const requests=[];
 const adapter=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async(url,options)=>{
   requests.push({url:new URL(url),options});
   return new Response(JSON.stringify([{receipt_id:SITE,opportunities_removed:2}]),{status:200});
  }});
 const receipts=await adapter.deleteSite(A,SITE,'takatak.ca','user');
 assert.equal(receipts[0].opportunities_removed,2);
 assert.equal(requests.length,1);
 assert.equal(requests[0].options.method,'POST');
 assert.equal(requests[0].url.pathname,'/rest/v1/rpc/seo_delete_site_with_receipt');
 assert.equal(requests[0].options.headers.Prefer,'return=representation');
 assert.deepEqual(JSON.parse(requests[0].options.body),{
  p_tenant_id:A,p_site_id:SITE,p_expected_domain:'takatak.ca',p_actor_subject:'user'
 });
});

test('deletion receipt listing is tenant-filtered, column-restricted and paginated',async()=>{
 const requests=[];
 const adapter=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async(url,options)=>{
   requests.push({url:new URL(url),options});
   return new Response(JSON.stringify([{id:SITE}]),{status:200});
  }});
 const results=await adapter.listDeletionReceipts(A,100);
 assert.equal(results.items.length,1);
 assert.equal(results.hasMore,false);
 const q=requests[0].url.searchParams;
 assert.equal(requests[0].url.pathname,'/rest/v1/seo_site_deletion_receipts');
 assert.equal(q.get('tenant_id'),'eq.'+A);
 assert.equal(q.get('offset'),'100');
 assert.equal(q.get('limit'),'101');
 assert.equal(q.get('order'),'deleted_at.desc,id.desc');
 assert.equal(q.get('select').includes('actor_subject'),false);
 await assert.rejects(()=>adapter.listDeletionReceipts(A,-1),e=>e instanceof DatabaseError&&e.status===400);
});

test('readiness coalesces concurrent public probes and caches successful results',async()=>{
 let calls=0;
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));
   return new Response('[]',{status:200});}});
 const outcomes=await Promise.all(Array.from({length:40},()=>store.schemaReady()));
 assert.ok(outcomes.every(v=>v===true));
 assert.equal(calls,5);
 assert.equal(await store.schemaReady(),true);
 assert.equal(calls,5);
});
test('failed readiness probes are negatively cached to avoid database-amplification attacks',async()=>{
 let calls=0;
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async()=>{calls++;return new Response('migration missing',{status:400});}});
 await assert.rejects(()=>store.schemaReady(),error=>error instanceof DatabaseError&&error.status===400);
 const count=calls;
 await assert.rejects(()=>store.schemaReady(),error=>error instanceof DatabaseError&&error.status===503);
 assert.equal(calls,count);
});

test('editorial review is an atomic, tenant-scoped draft-to-decision update',async()=>{
 const calls=[];
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async(url,init)=>{calls.push({url:new URL(url),init});
   return new Response(JSON.stringify([{id:SITE}]),{status:200});}});
 await store.reviewBrief(A,SITE,SITE,{status:'approved',reviewed_by:'reviewer',reviewed_at:new Date().toISOString(),review_note:null});
 const {url,init}=calls[0];
 assert.equal(init.method,'PATCH');
 assert.ok(url.pathname.endsWith('/seo_briefs'));
 assert.equal(url.searchParams.get('tenant_id'),'eq.'+A);
 assert.equal(url.searchParams.get('site_id'),'eq.'+SITE);
 assert.equal(url.searchParams.get('id'),'eq.'+SITE);
 assert.equal(url.searchParams.get('status'),'eq.draft');
 assert.equal(JSON.parse(init.body).status,'approved');
});

test('workspace export applies tenant filter, stable offset and strict safe database column lists',async()=>{
 const calls=[];
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async(url,init)=>{calls.push({url:new URL(url),init});
   return new Response(JSON.stringify([{id:SITE,keyword:'seo'}]),{status:200});}});
 for(const collection of ['sites','opportunities','prospects','briefs']){
  const result=await store.exportWorkspacePage(A,collection,200,200);
  assert.equal(result.items.length,1);
  assert.equal(result.hasMore,false);
 }
 assert.equal(calls.length,4);
 const tables=['seo_sites','seo_opportunities','seo_prospects','seo_briefs'];
 for(let i=0;i<calls.length;i++){
  const {url,init}=calls[i];
  assert.ok(url.pathname.endsWith('/'+tables[i]));
  assert.equal(url.searchParams.get('tenant_id'),'eq.'+A);
  assert.equal(url.searchParams.get('order'),'id.asc');
  assert.equal(url.searchParams.get('limit'),'201');
  assert.equal(url.searchParams.get('offset'),'200');
  const select=url.searchParams.get('select');
  assert.ok(select);
  for(const secret of ['verification_token','verification_issued_at','reviewed_by']){
   assert.equal(select.includes(secret),false,secret+' should not be selected');
  }
  assert.equal(init.redirect,'error');
 }
 await assert.rejects(()=>store.exportWorkspacePage(A,'outside',0,200),error=>error instanceof DatabaseError);
});

test('PostgREST caps untrusted response bytes during streaming, not after reading',async()=>{
 let reads=0,cancelled=false;
 const max=1_048_576;
 const stream=new ReadableStream({
  pull(controller){
   reads++;
   controller.enqueue(new Uint8Array(32768));
  },
  cancel(){cancelled=true;}
 });
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async()=>new Response(stream,{status:200,headers:{'content-type':'application/json'}})});
 await assert.rejects(()=>store.listSites(A),e=>e instanceof DatabaseError&&e.status===502);
 assert.ok(reads<=35,'Streaming limit must stop after just over one MiB');
 assert.equal(cancelled,true,'The upstream oversized stream is cancelled');
 assert.equal(max,1048576);
});

test('PostgREST rejects compressed/Unicode-sized payloads by actual transfer bytes',async()=>{
 // ASCII/UTF-16 string lengths can be smaller than the UTF-8 transport size.
 const body=JSON.stringify([{title:'🔥'.repeat(300000)}]);
 assert.ok(body.length<1_048_576);
 assert.ok(Buffer.byteLength(body,'utf8')>1_048_576);
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async()=>new Response(body,{status:200})});
 await assert.rejects(()=>store.listSites(A),e=>e instanceof DatabaseError&&e.status===502);
});

test('PostgREST accepts a normal bounded JSON response',async()=>{
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async()=>new Response(JSON.stringify([{id:SITE,domain:'example.ca'}]),{status:200})});
 const rows=await store.listSites(A);
 assert.equal(rows.length,1);
 assert.equal(rows[0].domain,'example.ca');
});

test('normal site and evidence lists select only public data columns at the database boundary',async()=>{
 const seen=[];
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async url=>{
   seen.push(new URL(url));
   return new Response('[]',{status:200});
  }});
 await store.listSites(A);
 await store.listOpportunities(A,SITE);
 await store.listProspects(A,SITE);
 await store.listBriefs(A,SITE);
 assert.equal(seen.length,4);
 for(const call of seen){
  assert.equal(call.searchParams.get('tenant_id'),'eq.'+A);
  const selected=call.searchParams.get('select');
  assert.ok(selected&&selected!=='*');
  for(const secret of ['verification_token','verification_issued_at','tenant_id',
   'reviewed_by','actor_subject','domain_sha256']){
   assert.equal(selected.split(',').includes(secret),false,
    'Normal list must not request '+secret);
  }
 }
});
