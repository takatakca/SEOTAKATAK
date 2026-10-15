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
