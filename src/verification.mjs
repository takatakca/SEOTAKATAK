import {randomBytes,timingSafeEqual} from 'node:crypto';
import {Resolver} from 'node:dns/promises';
export const DOMAIN_VERIFICATION_PREFIX='seotakatak-verify=';
const TOKEN=/^[a-f0-9]{64}$/;
const HOST=/^(?=.{4,238}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const CHALLENGE_MAX_AGE_MS=7*24*60*60*1000;
export function issueChallenge(){
 return randomBytes(32).toString('hex');
}
export function challengeDetails(host,token){
 if(!HOST.test(host)||!TOKEN.test(token))return null;
 return {recordName:'_seotakatak.'+host,recordValue:DOMAIN_VERIFICATION_PREFIX+token};
}
export async function publicTxtLookup(recordName){
 const resolver=new Resolver({timeout:2500,tries:2});
 return resolver.resolveTxt(recordName);
}
export async function verifySiteTxt(host,token,lookup=publicTxtLookup){
 const details=challengeDetails(host,token);
 if(!details)return false;
 try{
  const records=await lookup(details.recordName);
  if(!Array.isArray(records)||records.length>100)return false;
  const candidate=Buffer.from(details.recordValue,'utf8');
  for(const segments of records){
   if(!Array.isArray(segments))continue;
   const value=segments.join('').trim();
   if(value.length!==details.recordValue.length)continue;
   const actual=Buffer.from(value,'utf8');
   if(actual.length===candidate.length&&timingSafeEqual(actual,candidate))return true;
  }
 }catch{}
 return false;
}
