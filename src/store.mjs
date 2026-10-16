// PostgREST server-side adapter. No service key is ever exposed to a browser.
export class DatabaseError extends Error{constructor(status){super('SEO datastore unavailable');this.status=status;}}
const TABLES=new Set(['seo_sites','seo_opportunities','seo_prospects','seo_briefs','seo_site_deletion_receipts']);
const RPC_DELETE='rpc/seo_delete_site_with_receipt';
export function createStore({baseUrl,serviceKey,fetchImpl=fetch}){
 if(!baseUrl||!serviceKey||!/^https:\/\//.test(baseUrl))throw new Error('Server-side Supabase configuration required');
 const root=new URL('/rest/v1/',baseUrl);
 async function request(table,{method='GET',filter={},body,order,limit,offset,select='*',upsert=false}={}){
  if(!TABLES.has(table)&&table!==RPC_DELETE)throw new Error('Unknown table');
  const url=new URL(table,root);
  for(const [key,value] of Object.entries(filter))url.searchParams.set(key,value);
  if(order)url.searchParams.set('order',order);
  if(limit!==undefined)url.searchParams.set('limit',String(limit));
  if(offset!==undefined)url.searchParams.set('offset',String(offset));
  if(upsert)url.searchParams.set('on_conflict','tenant_id,site_id,keyword,source');
  if(method==='GET')url.searchParams.set('select',select);
  const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey,Accept:'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(method!=='GET')headers.Prefer=(upsert?'resolution=merge-duplicates,':'')+'return=representation';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetchImpl(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,redirect:'error'});
   if(!response.ok)throw new DatabaseError(response.status);
   if(Number(response.headers.get('content-length')||0)>1048576)throw new DatabaseError(502);
   const result=await response.text();
   if(result.length>1048576)throw new DatabaseError(502);
   return result?JSON.parse(result):[];
  }catch(e){if(e instanceof DatabaseError)throw e;throw new DatabaseError(503);}finally{clearTimeout(timeout);}
 }
 const eq=x=>'eq.'+x,filter=(tenantId,siteId)=>({tenant_id:eq(tenantId),site_id:eq(siteId)});
 // Public /ready probes must not amplify unauthenticated traffic into four
 // PostgREST requests per caller. Cache per store instance, never across tenants.
 let readinessUntil=0,readinessResult=null,readinessPending=null;
 return {
  async schemaReady(){
   if(readinessResult!==null&&Date.now()<readinessUntil){
    if(!readinessResult)throw new DatabaseError(503);
    return true;
   }
   if(readinessPending)return readinessPending;
   readinessPending=(async()=>{
    try{
     // Limit zero validates schema without accessing customer records.
     await Promise.all([
      request('seo_sites',{select:'id,tenant_id,domain,verification_token,verification_issued_at,verified_at',limit:0}),
      request('seo_opportunities',{select:'id,tenant_id,site_id,keyword',limit:0}),
      request('seo_prospects',{select:'id,tenant_id,site_id,status',limit:0}),
      request('seo_briefs',{select:'id,tenant_id,site_id,status,reviewed_at,reviewed_by,review_note',limit:0}),
      request('seo_site_deletion_receipts',{
       select:'id,tenant_id,site_id,deleted_at,opportunities_removed,prospects_removed,briefs_removed',
       limit:0
      }),
     ]);
     readinessResult=true;
     readinessUntil=Date.now()+10_000;
     return true;
    }catch(error){
     readinessResult=false;
     readinessUntil=Date.now()+5_000;
     throw error;
    }finally{readinessPending=null;}
   })();
   return readinessPending;
  },
  async exportWorkspacePage(tenantId,collection,offset,pageSize=200){
   const allowed={
    sites:['seo_sites','id,domain,niche,market,locale,created_at,verified_at'],
    opportunities:['seo_opportunities','id,site_id,keyword,source,clicks,impressions,position,priority,updated_at'],
    prospects:['seo_prospects','id,site_id,publication,url,relevance,status,created_at,updated_at'],
    briefs:['seo_briefs','id,site_id,keyword,angle,status,created_at,reviewed_at,review_note']
   };
   if(!Object.hasOwn(allowed,collection)||!Number.isSafeInteger(offset)||offset<0||
      offset>1_000_000||pageSize!==200)throw new DatabaseError(400);
   const [table,select]=allowed[collection];
   // Select only export-safe columns at PostgREST: secrets and reviewer identities never leave DB.
   const rows=await request(table,{filter:{tenant_id:eq(tenantId)},
    select,order:'id.asc',limit:pageSize+1,offset});
   return {items:rows.slice(0,pageSize),hasMore:rows.length>pageSize};
  },
  async listSites(tenantId){return request('seo_sites',{filter:{tenant_id:eq(tenantId)},order:'created_at.desc',limit:200});},
  async createSite(tenantId,data){return request('seo_sites',{method:'POST',body:{...data,tenant_id:tenantId}});},
  async updateSiteVerification(tenantId,id,updates,expectedToken){
   return request('seo_sites',{method:'PATCH',filter:{
    tenant_id:eq(tenantId),id:eq(id),...(expectedToken?{verification_token:eq(expectedToken)}:{})
   },body:updates});
  },
  async ownedSite(tenantId,id){const rows=await request('seo_sites',{filter:{tenant_id:eq(tenantId),id:eq(id)},limit:1});return rows[0]||null;},
  async deleteSite(tenantId,id,expectedDomain,actor){
   return request(RPC_DELETE,{method:'POST',body:{
    p_tenant_id:tenantId,p_site_id:id,p_expected_domain:expectedDomain,
    p_actor_subject:actor
   }});
  },
  async listDeletionReceipts(tenantId,offset){
   if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new DatabaseError(400);
   const rows=await request('seo_site_deletion_receipts',{
    filter:{tenant_id:eq(tenantId)},order:'deleted_at.desc,id.desc',
    select:'id,site_id,deleted_at,opportunities_removed,prospects_removed,briefs_removed',
    limit:101,offset
   });
   return {items:rows.slice(0,100),hasMore:rows.length>100};
  },
  async listOpportunities(tenantId,siteId){return request('seo_opportunities',{filter:filter(tenantId,siteId),order:'priority.desc',limit:200});},
  async importOpportunities(tenantId,siteId,rows){return request('seo_opportunities',{method:'POST',body:rows.map(row=>({...row,tenant_id:tenantId,site_id:siteId})),upsert:true});},
  async listProspects(tenantId,siteId){return request('seo_prospects',{filter:filter(tenantId,siteId),order:'created_at.desc',limit:200});},
  async createProspect(tenantId,siteId,data){return request('seo_prospects',{method:'POST',body:{...data,tenant_id:tenantId,site_id:siteId}});},
  async updateProspect(tenantId,siteId,id,data){return request('seo_prospects',{method:'PATCH',filter:{...filter(tenantId,siteId),id:eq(id)},body:data});},
  async listBriefs(tenantId,siteId){return request('seo_briefs',{filter:filter(tenantId,siteId),order:'created_at.desc',limit:200});},
  async createBrief(tenantId,siteId,data){return request('seo_briefs',{method:'POST',body:{...data,tenant_id:tenantId,site_id:siteId}});},
  async reviewBrief(tenantId,siteId,id,updates){
   return request('seo_briefs',{method:'PATCH',filter:{
    ...filter(tenantId,siteId),id:eq(id),status:'eq.draft'
   },body:updates});
  }
 };
}
