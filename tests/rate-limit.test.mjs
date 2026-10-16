import test from 'node:test';
import assert from 'node:assert/strict';
import {RateGate} from '../src/rate-limit.mjs';
import {issueToken} from '../src/auth.mjs';
import {dispatch} from '../src/app.mjs';
const tenant='7d87a2c9-fb84-474a-8ccc-43d6fe47605c',key='B'.repeat(64);
test('rate gate resets after window and isolates keys',()=>{
 const rate=new RateGate(4);
 assert.equal(rate.take('a',2,60000,1000).allowed,true);
 assert.equal(rate.take('a',2,60000,1000).allowed,true);
 assert.equal(rate.take('a',2,60000,1000).allowed,false);
 assert.equal(rate.take('a',2,60000,1000).retryAfter,60);
 assert.equal(rate.take('b',2,60000,1000).allowed,true);
 assert.equal(rate.take('a',2,60000,61000).allowed,true);
});
test('rate gate has bounded stored keys',()=>{
 const rate=new RateGate(2);
 rate.take('first',1,60000,1000);rate.take('second',1,60000,1000);
 rate.take('third',1,60000,1000);
 assert.equal(rate.entries.size,2);
});
test('API returns HTTP 429 and Retry-After without contacting database',async()=>{
 const auth='Bearer '+issueToken({tenantId:tenant,subject:'tester'},key);
 const rateGate={take:()=>({allowed:false,retryAfter:17})};
 const store={listSites:async()=>{throw Error('database should not be reached')}};
 const denied=await dispatch({method:'GET',path:'/v1/sites',authorization:auth},{store,signingKey:key,rateGate});
 assert.equal(denied.code,429);
 assert.equal(denied.result.error,'rate_limited');
 assert.deepEqual(denied.headers,{'Retry-After':'17'});
 const live=await dispatch({method:'GET',path:'/health'},{store,signingKey:key,rateGate});
 assert.equal(live.code,200);
});

test('shared quota limits signed clients across independent backend instances',async()=>{
 const auth='Bearer '+issueToken({tenantId:tenant,subject:'signed-profile'},key);
 let privateRead=false;
 const store={
  consumeQuota:async(t,actor,bucket)=>{
   assert.equal(t,tenant);assert.equal(actor,'signed-profile');assert.equal(bucket,'read');
   return {allowed:false,retryAfter:14};
  },
  listSites:async()=>{privateRead=true;return [];}
 };
 const rateGate={take:()=>({allowed:true,retryAfter:0})};
 const response=await dispatch({method:'GET',path:'/v1/sites',authorization:auth},
  {store,signingKey:key,rateGate});
 assert.equal(response.code,429);
 assert.equal(response.headers['Retry-After'],'14');
 assert.equal(privateRead,false);
});
test('shared rate limiter outage fails closed without exposing tenant data',async()=>{
 const auth='Bearer '+issueToken({tenantId:tenant,subject:'signed-profile'},key);
 const store={
  consumeQuota:async()=>{throw Error('test-only database outage');},
  listSites:async()=>{throw Error('must not fetch client rows');}
 };
 const rateGate={take:()=>({allowed:true,retryAfter:0})};
 const response=await dispatch({method:'GET',path:'/v1/sites',authorization:auth},
  {store,signingKey:key,rateGate});
 assert.equal(response.code,503);
 assert.equal(response.result.error,'rate_limit_unavailable');
});
