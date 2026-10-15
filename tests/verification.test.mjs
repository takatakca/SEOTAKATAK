import test from 'node:test';
import assert from 'node:assert/strict';
import {issueToken} from '../src/auth.mjs';
import {dispatch} from '../src/app.mjs';
import {issueChallenge,verifySiteTxt,challengeDetails,CHALLENGE_MAX_AGE_MS} from '../src/verification.mjs';
const A='7d87a2c9-fb84-474a-8ccc-43d6fe47605c',B='8d87a2c9-fb84-474a-8ccc-43d6fe47605d',ID='7d87a2c9-fb84-474a-8ccc-43d6fe47605e';
const key='A'.repeat(64);
function fixture(){
 const site={id:ID,tenant_id:A,domain:'takatak.ca',verification_token:null,verification_issued_at:null,verified_at:null};
 const calls=[];
 const store={
  ownedSite:async(t,id)=>t===A&&id===ID?{...site}:null,
  updateSiteVerification:async(t,id,updates,expectedToken)=>{
   calls.push({t,id,updates,expectedToken});
   if(t!==A||id!==ID||(expectedToken&&expectedToken!==site.verification_token))return [];
   Object.assign(site,updates);
   return [{...site}];
  }
 };
 const token=(t=A,permissions=['seo:manage'])=>'Bearer '+issueToken({tenantId:t,subject:'user',permissions},key);
 const run=(verb,path,auth=token(),dnsLookup)=>dispatch({method:verb,path,authorization:auth},{store,signingKey:key,dnsLookup});
 return {site,store,calls,token,run};
}
test('DNS challenge uses cryptographically random token and fixed TXT record',()=>{
 const a=issueChallenge(),b=issueChallenge();
 assert.match(a,/^[a-f0-9]{64}$/);
 assert.notEqual(a,b);
 assert.deepEqual(challengeDetails('takatak.ca',a),{recordName:'_seotakatak.takatak.ca',recordValue:'seotakatak-verify='+a});
 assert.equal(challengeDetails('localhost',a),null);
});
test('DNS TXT matcher joins split TXT fragments but rejects absent/incorrect records',async()=>{
 const token=issueChallenge(),correct='seotakatak-verify='+token;
 assert.equal(await verifySiteTxt('takatak.ca',token,async()=>[[correct.slice(0,24),correct.slice(24)]]),true);
 assert.equal(await verifySiteTxt('takatak.ca',token,async()=>[['seotakatak-verify='+issueChallenge()]]),false);
 assert.equal(await verifySiteTxt('takatak.ca',token,async()=>{throw Error('ENOTFOUND')}),false);
});
test('only workspace manager can see or start DNS ownership checks',async()=>{
 const x=fixture(),path='/v1/sites/'+ID+'/verification';
 assert.equal((await x.run('GET',path,x.token(A,['seo:view']))).code,403);
 assert.equal((await x.run('POST',path+'/start',x.token(A,['seo:view']))).code,403);
 assert.equal((await x.run('GET',path,x.token(B,['seo:manage']))).code,404);
 const start=await x.run('POST',path+'/start');
 assert.equal(start.code,201);
 assert.equal(start.result.challenge.recordName,'_seotakatak.takatak.ca');
 assert.equal(x.site.verified_at,null);
 const status=await x.run('GET',path);
 assert.equal(status.result.challenge.recordValue,start.result.challenge.recordValue);
});
test('cannot mark verified without matching DNS; successful check persists tenant-scoped verification',async()=>{
 const x=fixture(),path='/v1/sites/'+ID+'/verification';
 const issued=await x.run('POST',path+'/start');
 const incorrect=await x.run('POST',path+'/check',undefined,async()=>[['wrong']]);
 assert.equal(incorrect.code,409);
 assert.equal(x.site.verified_at,null);
 const correct=await x.run('POST',path+'/check',undefined,async()=>[[issued.result.challenge.recordValue]]);
 assert.equal(correct.code,200);
 assert.equal(correct.result.verified,true);
 assert.ok(x.site.verified_at);
 assert.equal(x.site.verification_token,null);
 assert.equal(x.calls.at(-1).expectedToken,issued.result.challenge.recordValue.slice('seotakatak-verify='.length));
});
test('expired challenge and concurrent token rotation are rejected',async()=>{
 const x=fixture(),path='/v1/sites/'+ID+'/verification';
 await x.run('POST',path+'/start');
 x.site.verification_issued_at=new Date(Date.now()-CHALLENGE_MAX_AGE_MS-1000).toISOString();
 assert.equal((await x.run('POST',path+'/check',undefined,async()=>{throw Error('should not run')})).code,409);
 await x.run('POST',path+'/start');
 const pending=x.site.verification_token;
 x.store.updateSiteVerification=async()=>[];
 const check=await x.run('POST',path+'/check',undefined,async()=>[['seotakatak-verify='+pending]]);
 assert.equal(check.code,409);
 assert.equal(x.site.verified_at,null);
});
