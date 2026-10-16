import test from 'node:test';
import assert from 'node:assert/strict';
import {issueToken,verifyBearer} from '../src/auth.mjs';
import {dispatch,validateDomain,validateSearchConsoleRows,safeCsvCell,opportunityCsv} from '../src/app.mjs';
const key='a'.repeat(64);
const A='7d87a2c9-fb84-474a-8ccc-43d6fe47605c',B='8d87a2c9-fb84-474a-8ccc-43d6fe47605d',siteId='7d87a2c9-fb84-474a-8ccc-43d6fe47605e';
const site={id:siteId,tenant_id:A,domain:'takatak.ca'},records=[];
const store={
 async schemaReady(){return true;},
 async listSites(t){return t===A?[site]:[];},
 async ownedSite(t,id){return t===A&&id===siteId?site:null;},
 async deleteSite(t,id,domain,actor){
  return t===A&&id===siteId&&domain===site.domain&&actor==='user'?[{
   receipt_id:'7d87a2c9-fb84-474a-8ccc-43d6fe476060',
   deleted_at:'2026-10-16T00:00:00Z',opportunities_removed:2,
   prospects_removed:1,briefs_removed:1
  }]:[];
 },
 async listDeletionReceipts(t,offset){
  return {items:t===A?[{
   id:'7d87a2c9-fb84-474a-8ccc-43d6fe476060',
   site_id:siteId,deleted_at:'2026-10-16T00:00:00Z',
   opportunities_removed:2,prospects_removed:1,briefs_removed:1
  }]:[],hasMore:false};
 },
 async createSite(t,data){const row={...data,tenant_id:t};records.push(row);return [{...row,id:siteId}];},
 async listOpportunities(){return records.filter(row=>row.keyword);},
 async importOpportunities(t,id,rows){records.push(...rows);return rows;},
 async listProspects(){return [];},
 async createProspect(t,id,data){return [{...data,tenant_id:t,site_id:id}];},
 async updateProspect(){return [];},
 async listBriefs(){return [];},
 async createBrief(t,id,data){return [{...data,tenant_id:t,site_id:id}];},
 async reviewBrief(t,id,briefId,data){return t===A&&id===siteId?[{id:briefId,tenant_id:t,site_id:id,keyword:'SEO',angle:'Original useful discussion',...data}]:[];}
};
const jwt=(tenantId=A,permissions=['seo:manage'])=>'Bearer '+issueToken({tenantId,subject:'user',permissions,now:1000},key);
const req=(method,path,body,authorization=jwt())=>dispatch({method,path,body,authorization},{store,signingKey:key});
test('signed tokens expire, bind tenant and reject manipulation',()=>{
 assert.equal(verifyBearer(jwt(),key,1001).tenantId,A);
 assert.equal(verifyBearer(jwt(),key,1060),null);
 assert.equal(verifyBearer(jwt(),key+'b',1001),null);
 assert.equal(verifyBearer(jwt().slice(0,-1)+'x',key,1001),null);
 assert.equal(verifyBearer(jwt(),key,900),null);
});
test('public site hosts and Search Console rows validated',()=>{
 assert.equal(validateDomain('https://takatak.ca'),'takatak.ca');
 for(const input of ['localhost','http://takatak.ca','https://takatak.ca/private','https://user@takatak.ca','https://127.0.0.1'])assert.equal(validateDomain(input),null);
 assert.equal(validateSearchConsoleRows([{keyword:'SEO agency',clicks:2,impressions:100,position:7}])[0].priority>0,true);
 assert.equal(validateSearchConsoleRows([{keyword:'seo',clicks:3,impressions:2,position:7}]),null);
});
test('cross-workspace site read and write denied',async()=>{
 const now=Date.now;try{Date.now=()=>1001000;
  assert.equal((await req('GET','/v1/sites/'+siteId+'/opportunities',null,jwt(B))).code,404);
  assert.equal((await req('POST','/v1/sites/'+siteId+'/opportunities/import',{source:'search_console',rows:[{keyword:'seo',clicks:1,impressions:10,position:10}]},jwt(B,['seo:import']))).code,404);
 }finally{Date.now=now;}
});
test('read-only permission cannot write',async()=>{
 const now=Date.now;try{Date.now=()=>1001000;
 assert.equal((await req('POST','/v1/sites',{domain:'cubafood.ca',niche:'Food',market:'Canada'},jwt(A,['seo:view']))).code,403);
 }finally{Date.now=now;}
});
test('site creation uses the validated signed workspace',async()=>{
 const now=Date.now;try{Date.now=()=>1001000;
  const answer=await req('POST','/v1/sites',{domain:'https://cubafood.ca',niche:'Food',market:'Canada'});
  assert.equal(answer.code,201);
  assert.equal(records.at(-1).tenant_id,A);
 }finally{Date.now=now;}
});
test('only Search Console data is importable',async()=>{
 const now=Date.now;try{Date.now=()=>1001000;
 const path='/v1/sites/'+siteId+'/opportunities/import',row={keyword:'food Montreal',clicks:2,impressions:123,position:8};
 assert.equal((await req('POST',path,{source:'search_console',rows:[row]},jwt(A,['seo:manage']))).code,403);
 assert.equal((await req('POST',path,{source:'search_console',rows:[row]},jwt(A,['seo:import']))).result.imported,1);
 assert.equal((await req('POST',path,{source:'made_up',rows:[row]},jwt(A,['seo:import']))).code,400);
 }finally{Date.now=now;}
});
test('prospects start unearned; purchased status prohibited',async()=>{
 const now=Date.now;try{Date.now=()=>1001000;
 const path='/v1/sites/'+siteId+'/prospects';
 const result=await req('POST',path,{publication:'Relevant outlet',url:'https://example.org/story',relevance:'A relevant editorial opportunity'});
 assert.equal(result.result.prospect.status,'identified');
 assert.equal((await req('PATCH',path+'/'+siteId+'/status',{status:'purchased'})).code,400);
 assert.equal((await req('PATCH',path+'/'+siteId+'/status',{status:'earned'})).code,400);
 }finally{Date.now=now;}
});

test('readiness checks actual database connectivity',async()=>{
 const ready=await dispatch({method:'GET',path:'/ready'}, {store,signingKey:key});
 assert.equal(ready.code,200);
 const offline=await dispatch({method:'GET',path:'/ready'}, {store:{schemaReady:async()=>{throw new Error('missing verification columns')}},signingKey:key});
 assert.equal(offline.code,503);
});

test('ingestion tokens cannot alter prospects, register sites or read portfolio',async()=>{
 const saved=Date.now;try{Date.now=()=>1001000;
 const imported=jwt(A,['seo:import']);
 assert.equal((await req('GET','/v1/sites',null,imported)).code,403);
 assert.equal((await req('POST','/v1/sites',{domain:'another.ca',niche:'test',market:'CA'},imported)).code,403);
 assert.equal((await req('POST','/v1/sites/'+siteId+'/briefs',{keyword:'seo',angle:'A long content description'},imported)).code,403);
 }finally{Date.now=saved;}
});

test('CSV export prevents spreadsheet formula injection and protects tenant access',async()=>{
 assert.equal(safeCsvCell('=IMPORTXML("https://evil.test")'),String.raw`"'=IMPORTXML(""https://evil.test"")"`);
 assert.match(opportunityCsv([{keyword:'@SUM(1,2)',source:'search_console',clicks:1,impressions:10,position:2,priority:99,updated_at:'today'}]),/"'@SUM\(1,2\)"/);
 const save=Date.now;try{Date.now=()=>1001000;
  const endpoint='/v1/sites/'+siteId+'/opportunities.csv';
  const csv=await req('GET',endpoint,null,jwt(A,['seo:view']));
  assert.equal(csv.code,200);
  assert.match(csv.raw,/keyword,source,clicks/);
  assert.equal((await req('GET',endpoint,null,jwt(B,['seo:view']))).code,404);
  assert.equal((await req('GET',endpoint,null,jwt(A,['seo:import']))).code,403);
 }finally{Date.now=save;}
});
test('summary explicitly describes sampled evidence and refuses another tenant',async()=>{
 const save=Date.now;try{Date.now=()=>1001000;
  const endpoint='/v1/sites/'+siteId+'/summary';
  const own=await req('GET',endpoint,null,jwt(A,['seo:view']));
  assert.equal(own.code,200);
  assert.equal(own.result.summary.countsAreComplete,false);
  assert.equal(own.result.summary.earnedBacklinksVerified,0);
  assert.equal((await req('GET',endpoint,null,jwt(B,['seo:view']))).code,404);
 }finally{Date.now=save;}
});

test('site deletion requires independent manager consent, exact domain and tenant ownership',async()=>{
 const old=Date.now;try{Date.now=()=>1001000;
  const path='/v1/sites/'+siteId;
  assert.equal((await req('DELETE',path,{confirmDelete:true,confirmDomain:'takatak.ca'},jwt(A,['seo:view']))).code,403);
  assert.equal((await req('DELETE',path,{confirmDelete:true,confirmDomain:'takatak.ca'},jwt(B,['seo:manage']))).code,404);
  assert.equal((await req('DELETE',path,{confirmDelete:true,confirmDomain:'wrong.ca'})).code,400);
  assert.equal((await req('DELETE',path,{confirmDelete:false,confirmDomain:'takatak.ca'})).code,400);
  const deleted=await req('DELETE',path,{confirmDelete:true,confirmDomain:' TAKATAK.CA '});
  assert.equal(deleted.code,200);
  assert.equal(deleted.result.deleted,true);
  assert.equal(deleted.result.siteId,siteId);
  assert.equal(deleted.result.receipt.opportunitiesRemoved,2);
  assert.equal(deleted.result.receipt.id,'7d87a2c9-fb84-474a-8ccc-43d6fe476060');
 }finally{Date.now=old;}
});

test('editorial brief review requires manager, a draft, and a reason for rejection',async()=>{
 const old=Date.now;try{Date.now=()=>1001000;
  const path='/v1/sites/'+siteId+'/briefs/'+siteId+'/review';
  assert.equal((await req('PATCH',path,{status:'approved'},jwt(A,['seo:view']))).code,403);
  assert.equal((await req('PATCH',path,{status:'approved'},jwt(B,['seo:manage']))).code,404);
  assert.equal((await req('PATCH',path,{status:'published'})).code,400);
  assert.equal((await req('PATCH',path,{status:'rejected',note:'too short'})).code,400);
  const accepted=await req('PATCH',path,{status:'approved',note:'Reviewed for original research'});
  assert.equal(accepted.code,200);
  assert.equal(accepted.result.brief.status,'approved');
  assert.equal(accepted.result.brief.reviewed_by,undefined);
  // Persisted row status=approved must block any subsequent review action.
  const previousReview=store.reviewBrief;
  try{
   store.reviewBrief=async()=>[];
   assert.equal((await req('PATCH',path,{status:'rejected',note:'Insufficient original sources'})).code,409);
  }finally{store.reviewBrief=previousReview;}
 }finally{Date.now=old;}
});

test('read, create and review responses never expose future PostgREST private fields',async()=>{
 const original={listOpportunities:store.listOpportunities,listProspects:store.listProspects,
  listBriefs:store.listBriefs,createProspect:store.createProspect,updateProspect:store.updateProspect,
  createBrief:store.createBrief,reviewBrief:store.reviewBrief};
 const previousNow=Date.now;
 try{
  Date.now=()=>1001000;
  const row={id:siteId,site_id:siteId,tenant_id:A,
   keyword:'SEO keyword',source:'search_console',clicks:1,impressions:4,position:7,priority:55,
   publication:'Publisher',url:'https://publisher.example/seo',
   relevance:'A strong editorial match',status:'draft',angle:'Original primary source research',
   reviewed_by:'private-reviewer',secret_column:'do-not-expose',
   verification_token:'not-public'};
  for(const method of Object.keys(original))store[method]=async()=>[row];
  const base='/v1/sites/'+siteId;
  const replies=[
   await req('GET',base+'/opportunities'),
   await req('GET',base+'/prospects'),
   await req('GET',base+'/briefs'),
   await req('POST',base+'/prospects',{publication:'Publisher',url:'https://publisher.example/seo',
    relevance:'A strong editorial match'}),
   await req('PATCH',base+'/prospects/'+siteId+'/status',{status:'contacted'}),
   await req('POST',base+'/briefs',{keyword:'SEO keyword',angle:'Original primary source research'}),
   await req('PATCH',base+'/briefs/'+siteId+'/review',{status:'approved'})
  ];
  for(const response of replies){
   assert.ok([200,201].includes(response.code),JSON.stringify(response.result));
   const value=JSON.stringify(response.result);
   for(const sensitive of ['do-not-expose','private-reviewer','not-public','secret_column',
    'reviewed_by','verification_token','tenant_id'])
    assert.equal(value.includes(sensitive),false,sensitive+' should not appear');
  }
 }finally{Object.assign(store,original);Date.now=previousNow;}
});

test('normal site registry and detail redact tenant and future private schema columns',async()=>{
 const original=store.ownedSite,originalList=store.listSites,now=Date.now;
 try{
  Date.now=()=>1001000;
  const secretSite={...site,tenant_id:A,verification_token:'secret-abcdef',
   verification_issued_at:'secret-time',access_key:'sensitive-future-column'};
  store.ownedSite=async(t,id)=>t===A&&id===siteId?secretSite:null;
  store.listSites=async t=>t===A?[secretSite]:[];
  const detail=await req('GET','/v1/sites/'+siteId,null,jwt(A,['seo:view']));
  const list=await req('GET','/v1/sites',null,jwt(A,['seo:view']));
  assert.equal(detail.code,200);
  assert.equal(list.code,200);
  for(const item of [detail.result.site,list.result.sites[0]]){
   assert.equal(item.domain,site.domain);
   for(const secret of ['tenant_id','verification_token','verification_issued_at','access_key'])
    assert.equal(Object.hasOwn(item,secret),false);
  }
 }finally{store.ownedSite=original;store.listSites=originalList;Date.now=now;}
});

test('SEO site snapshot is tenant-scoped, bounded and redacts private operational tokens',async()=>{
 const originalOwned=store.ownedSite;
 const originalBriefs=store.listBriefs;
 const originalProspects=store.listProspects;
 const originalOpportunities=store.listOpportunities;
 const savedDate=Date.now;
 try{
  Date.now=()=>1001000;
  store.ownedSite=async(t,id)=>t===A&&id===siteId?{
    ...site,verification_token:'secret-txt-token',verification_issued_at:'2026-10-15T00:00:00Z',
    service_role_key:'internal-only',verified_at:null
  }:null;
  store.listBriefs=async()=>[{
    id:siteId,keyword:'local SEO',angle:'Original sourced research',status:'approved',
    reviewed_by:'private-user-profile',review_note:'Approved',private_key:'never-export'
  }];
  store.listProspects=async()=>[{id:siteId,publication:'Example',url:'https://example.org',
   relevance:'Relevant local editorial publication',status:'identified',internal_note:'secret'}];
  store.listOpportunities=async()=>[{id:siteId,keyword:'restaurant Montreal',source:'search_console',
    clicks:2,impressions:10,position:4,priority:70,provider_token:'secret'}];
  const path='/v1/sites/'+siteId+'/export';
  const own=await req('GET',path,null,jwt(A,['seo:view']));
  assert.equal(own.code,200);
  assert.equal(own.result.export.format,'seotakatak-site-snapshot');
  assert.equal(own.result.export.coverage.guaranteedComplete,false);
  assert.equal(own.result.export.briefs[0].status,'approved');
  const serialized=JSON.stringify(own.result);
  for(const secret of ['secret-txt-token','private-user-profile','never-export','provider_token',
   'internal_note','service_role_key'])assert.equal(serialized.includes(secret),false);
  assert.equal((await req('GET',path,null,jwt(B,['seo:view']))).code,404);
  assert.equal((await req('GET',path,null,jwt(A,['seo:import']))).code,403);
  store.listOpportunities=async()=>Array.from({length:200},(_,i)=>({keyword:'query '+i}));
  const limited=await req('GET',path,null,jwt(A,['seo:view']));
  assert.equal(limited.result.export.coverage.limitReached.opportunities,true);
 }finally{
  Date.now=savedDate;
  store.ownedSite=originalOwned;
  store.listBriefs=originalBriefs;
  store.listProspects=originalProspects;
  store.listOpportunities=originalOpportunities;
 }
});

test('deletion receipts are restricted to the managing workspace, without exposing actor identity',async()=>{
 const old=Date.now;
 try{
  Date.now=()=>1001000;
  const path='/v1/workspace/deletion-receipts';
  const reader=await dispatch({method:'GET',path,query:{offset:'0'},authorization:jwt(A,['seo:view'])},{store,signingKey:key});
  assert.equal(reader.code,403);
  const manager=await dispatch({method:'GET',path,query:{offset:'0'},authorization:jwt(A,['seo:manage'])},{store,signingKey:key});
  assert.equal(manager.code,200);
  assert.equal(manager.result.receipts.length,1);
  assert.equal(manager.result.receipts[0].opportunities_removed,2);
  assert.equal(JSON.stringify(manager.result).includes('actor_subject'),false);
  const other=await dispatch({method:'GET',path,query:{offset:'0'},authorization:jwt(B,['seo:manage'])},{store,signingKey:key});
  assert.equal(other.code,200);
  assert.deepEqual(other.result.receipts,[]);
  for(const invalid of ['-1','1.5','1000001','01']){
   const response=await dispatch({method:'GET',path,query:{offset:invalid},authorization:jwt(A,['seo:manage'])},{store,signingKey:key});
   assert.equal(response.code,400);
  }
 }finally{Date.now=old;}
});
