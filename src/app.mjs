import { verifyBearer,hasScope } from './auth.mjs';
import { DatabaseError } from './store.mjs';
import {issueChallenge,challengeDetails,verifySiteTxt,CHALLENGE_MAX_AGE_MS} from './verification.mjs';
import {apiRateGate} from './rate-limit.mjs';
import {createMerchantReader,MerchantApiError} from './merchant.mjs';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses=new Set(['identified','researching','contacted','declined']); // earned requires independent verification
const asText=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const fail=(code,error,headers)=>({code,result:{ok:false,error},headers});
const ok=(body={},code=200)=>({code,result:{ok:true,...body}});
// Field allowlists prevent service-role PostgREST reads from leaking future DB columns.
const publicFields=(row,allowed)=>Object.fromEntries(allowed.map(field=>[field,row[field]??null]));
const publicSite=row=>publicFields(row,
 ['id','domain','niche','market','locale','created_at','verified_at']);
const publicOpportunity=row=>publicFields(row,
 ['id','site_id','keyword','source','clicks','impressions','position','priority','updated_at']);
const publicProspect=row=>publicFields(row,
 ['id','site_id','publication','url','relevance','status','created_at','updated_at']);
const publicBrief=row=>publicFields(row,
 ['id','site_id','keyword','angle','status','created_at','reviewed_at','review_note']);
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
/** A CSV download is a snapshot, limited to the 200 scoped rows returned by the store. */
export function safeCsvCell(value){
 let content=String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 if(/^[=+@-]/.test(content))content="'"+content;
 return '"'+content.replace(/"/g,'""')+'"';
}
export function opportunityCsv(rows){
 const fields=['keyword','source','clicks','impressions','position','priority','updated_at'];
 return fields.join(',')+'\r\n'+rows.map(row=>fields.map(field=>safeCsvCell(row[field])).join(',')).join('\r\n')+'\r\n';
}
function summarizeRows(opportunities,prospects,briefs){
 const sum=opportunities.reduce((n,row)=>n+(Number.isFinite(Number(row.clicks))?Number(row.clicks):0),0);
 return {
  source:'stored_search_console_import',provenance:'ingestion_scope_required',period:'not_recorded',
  scope:'most_recent_200_rows_per_table',countsAreComplete:false,
  opportunitiesSampled:opportunities.length,prospectsSampled:prospects.length,
  briefsSampled:briefs.length,clicksInSample:sum,
  earnedBacklinksVerified:0,verifiedLinkProviderConfigured:false,
  note:'This report is not a live ranking, full Search Console history, or verified backlink report.'
 };
}
export const validateDomain=domain;
export const validateSearchConsoleRows=searchRows;
export async function dispatch({method,path,authorization,body,query},{store,signingKey,dnsLookup,rateGate=apiRateGate,merchantReader}){
 if(method==='GET'&&path==='/health')return ok({status:'ok',service:'seotakatak'});
 if(method==='GET'&&path==='/ready'){
  if(!store||!signingKey||signingKey.length<32)return fail(503,'not_configured');
  try { await store.schemaReady();return ok({status:'ready',database:'reachable',schema:'verified'}); }
  catch {return fail(503,'database_unavailable');}
 }
 const identity=verifyBearer(authorization,signingKey);
 if(!identity)return fail(401,'unauthorized');
 const parts=path.split('/').filter(Boolean),tenantId=identity.tenantId;
 const merchantInspectRoute=parts.length===5&&parts[0]==='v1'&&parts[1]==='sites'&&
   ID.test(parts[2])&&parts[3]==='merchant'&&
   (parts[4]==='inspect'||parts[4]==='diagnostics')&&method==='POST';
 const importRoute=(parts.length===5&&parts[0]==='v1'&&parts[1]==='sites'&&
   ID.test(parts[2])&&parts[3]==='opportunities'&&parts[4]==='import'&&method==='POST')||merchantInspectRoute;
 if(method==='GET'&&!hasScope(identity,'seo:view'))return fail(403,'permission_denied');
 if(importRoute&&!hasScope(identity,'seo:import'))return fail(403,'import_permission_required');
 if(method!=='GET'&&!importRoute&&!hasScope(identity,'seo:manage'))return fail(403,'permission_denied');
 if(parts[0]!=='v1')return fail(404,'not_found');
 // Bounded per-process limits. Imported evidence has its own stricter quota.
 const bucket=importRoute?'import':method==='GET'?'read':'write';
 const quota=bucket==='import'?8:bucket==='write'?30:120;
 // Local gate prevents unnecessary database traffic during bursts. The
 // atomic shared PostgreSQL gate enforces the same limits across replicas.
 const local=rateGate.take(tenantId+':'+identity.subject+':'+bucket,quota,60_000);
 if(!local.allowed)return fail(429,'rate_limited',{'Retry-After':String(local.retryAfter)});
 if(typeof store?.consumeQuota==='function'){
  try{
   const shared=await store.consumeQuota(tenantId,identity.subject,bucket);
   if(!shared.allowed)return fail(429,'rate_limited',{'Retry-After':String(shared.retryAfter)});
  }catch{return fail(503,'rate_limit_unavailable');}
 }
 const json=body&&typeof body==='object'&&!Array.isArray(body)?body:{};
 try{
  if(parts.length===3&&parts[0]==='v1'&&parts[1]==='workspace'&&
     parts[2]==='deletion-receipts'&&method==='GET'){
   if(!hasScope(identity,'seo:manage'))return fail(403,'permission_denied');
   const offsetText=query?.offset??'0';
   if(typeof offsetText!=='string'||!/^(0|[1-9][0-9]{0,6})$/.test(offsetText)||
      Number(offsetText)>1_000_000)return fail(400,'invalid_receipt_page');
   const offset=Number(offsetText);
   const result=await store.listDeletionReceipts(tenantId,offset);
   return ok({receipts:result.items,offset,limit:100,hasMore:result.hasMore,
    nextOffset:result.hasMore?offset+result.items.length:null});
  }
  if(parts.length===3&&parts[0]==='v1'&&parts[1]==='workspace'&&
     parts[2]==='export'&&method==='GET'){
   const collection=query?.collection;
   const offsetValue=query?.offset??'0';
   if(!['sites','opportunities','prospects','briefs'].includes(collection)||
      typeof offsetValue!=='string'||!/^(0|[1-9][0-9]{0,6})$/.test(offsetValue)||
      Number(offsetValue)>1_000_000)return fail(400,'invalid_export_page');
   const offset=Number(offsetValue);
   const result=await store.exportWorkspacePage(tenantId,collection,offset,200);
   return ok({export:{
    format:'seotakatak-workspace-page',version:1,collection,offset,pageSize:200,
    generatedAt:new Date().toISOString(),records:result.items,
    hasMore:result.hasMore,nextOffset:result.hasMore?offset+result.items.length:null,
    coverage:{
     scope:'signed_takatak_client_workspace',
     orderedBy:'id.asc',transactionallyConsistent:false,
     note:'Retrieve every collection and follow nextOffset for subsequent pages. Concurrent updates may affect a multi-page export; this is not a regulator-certified account export.'
    }
   }});
  }
  if(parts.length===2&&parts[1]==='sites'){
   if(method==='GET')return ok({sites:(await store.listSites(tenantId)).map(publicSite)});
   if(method==='POST'){
    const hostname=domain(json.domain),niche=asText(json.niche,120),market=asText(json.market,80);
    if(!hostname||niche.length<2||market.length<2)return fail(400,'invalid_site');
    const rows=await store.createSite(tenantId,{domain:hostname,niche,market,locale:['fr-CA','en-CA','es'].includes(json.locale)?json.locale:'en-CA'});
    return ok({site:publicSite(rows[0])},201);
   }
  }
  if(parts.length>=3&&parts[1]==='sites'&&ID.test(parts[2])){
   const siteId=parts[2],site=await store.ownedSite(tenantId,siteId);
   if(!site)return fail(404,'site_not_found');
   if(parts.length===3&&method==='GET')return ok({site:publicSite(site)});
   if(parts.length===3&&method==='DELETE'){
    // Intentional cascading deletion: require both a literal domain and a separate approval flag.
    if(json.confirmDelete!==true||typeof json.confirmDomain!=='string'||
       json.confirmDomain.trim().toLowerCase()!==site.domain)return fail(400,'site_deletion_confirmation_required');
    const removed=await store.deleteSite(tenantId,siteId,site.domain,identity.subject);
    if(!removed.length)return fail(409,'site_deletion_conflict');
    const receipt=removed[0];
    return ok({deleted:true,siteId,
      receipt:receipt.receipt_id?{
       id:receipt.receipt_id,deletedAt:receipt.deleted_at,
       opportunitiesRemoved:receipt.opportunities_removed,
       prospectsRemoved:receipt.prospects_removed,
       briefsRemoved:receipt.briefs_removed
      }:null});
   }
   // Domain verification is an independent evidence gate; registration alone is not ownership.
   if(parts.length===4&&parts[3]==='verification'&&method==='GET'){
    if(!hasScope(identity,'seo:manage'))return fail(403,'permission_denied');
    const verified=typeof site.verified_at==='string'&&!!site.verified_at;
    const issued=Date.parse(site.verification_issued_at||'');
    const active=!verified&&!!site.verification_token&&Number.isFinite(issued)&&
      issued<=Date.now()+60_000&&Date.now()-issued<=CHALLENGE_MAX_AGE_MS;
    const challenge=active?challengeDetails(site.domain,site.verification_token):null;
    return ok({verified,verifiedAt:site.verified_at??null,
      challenge:verified?null:challenge?{...challenge,issuedAt:site.verification_issued_at}:null});
   }
   if(parts.length===5&&parts[3]==='verification'&&parts[4]==='start'&&method==='POST'){
    if(!hasScope(identity,'seo:manage'))return fail(403,'permission_denied');
    const token=issueChallenge(),details=challengeDetails(site.domain,token);
    if(!details)return fail(400,'domain_not_eligible_for_dns_verification');
    const changed=await store.updateSiteVerification(tenantId,siteId,{
      verification_token:token,verification_issued_at:new Date().toISOString(),verified_at:null
    });
    if(!changed.length)return fail(409,'verification_state_changed');
    return ok({verified:false,challenge:details},201);
   }
   if(parts.length===5&&parts[3]==='verification'&&parts[4]==='check'&&method==='POST'){
    if(!hasScope(identity,'seo:manage'))return fail(403,'permission_denied');
    if(site.verified_at)return ok({verified:true,verifiedAt:site.verified_at});
    const token=site.verification_token,issued=Date.parse(site.verification_issued_at||'');
    if(!token||!Number.isFinite(issued)||issued>Date.now()+60_000||Date.now()-issued>CHALLENGE_MAX_AGE_MS)
      return fail(409,'verification_challenge_expired_or_missing');
    const matches=await verifySiteTxt(site.domain,token,dnsLookup);
    if(!matches)return fail(409,'dns_txt_not_verified');
    const verifiedAt=new Date().toISOString();
    const changed=await store.updateSiteVerification(tenantId,siteId,{
      verified_at:verifiedAt,verification_token:null,verification_issued_at:null
    },token);
    if(!changed.length)return fail(409,'verification_state_changed');
    return ok({verified:true,verifiedAt});
   }

   if(parts.length===4&&method==='GET'){
    if(parts[3]==='opportunities')return ok({opportunities:(await store.listOpportunities(tenantId,siteId)).map(publicOpportunity)});
    if(parts[3]==='prospects')return ok({prospects:(await store.listProspects(tenantId,siteId)).map(publicProspect)});
    if(parts[3]==='briefs')return ok({briefs:(await store.listBriefs(tenantId,siteId)).map(publicBrief)});
    if(parts[3]==='export'){
     const [opportunities,prospects,briefs]=await Promise.all([
      store.listOpportunities(tenantId,siteId),
      store.listProspects(tenantId,siteId),
      store.listBriefs(tenantId,siteId)
     ]);
     // Explicit allowlists avoid leaking verification secrets and reviewer IDs,
     // including if a later database migration adds more private columns.
     const fields=(record,allowed)=>Object.fromEntries(allowed.map(key=>[key,record[key]??null]));
     const exportedSite=fields(site,['id','domain','niche','market','locale','created_at','verified_at']);
     const exportedOpportunities=opportunities.map(row=>fields(row,[
      'id','keyword','source','clicks','impressions','position','priority','updated_at'
     ]));
     const exportedProspects=prospects.map(row=>fields(row,[
      'id','publication','url','relevance','status','created_at','updated_at'
     ]));
     const exportedBriefs=briefs.map(row=>fields(row,[
      'id','keyword','angle','status','created_at','reviewed_at','review_note'
     ]));
     return ok({export:{
      format:'seotakatak-site-snapshot',version:1,generatedAt:new Date().toISOString(),
      site:exportedSite,opportunities:exportedOpportunities,
      prospects:exportedProspects,briefs:exportedBriefs,
      coverage:{
       maxRowsPerCollection:200,guaranteedComplete:false,
       limitReached:{
        opportunities:opportunities.length>=200,
        prospects:prospects.length>=200,
        briefs:briefs.length>=200
       },
       note:'Bounded current database snapshot, not complete history or live provider measurements.'
      }
     }});
    }
    if(parts[3]==='summary'){
     const [opportunities,prospects,briefs]=await Promise.all([
      store.listOpportunities(tenantId,siteId),store.listProspects(tenantId,siteId),store.listBriefs(tenantId,siteId)
     ]);
     return ok({siteId,summary:summarizeRows(opportunities,prospects,briefs)});
    }
    if(parts[3]==='opportunities.csv'){
     const rows=await store.listOpportunities(tenantId,siteId);
     return {code:200,raw:opportunityCsv(rows),contentType:'text/csv; charset=utf-8',fileName:'seo-opportunities-'+siteId+'.csv'};
    }
   }
   if(merchantInspectRoute){
    // Only the trusted V1 backend may sign the exact Merchant account mapping.
    // The OAuth token must be fetched server-side in V1 and is never persisted.
    if(!identity.merchantAccountId)return fail(403,'merchant_account_binding_required');
    if(!site.verified_at)return fail(409,'site_not_dns_verified');
    if(typeof json.oauthAccessToken!=='string'||json.oauthAccessToken.length<20||
       json.oauthAccessToken.length>4096)
      return fail(400,'invalid_merchant_access_token');
    try{
     const reader=merchantReader??createMerchantReader();
     const observed=parts[4]==='diagnostics'?
      await reader.inspectSources({
       accountId:identity.merchantAccountId,
       accessToken:json.oauthAccessToken,
       sourcePageToken:json.sourcePageToken,
       issuePageToken:json.issuePageToken,
       pageSize:json.pageSize??25
      }):await reader.inspect({
       accountId:identity.merchantAccountId,
       accessToken:json.oauthAccessToken,
       pageToken:json.pageToken,
       pageSize:json.pageSize??25
      });
     return ok({merchant:observed});
    }catch(error){
     if(error instanceof MerchantApiError){
      if(error.kind==='invalid_request')return fail(400,'invalid_merchant_request');
      if(error.kind==='account_mismatch')return fail(403,'merchant_account_mismatch');
      if(error.kind==='access_denied')return fail(403,'merchant_provider_access_denied');
     }
     return fail(502,'merchant_provider_unavailable');
    }
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
    return ok({prospect:publicProspect(result[0])},201);
   }
   if(parts.length===6&&parts[3]==='prospects'&&ID.test(parts[4])&&parts[5]==='status'&&method==='PATCH'){
    if(!statuses.has(json.status))return fail(400,'invalid_status');
    const result=await store.updateProspect(tenantId,siteId,parts[4],{status:json.status,updated_at:new Date().toISOString()});
    return result.length?ok({prospect:publicProspect(result[0])}):fail(404,'prospect_not_found');
   }

   if(parts.length===6&&parts[3]==='briefs'&&ID.test(parts[4])&&parts[5]==='review'&&method==='PATCH'){
    if(!['approved','rejected'].includes(json.status))return fail(400,'invalid_review_status');
    const note=asText(json.note,500);
    if(json.note!==undefined&&(typeof json.note!=='string'||json.note.length>500))return fail(400,'invalid_review_note');
    if(json.status==='rejected'&&note.length<10)return fail(400,'review_reason_required');
    const reviewed=await store.reviewBrief(tenantId,siteId,parts[4],{
      status:json.status,review_note:note||null,
      reviewed_by:identity.subject,reviewed_at:new Date().toISOString()
    });
    if(!reviewed.length)return fail(409,'brief_not_draft_or_unavailable');
    return ok({brief:publicBrief(reviewed[0])});
   }
   if(parts.length===4&&parts[3]==='briefs'&&method==='POST'){
    const keyword=asText(json.keyword,160),angle=asText(json.angle,500);
    if(keyword.length<2||angle.length<10)return fail(400,'invalid_brief');
    const result=await store.createBrief(tenantId,siteId,{keyword,angle,status:'draft'});
    return ok({brief:publicBrief(result[0])},201);
   }
  }
  return fail(404,'not_found');
 }catch(e){
  if(e instanceof DatabaseError)return fail(e.status===409?409:503,e.status===409?'conflict':'database_unavailable');
  return fail(503,'service_unavailable');
 }
}
