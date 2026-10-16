// PostgREST server-side adapter. No service key is ever exposed to a browser.
export class DatabaseError extends Error{constructor(status){super('SEO datastore unavailable');this.status=status;}}
const TABLES=new Set(['seo_sites','seo_opportunities','seo_prospects','seo_briefs']);
export function createStore({baseUrl,serviceKey,fetchImpl=fetch}){
 if(!baseUrl||!serviceKey||!/^https:\/\//.test(baseUrl))throw new Error('Server-side Supabase configuration required');
 const root=new URL('/rest/v1/',baseUrl);
 async function request(table,{method='GET',filter={},body,order,limit,select='*',upsert=false}={}){
  if(!TABLES.has(table))throw new Error('Unknown table');
  const url=new URL(table,root);
  for(const [key,value] of Object.entries(filter))url.searchParams.set(key,value);
  if(order)url.searchParams.set('order',order);
  if(limit!==undefined)url.searchParams.set('limit',String(limit));
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
 return {
  async schemaReady(){
   // Limit zero validates the required schema columns without returning tenant data.
   await Promise.all([
    request('seo_sites',{select:'id,tenant_id,domain,verification_token,verification_issued_at,verified_at',limit:0}),
    request('seo_opportunities',{select:'id,tenant_id,site_id,keyword',limit:0}),
    request('seo_prospects',{select:'id,tenant_id,site_id,status',limit:0}),
    request('seo_briefs',{select:'id,tenant_id,site_id,status',limit:0}),
   ]);
   return true;
  },
  async listSites(tenantId){return request('seo_sites',{filter:{tenant_id:eq(tenantId)},order:'created_at.desc',limit:200});},
  async createSite(tenantId,data){return request('seo_sites',{method:'POST',body:{...data,tenant_id:tenantId}});},
  async updateSiteVerification(tenantId,id,updates,expectedToken){
   return request('seo_sites',{method:'PATCH',filter:{
    tenant_id:eq(tenantId),id:eq(id),...(expectedToken?{verification_token:eq(expectedToken)}:{})
   },body:updates});
  },
  async ownedSite(tenantId,id){const rows=await request('seo_sites',{filter:{tenant_id:eq(tenantId),id:eq(id)},limit:1});return rows[0]||null;},
  async deleteSite(tenantId,id){return request('seo_sites',{method:'DELETE',filter:{tenant_id:eq(tenantId),id:eq(id)}});},
  async listOpportunities(tenantId,siteId){return request('seo_opportunities',{filter:filter(tenantId,siteId),order:'priority.desc',limit:200});},
  async importOpportunities(tenantId,siteId,rows){return request('seo_opportunities',{method:'POST',body:rows.map(row=>({...row,tenant_id:tenantId,site_id:siteId})),upsert:true});},
  async listProspects(tenantId,siteId){return request('seo_prospects',{filter:filter(tenantId,siteId),order:'created_at.desc',limit:200});},
  async createProspect(tenantId,siteId,data){return request('seo_prospects',{method:'POST',body:{...data,tenant_id:tenantId,site_id:siteId}});},
  async updateProspect(tenantId,siteId,id,data){return request('seo_prospects',{method:'PATCH',filter:{...filter(tenantId,siteId),id:eq(id)},body:data});},
  async listBriefs(tenantId,siteId){return request('seo_briefs',{filter:filter(tenantId,siteId),order:'created_at.desc',limit:200});},
  async createBrief(tenantId,siteId,data){return request('seo_briefs',{method:'POST',body:{...data,tenant_id:tenantId,site_id:siteId}});}
 };
}
