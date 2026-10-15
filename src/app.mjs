import { verifyBearer,hasScope } from './auth.mjs';
import { DatabaseError } from './store.mjs';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses=new Set(['identified','researching','contacted','declined']); // earned requires independent verification
const asText=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const fail=(code,error)=>({code,result:{ok:false,error}});
const ok=(body={},code=200)=>({code,result:{ok:true,...body}});
function domain(input){
 if(typeof input!=='string'||input.length>253)return null;
 try{
  const url=new URL(input.includes('://')?input:'https://'+input),host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)return null;
  if(!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))return null;
  return host;
 }catch{return null;}
}
function targetUrl(value){
 if(typeof value!=='string'||value.length>512)return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port?url.toString():null;}catch{return null;}
}
function searchRows(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>100)return null;
 const output=[],seen=new Set();
 for(const row of rows){
  if(!row||typeof row!=='object'||typeof row.keyword!=='string')return null;
  const keyword=asText(row.keyword.toLowerCase(),160),{clicks,impressions,position}=row;
  if(keyword.length<2||!Number.isInteger(clicks)||!Number.isInteger(impressions)||clicks<0||impressions<0||clicks>impressions||impressions>1e9||typeof position!=='number'||!Number.isFinite(position)||position<1||position>1000)return null;
  if(seen.has(keyword))continue;seen.add(keyword);
  const expected=position<=3?0.08:position<=10?0.035:0.01;
  const priority=Math.min(100,Math.round(Math.log10(impressions+1)*15+(position>=4&&position<=20?30:0)+(impressions&&clicks/impressions<expected?15:0)));
  output.push({keyword,source:'search_console',clicks,impressions,position,priority,updated_at:new Date().toISOString()});
 }
 return output;
}
export const validateDomain=domain;
export const validateSearchConsoleRows=searchRows;
export async function dispatch({method,path,authorization,body},{store,signingKey}){
 if(method==='GET'&&path==='/health')return ok({status:'ok',service:'seotakatak'});
 if(method==='GET'&&path==='/ready'){
  if(!store||!signingKey||signingKey.length<32)return fail(503,'not_configured');
  try { await store.listSites('00000000-0000-4000-8000-000000000000');return ok({status:'ready',database:'reachable'}); }
  catch {return fail(503,'database_unavailable');}
 }
 const identity=verifyBearer(authorization,signingKey);
 if(!identity)return fail(401,'unauthorized');
 if(!hasScope(identity,'seo:view'))return fail(403,'permission_denied');
 if(method!=='GET'&&!hasScope(identity,'seo:manage'))return fail(403,'permission_denied');
 const parts=path.split('/').filter(Boolean),tenantId=identity.tenantId;
 if(parts[0]!=='v1')return fail(404,'not_found');
 const json=body&&typeof body==='object'&&!Array.isArray(body)?body:{};
 try{
  if(parts.length===2&&parts[1]==='sites'){
   if(method==='GET')return ok({sites:await store.listSites(tenantId)});
   if(method==='POST'){
    const hostname=domain(json.domain),niche=asText(json.niche,120),market=asText(json.market,80);
    if(!hostname||niche.length<2||market.length<2)return fail(400,'invalid_site');
    const rows=await store.createSite(tenantId,{domain:hostname,niche,market,locale:['fr-CA','en-CA','es'].includes(json.locale)?json.locale:'en-CA'});
    return ok({site:rows[0]},201);
   }
  }
  if(parts.length>=3&&parts[1]==='sites'&&ID.test(parts[2])){
   const siteId=parts[2],site=await store.ownedSite(tenantId,siteId);
   if(!site)return fail(404,'site_not_found');
   if(parts.length===3&&method==='GET')return ok({site});
   if(parts.length===4&&method==='GET'){
    if(parts[3]==='opportunities')return ok({opportunities:await store.listOpportunities(tenantId,siteId)});
    if(parts[3]==='prospects')return ok({prospects:await store.listProspects(tenantId,siteId)});
    if(parts[3]==='briefs')return ok({briefs:await store.listBriefs(tenantId,siteId)});
   }
   if(parts.length===5&&parts[3]==='opportunities'&&parts[4]==='import'&&method==='POST'){
    if(json.source!=='search_console')return fail(400,'invalid_source');
    const rows=searchRows(json.rows);if(!rows)return fail(400,'invalid_rows');
    const result=await store.importOpportunities(tenantId,siteId,rows);return ok({imported:result.length},201);
   }
   if(parts.length===4&&parts[3]==='prospects'&&method==='POST'){
    const publication=asText(json.publication,150),url=targetUrl(json.url),relevance=asText(json.relevance,500);
    if(publication.length<2||!url||relevance.length<10)return fail(400,'invalid_prospect');
    const result=await store.createProspect(tenantId,siteId,{publication,url,relevance,status:'identified'});
    return ok({prospect:result[0]},201);
   }
   if(parts.length===6&&parts[3]==='prospects'&&ID.test(parts[4])&&parts[5]==='status'&&method==='PATCH'){
    if(!statuses.has(json.status))return fail(400,'invalid_status');
    const result=await store.updateProspect(tenantId,siteId,parts[4],{status:json.status,updated_at:new Date().toISOString()});
    return result.length?ok({prospect:result[0]}):fail(404,'prospect_not_found');
   }
   if(parts.length===4&&parts[3]==='briefs'&&method==='POST'){
    const keyword=asText(json.keyword,160),angle=asText(json.angle,500);
    if(keyword.length<2||angle.length<10)return fail(400,'invalid_brief');
    const result=await store.createBrief(tenantId,siteId,{keyword,angle,status:'draft'});
    return ok({brief:result[0]},201);
   }
  }
  return fail(404,'not_found');
 }catch(e){
  if(e instanceof DatabaseError)return fail(e.status===409?409:503,e.status===409?'conflict':'database_unavailable');
  return fail(503,'service_unavailable');
 }
}
