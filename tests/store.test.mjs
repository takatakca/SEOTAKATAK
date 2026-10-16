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
 assert.equal(seen.length,4);
 for(const url of seen)assert.equal(url.searchParams.get('limit'),'0');
 const sites=seen.find(url=>url.pathname.endsWith('/seo_sites'));
 assert.ok(sites);
 assert.match(sites.searchParams.get('select'),/verification_token,verification_issued_at,verified_at/);
});
test('readiness fails when database does not have DNS verification migration columns',async()=>{
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async url=>new Response('unknown column',{status:new URL(url).pathname.endsWith('seo_sites')?400:200})
 });
 await assert.rejects(()=>store.schemaReady(),error=>error instanceof DatabaseError&&error.status===400);
});

test('site deletion is a tenant-filtered PostgREST DELETE, not a global domain deletion',async()=>{
 const requests=[];
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async(url,options)=>{
   requests.push({url:new URL(url),options});
   return new Response(JSON.stringify([{id:SITE}]),{status:200});
  }});
 await store.deleteSite(A,SITE);
 assert.equal(requests.length,1);
 assert.equal(requests[0].options.method,'DELETE');
 assert.equal(requests[0].url.searchParams.get('tenant_id'),'eq.'+A);
 assert.equal(requests[0].url.searchParams.get('id'),'eq.'+SITE);
 assert.equal(requests[0].options.headers.Prefer,'return=representation');
});

test('readiness coalesces concurrent public probes and caches successful results',async()=>{
 let calls=0;
 const store=createStore({baseUrl:'https://example.supabase.co',serviceKey:'server-only-test',
  fetchImpl:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));
   return new Response('[]',{status:200});}});
 const outcomes=await Promise.all(Array.from({length:40},()=>store.schemaReady()));
 assert.ok(outcomes.every(v=>v===true));
 assert.equal(calls,4);
 assert.equal(await store.schemaReady(),true);
 assert.equal(calls,4);
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
