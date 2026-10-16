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
 async deleteSite(t,id){return t===A&&id===siteId?[site]:[];},
 async createSite(t,data){const row={...data,tenant_id:t};records.push(row);return [{...row,id:siteId}];},
 async listOpportunities(){return records.filter(row=>row.keyword);},
 async importOpportunities(t,id,rows){records.push(...rows);return rows;},
 async listProspects(){return [];},
 async createProspect(t,id,data){return [{...data,tenant_id:t,site_id:id}];},
 async updateProspect(){return [];},
 async listBriefs(){return [];},
 async createBrief(t,id,data){return [{...data,tenant_id:t,site_id:id}];}
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
 }finally{Date.now=old;}
});
