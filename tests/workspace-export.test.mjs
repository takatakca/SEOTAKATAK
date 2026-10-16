import test from 'node:test';
import assert from 'node:assert/strict';
import { issueToken } from '../src/auth.mjs';
import { dispatch } from '../src/app.mjs';

const A='7d87a2c9-fb84-474a-8ccc-43d6fe47605c';
const B='8d87a2c9-fb84-474a-8ccc-43d6fe47605d';
const key='C'.repeat(64);
const signed=(tenantId=A,permissions=['seo:view'])=>
  'Bearer '+issueToken({tenantId,subject:'reviewer',permissions},key);

test('workspace export rejects unauthenticated, import-only and invalid pages',async()=>{
 const store={exportWorkspacePage:async()=>{throw Error('should not query')}};
 const fetchPage=(authorization,query)=>dispatch({
  method:'GET',path:'/v1/workspace/export',authorization,query
 },{store,signingKey:key});
 assert.equal((await fetchPage(undefined,{collection:'sites',offset:'0'})).code,401);
 assert.equal((await fetchPage(signed(A,['seo:import']),{collection:'sites',offset:'0'})).code,403);
 for(const query of [
  {collection:'other',offset:'0'},
  {collection:'sites',offset:'-1'},
  {collection:'sites',offset:'1.2'},
  {collection:'sites',offset:'1000001'},
  {collection:'sites',offset:'1e3'},
  {collection:'sites',offset:'00'},
  {collection:'sites',offset:'0',extra:'ignored',__proto__:'ignored'}
 ].slice(0,7)){
  const result=await fetchPage(signed(),query);
  assert.equal(result.code,400,JSON.stringify(query));
 }
});

test('workspace pages use signed tenant and explicit continuation without false completeness',async()=>{
 const calls=[],siteId='7d87a2c9-fb84-474a-8ccc-43d6fe47605e';
 const store={exportWorkspacePage:async(t,c,offset,limit)=>{
  calls.push({t,c,offset,limit});
  return {items:[{id:siteId,domain:t===A?'a.example':'b.example'}],hasMore:offset===0};
 }};
 const fetchPage=(t,offset)=>dispatch({
  method:'GET',path:'/v1/workspace/export',
  authorization:signed(t),query:{collection:'sites',offset:String(offset)}
 },{store,signingKey:key});
 const first=await fetchPage(A,0);
 assert.equal(first.code,200);
 assert.equal(first.result.export.format,'seotakatak-workspace-page');
 assert.equal(first.result.export.coverage.transactionallyConsistent,false);
 assert.equal(first.result.export.hasMore,true);
 assert.equal(first.result.export.nextOffset,1);
 assert.deepEqual(calls[0],{t:A,c:'sites',offset:0,limit:200});
 const second=await fetchPage(A,1);
 assert.equal(second.result.export.nextOffset,null);
 assert.equal(second.result.export.hasMore,false);
 const other=await fetchPage(B,0);
 assert.equal(other.result.export.records[0].domain,'b.example');
 assert.equal(first.result.export.records[0].domain,'a.example');
 assert.deepEqual(calls[2],{t:B,c:'sites',offset:0,limit:200});
});
