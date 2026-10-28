import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchantReader,MerchantApiError,validMerchantAccountId} from '../src/merchant.mjs';
import {issueToken,verifyBearer} from '../src/auth.mjs';
import {dispatch} from '../src/app.mjs';

const A='7d87a2c9-fb84-474a-8ccc-43d6fe47605c';
const B='8d87a2c9-fb84-474a-8ccc-43d6fe47605d';
const SITE='7d87a2c9-fb84-474a-8ccc-43d6fe47605e';
const key='a'.repeat(64);
const OAuth='test-only-access-token-with-30-characters';
const merchantId='1234567890123';
const signed=(tenantId=A,permissions=['seo:import'],merchantAccountId=merchantId)=>
 'Bearer '+issueToken({tenantId,subject:'merchant-v1-test',permissions,
  ...(merchantAccountId?{merchantAccountId}:{})},key);

function mockProvider(){
 const requests=[];
 const reader=createMerchantReader({fetchImpl:async(url,init)=>{
  const u=new URL(url);
  requests.push({u,init});
  assert.equal(u.protocol,'https:');
  assert.equal(u.hostname,'merchantapi.googleapis.com');
  assert.equal(init.method,'GET');
  assert.equal(init.redirect,'error');
  assert.equal(init.headers.Authorization,'Bearer '+OAuth);
  if(u.pathname==='/accounts/v1/accounts/'+merchantId)
   return new Response(JSON.stringify({name:'accounts/'+merchantId,
    accountName:'Synthetic test Merchant account',testAccount:false,
    privateCredential:'never-expose'}),{status:200});
  if(u.pathname==='/products/v1/accounts/'+merchantId+'/products')
   return new Response(JSON.stringify({products:[{
    name:'accounts/'+merchantId+'/products/en~CA~sku1',
    offerId:'sku1',secretField:'private',
    productAttributes:{title:'Example item',imageLink:'https://image.example/product.jpg',
     hiddenOfferPrice:'do-not-export'},
    productStatus:{
     destinationStatuses:[{reportingContext:'FREE_LISTINGS',
      approvedCountries:['CA'],pendingCountries:[],disapprovedCountries:[]}],
     itemLevelIssues:[{code:'missing_gtin',severity:'WARNING',attribute:'gtin',
      description:'GTIN is missing',applicableCountries:['CA'],detail:'private full diagnostics'}]
    }
   }],nextPageToken:'nextPageABC'}),{status:200});
  throw new Error('Unexpected provider URL');
 }});
 return {reader,requests};
}
test('Merchant client uses current fixed Google Merchant API v1 origins and sanitized product statuses',async()=>{
 const {reader,requests}=mockProvider();
 const result=await reader.inspect({accountId:merchantId,accessToken:OAuth,pageSize:25});
 assert.equal(result.source,'google_merchant_api_v1');
 assert.equal(result.account.name,'accounts/'+merchantId);
 assert.equal(result.account.accountName,'Synthetic test Merchant account');
 assert.equal(result.products[0].offerId,'sku1');
 assert.equal(result.products[0].productStatusAvailable,true);
 assert.equal(result.products[0].destinationStatuses[0].approvedCountries[0],'CA');
 assert.equal(result.products[0].itemLevelIssues[0].code,'missing_gtin');
 assert.equal(result.nextPageToken,'nextPageABC');
 assert.equal(requests.length,2);
 assert.equal(requests[1].u.searchParams.get('pageSize'),'25');
 for(const secret of ['privateCredential','hiddenOfferPrice','secretField','detail','test-only-access-token']){
  assert.equal(JSON.stringify(result).includes(secret),false);
 }
 assert.equal(Object.hasOwn(result,'connected'),false);
});
test('Product missing provider status remains UNKNOWN, never invented as approved',async()=>{
 const reader=createMerchantReader({fetchImpl:async url=>{
  const pathname=new URL(url).pathname;
  return pathname.startsWith('/accounts/v1/')?
   new Response(JSON.stringify({name:'accounts/'+merchantId}),{status:200}):
   new Response(JSON.stringify({products:[{
    name:'accounts/'+merchantId+'/products/en~CA~sku2',
    offerId:'sku2',productAttributes:{title:'Needs review'}
   }]}),{status:200});
 }});
 const result=await reader.inspect({accountId:merchantId,accessToken:OAuth});
 assert.equal(result.products[0].productStatusAvailable,false);
 assert.deepEqual(result.products[0].destinationStatuses,[]);
 assert.deepEqual(result.products[0].itemLevelIssues,[]);
});
test('Merchant account and OAuth validation rejects untrusted path/secret input',async()=>{
 assert.equal(validMerchantAccountId('not-a-number'),false);
 assert.equal(validMerchantAccountId('../123'),false);
 assert.equal(validMerchantAccountId(12345),false);
 assert.equal(validMerchantAccountId(merchantId),true);
 const reader=createMerchantReader({fetchImpl:async()=>{throw Error('Provider must not be contacted')}});
 for(const args of [
  {accountId:'../merchant',accessToken:OAuth},
  {accountId:merchantId,accessToken:'short'},
  {accountId:merchantId,accessToken:OAuth+'\n'},
  {accountId:merchantId,accessToken:OAuth,pageToken:'..&evil=1'},
  {accountId:merchantId,accessToken:OAuth,pageSize:1000},
 ]){
  await assert.rejects(()=>reader.inspect(args),
   e=>e instanceof MerchantApiError&&e.kind==='invalid_request');
 }
});
test('Merchant provider errors redact upstream messages and never claim connected',async()=>{
 const denied=createMerchantReader({fetchImpl:async()=>
   new Response(JSON.stringify({error:{message:'account name and token should not leak'}}),{status:403})});
 await assert.rejects(()=>denied.inspect({accountId:merchantId,accessToken:OAuth}),
  e=>e instanceof MerchantApiError&&e.kind==='access_denied'&&
   !e.message.includes('token'));
 const mismatch=createMerchantReader({fetchImpl:async()=>
  new Response(JSON.stringify({name:'accounts/99999'}),{status:200})});
 await assert.rejects(()=>mismatch.inspect({accountId:merchantId,accessToken:OAuth}),
  e=>e instanceof MerchantApiError&&e.kind==='account_mismatch');
 let cancelled=false;
 const oversized=createMerchantReader({fetchImpl:async()=>new Response(new ReadableStream({
  pull(c){c.enqueue(new Uint8Array(32768));},
  cancel(){cancelled=true;}
 }),{status:200})});
 await assert.rejects(()=>oversized.inspect({accountId:merchantId,accessToken:OAuth}),
  e=>e instanceof MerchantApiError&&e.kind==='unavailable');
 assert.equal(cancelled,true);
});
test('Signed merchant account claim is optional and cannot be forged or used without seo:import',()=>{
 const bearer=signed();
 const verified=verifyBearer(bearer,key);
 assert.equal(verified.merchantAccountId,merchantId);
 assert.throws(()=>issueToken({tenantId:A,subject:'reader',
  permissions:['seo:view'],merchantAccountId:merchantId},key));
 assert.throws(()=>issueToken({tenantId:A,subject:'reader',
  permissions:['seo:import'],merchantAccountId:'../malicious'},key));
 assert.equal(verifyBearer(bearer,'another-secret-key-at-least-32-chars'),null);
 const regular=verifyBearer('Bearer '+issueToken({tenantId:A,subject:'reader',
  permissions:['seo:view']},key),key);
 assert.equal(regular.merchantAccountId,null);
});
test('Merchant inspection requires signed import scope, active tenant and verified SEO site',async()=>{
 const observed=[];
 const site={id:SITE,tenant_id:A,domain:'example.ca',verified_at:'2026-10-20T00:00:00Z'};
 const store={ownedSite:async(tenant,id)=>{
  return tenant===A&&id===SITE?site:null;
 }};
 const reader={inspect:async input=>{
  observed.push(input);
  return {source:'google_merchant_api_v1',account:{name:'accounts/'+merchantId},
   products:[],nextPageToken:null};
 }};
 const run=(authorization,extraBody={},sourceStore=store)=>
  dispatch({method:'POST',path:'/v1/sites/'+SITE+'/merchant/inspect',
   authorization,body:{oauthAccessToken:OAuth,...extraBody}},
   {store:sourceStore,signingKey:key,merchantReader:reader,
    rateGate:{take:()=>({allowed:true,retryAfter:0})}});
 assert.equal((await run(signed(B))).code,404);
 assert.equal((await run(signed(A,['seo:manage'],null))).code,403);
 assert.equal((await run(signed(A,['seo:import'],null))).code,403);
 assert.equal((await run(signed(A,['seo:import']),{oauthAccessToken:'short'})).code,400);
 const unchecked={ownedSite:async()=>({...site,verified_at:null})};
 assert.equal((await run(signed(),{},unchecked)).code,409);
 const result=await run(signed(),{merchantAccountId:'1234567',pageSize:10,pageToken:'marker'});
 assert.equal(result.code,200);
 assert.equal(result.result.merchant.account.name,'accounts/'+merchantId);
 assert.deepEqual(observed[0],{accountId:merchantId,accessToken:OAuth,
  pageSize:10,pageToken:'marker'});
 assert.equal(observed.length,1,'Rejected requests must never reach the Google provider');
 assert.equal(JSON.stringify(result.result).includes(OAuth),false);
});


test('Merchant diagnostics reads real Google v1 dataSources and account issues without leaking feed credentials',async()=>{
 const paths=[];
 const reader=createMerchantReader({fetchImpl:async(url,options)=>{
  const u=new URL(url);
  paths.push(u);
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  if(u.pathname==='/accounts/v1/accounts/'+merchantId)
   return new Response(JSON.stringify({name:'accounts/'+merchantId,accountName:'Existing MC account'}),{status:200});
  if(u.pathname==='/datasources/v1/accounts/'+merchantId+'/dataSources')
   return new Response(JSON.stringify({
    dataSources:[{name:'accounts/'+merchantId+'/dataSources/123',displayName:'Existing primary feed',
     input:'FILE',fileInput:{fileInputType:'FETCH',
      fetchSettings:{username:'secret-user',password:'secret-pass',
       fetchUri:'sftp://private.example/feeds/merchant.xml'}},
     primaryProductDataSource:{feedLabel:'CA',contentLanguage:'fr',countries:['CA']}}],
    nextPageToken:'sourceNext'
   }),{status:200});
  if(u.pathname==='/accounts/v1/accounts/'+merchantId+'/issues')
   return new Response(JSON.stringify({
    accountIssues:[{name:'accounts/'+merchantId+'/issues/shop',
     title:'Store needs verification',severity:'CRITICAL',detail:'private-account-information',
     impactedDestinations:[{reportingContext:'FREE_LISTINGS',impacts:[{regionCode:'CA',severity:'CRITICAL'}]}]}],
    nextPageToken:'issuesNext'
   }),{status:200});
  throw Error('Unexpected fixed Google path: '+u.pathname);
 }});
 const diagnostics=await reader.inspectSources({accountId:merchantId,accessToken:OAuth,
  sourcePageToken:'previousSource',issuePageToken:'previousIssue',pageSize:15});
 assert.equal(paths.length,3);
 assert.equal(paths[1].searchParams.get('pageSize'),'15');
 assert.equal(paths[1].searchParams.get('pageToken'),'previousSource');
 assert.equal(paths[2].searchParams.get('pageToken'),'previousIssue');
 assert.equal(diagnostics.dataSources.length,1);
 assert.equal(diagnostics.dataSources[0].primaryFeedLabel,'CA');
 assert.equal(diagnostics.accountIssues[0].severity,'CRITICAL');
 assert.equal(diagnostics.accountIssues[0].impactedDestinations[0].reportingContext,'FREE_LISTINGS');
 assert.equal(diagnostics.nextSourcePageToken,'sourceNext');
 assert.equal(diagnostics.nextIssuePageToken,'issuesNext');
 const visible=JSON.stringify(diagnostics);
 for(const privateValue of ['secret-user','secret-pass','sftp://','private-account-information',OAuth])
  assert.equal(visible.includes(privateValue),false,'Do not leak provider secrets');
 assert.equal(Object.hasOwn(diagnostics,'connected'),false);
});

test('Merchant diagnostics disallow cross-account data sources and arbitrary pagination',async()=>{
 const reader=createMerchantReader({fetchImpl:async url=>{
  const path=new URL(url).pathname;
  if(path.startsWith('/accounts/v1/accounts/')&&!path.includes('/issues'))
   return new Response(JSON.stringify({name:'accounts/'+merchantId}),{status:200});
  if(path.includes('/dataSources'))
   return new Response(JSON.stringify({dataSources:[{
    name:'accounts/999999/dataSources/456',displayName:'unrelated account'
   }]}),{status:200});
  return new Response(JSON.stringify({accountIssues:[]}),{status:200});
 }});
 await assert.rejects(()=>reader.inspectSources({accountId:merchantId,accessToken:OAuth}),
  e=>e instanceof MerchantApiError&&e.kind==='account_mismatch');
 await assert.rejects(()=>reader.inspectSources({
  accountId:merchantId,accessToken:OAuth,sourcePageToken:'bad&override=yes'
 }),e=>e instanceof MerchantApiError&&e.kind==='invalid_request');
});

test('Merchant diagnostics route requires verified site and account ID bound by V1, not client JSON',async()=>{
 const site={id:SITE,tenant_id:A,domain:'example.ca',verified_at:'2026-10-20T00:00:00Z'};
 const calls=[];
 const store={ownedSite:async(t,id)=>t===A&&id===SITE?site:null};
 const reader={
  inspectSources:async input=>{
   calls.push(input);
   return {source:'google_merchant_api_v1',account:{name:'accounts/'+merchantId},
    dataSources:[],accountIssues:[],nextSourcePageToken:null,nextIssuePageToken:null};
  }
 };
 const request=authorization=>dispatch({method:'POST',
  path:'/v1/sites/'+SITE+'/merchant/diagnostics',authorization,
  body:{oauthAccessToken:OAuth,merchantAccountId:'999999999',sourcePageToken:'sourceABC',issuePageToken:'issuesDEF'}},
  {store,signingKey:key,merchantReader:reader,
   rateGate:{take:()=>({allowed:true,retryAfter:0})}});
 assert.equal((await request(signed(B))).code,404);
 assert.equal((await request(signed(A,['seo:import'],null))).code,403);
 assert.equal((await request(signed(A,['seo:manage'],null))).code,403);
 const result=await request(signed());
 assert.equal(result.code,200);
 assert.equal(result.result.merchant.source,'google_merchant_api_v1');
 assert.equal(calls.length,1);
 assert.equal(calls[0].accountId,merchantId);
 assert.equal(calls[0].sourcePageToken,'sourceABC');
 assert.equal(calls[0].issuePageToken,'issuesDEF');
 assert.equal(JSON.stringify(result.result).includes(OAuth),false);
});
