import { createHmac, timingSafeEqual } from 'node:crypto';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (data,key) => createHmac('sha256',key).update(data).digest();
export function issueToken({tenantId,subject,permissions=['seo:view'],now=Math.floor(Date.now()/1000)},key){
 if(!key||key.length<32||!UUID.test(tenantId)||typeof subject!=='string'||!subject) throw new Error('Invalid signing identity');
 if(!Array.isArray(permissions)||permissions.some(p=>!['seo:view','seo:manage'].includes(p)))throw new Error('Invalid permissions');
 const data=encode({alg:'HS256',typ:'JWT'})+'.'+encode({iss:'takatak-v1',aud:'seotakatak',sub:subject,tenant_id:tenantId,permissions,iat:now,exp:now+60});
 return data+'.'+sign(data,key).toString('base64url');
}
export function verifyBearer(authHeader,key,now=Math.floor(Date.now()/1000)){
 if(!key||key.length<32||typeof authHeader!=='string'||!/^Bearer [A-Za-z0-9._-]+$/.test(authHeader))return null;
 const parts=authHeader.slice(7).split('.');
 if(parts.length!==3||parts.some(p=>!p||p.length>4096))return null;
 try{
  const [a,b,c]=parts,expected=sign(a+'.'+b,key),actual=Buffer.from(c,'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  const header=JSON.parse(Buffer.from(a,'base64url').toString());
  const payload=JSON.parse(Buffer.from(b,'base64url').toString());
  if(header.alg!=='HS256'||header.typ!=='JWT'||payload.iss!=='takatak-v1'||payload.aud!=='seotakatak'||!UUID.test(payload.tenant_id)||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>128)return null;
  if(!Number.isInteger(payload.iat)||!Number.isInteger(payload.exp)||payload.iat>now+30||payload.iat<now-90||payload.exp<=now||payload.exp>payload.iat+60)return null;
  if(!Array.isArray(payload.permissions)||payload.permissions.length>2||payload.permissions.some(p=>!['seo:view','seo:manage'].includes(p)))return null;
  return {tenantId:payload.tenant_id,subject:payload.sub,permissions:payload.permissions};
 }catch{return null;}
}
export function hasScope(identity,scope){return !!identity&&(identity.permissions.includes(scope)||(scope==='seo:view'&&identity.permissions.includes('seo:manage')));}
