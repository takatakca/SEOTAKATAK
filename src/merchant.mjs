// Google Merchant API v1 read-only adapter. Never call the sunset Content API.
// OAuth access tokens originate from the trusted TAKATAK V1 server only.
const MERCHANT_ORIGIN='https://merchantapi.googleapis.com';
const ACCOUNT_ID=/^[1-9][0-9]{0,19}$/;
const COUNTRY=/^[A-Z]{2}$/;
const RESPONSE_LIMIT=1_048_576;
export class MerchantApiError extends Error{
 constructor(kind='unavailable'){super('Merchant provider unavailable');this.kind=kind;}
}
export function validMerchantAccountId(id){
 return typeof id==='string'&&ACCOUNT_ID.test(id);
}
function accessTokenIsValid(token){
 return typeof token==='string'&&token.length>=20&&token.length<=4096&&
  /^[\x21-\x7e]+$/.test(token)&&!/[\s?#]/.test(token);
}
function bounded(value,max=180){
 return typeof value==='string'?value.slice(0,max):null;
}
function countries(value){
 return Array.isArray(value)?value.filter(v=>typeof v==='string'&&COUNTRY.test(v)).slice(0,40):[];
}
function sanitizeProduct(product){
 const attributes=product.productAttributes&&typeof product.productAttributes==='object'?
  product.productAttributes:{};
 const status=product.productStatus&&typeof product.productStatus==='object'?product.productStatus:null;
 const destinations=Array.isArray(status?.destinationStatuses)?
  status.destinationStatuses.slice(0,20).map(row=>({
   reportingContext:bounded(row.reportingContext,64),
   approvedCountries:countries(row.approvedCountries),
   pendingCountries:countries(row.pendingCountries),
   disapprovedCountries:countries(row.disapprovedCountries)
  })):[];
 const issues=Array.isArray(status?.itemLevelIssues)?
  status.itemLevelIssues.slice(0,50).map(row=>({
   code:bounded(row.code,100),severity:bounded(row.severity,48),
   attribute:bounded(row.attribute,90),reportingContext:bounded(row.reportingContext,64),
   description:bounded(row.description,250),
   applicableCountries:countries(row.applicableCountries)
  })):[];
 return {
  offerId:bounded(product.offerId,140),
  title:bounded(attributes.title,250),
  imageLink:typeof attributes.imageLink==='string'&&
   /^https:\/\//i.test(attributes.imageLink)&&attributes.imageLink.length<=1400?
   attributes.imageLink:null,
  productStatusAvailable:status!==null,
  destinationStatuses:destinations,
  itemLevelIssues:issues
 };
}
function safePageToken(value){
 return value===undefined||value===null||value===''?null:
  typeof value==='string'&&value.length<=1200&&value.length>0&&
   /^[A-Za-z0-9_+\/=.-]+$/.test(value)?value:false;
}
export function createMerchantReader({fetchImpl=fetch,timeoutMs=8000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>15000)throw new Error('Invalid timeout');
 async function request(path,token){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(new URL(path,MERCHANT_ORIGIN),{
    method:'GET',
    headers:{Authorization:'Bearer '+token,Accept:'application/json'},
    redirect:'error',signal:controller.signal
   });
   if(response.status===401||response.status===403)throw new MerchantApiError('access_denied');
   if(!response.ok)throw new MerchantApiError('unavailable');
   const declared=Number(response.headers.get('content-length'));
   if(Number.isFinite(declared)&&declared>RESPONSE_LIMIT)throw new MerchantApiError();
   const chunks=[];let received=0;
   if(!response.body)throw new MerchantApiError();
   const reader=response.body.getReader();
   try{
    while(true){
     const {done,value}=await reader.read();
     if(done)break;
     received+=value.byteLength;
     if(received>RESPONSE_LIMIT){
      await reader.cancel().catch(()=>{});
      throw new MerchantApiError();
     }
     chunks.push(value);
    }
   }finally{reader.releaseLock();}
   const parsed=JSON.parse(Buffer.concat(chunks,received).toString('utf8'));
   if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new MerchantApiError();
   return parsed;
  }catch(error){
   if(error instanceof MerchantApiError)throw error;
   throw new MerchantApiError();
  }finally{clearTimeout(timer);}
 }
 return {
  async inspectSources({accountId,accessToken,sourcePageToken,issuePageToken,pageSize=25}){
   if(!validMerchantAccountId(accountId)||!accessTokenIsValid(accessToken))
    throw new MerchantApiError('invalid_request');
   const sourceToken=safePageToken(sourcePageToken);
   const issueToken=safePageToken(issuePageToken);
   if(sourceToken===false||issueToken===false||
      !Number.isInteger(pageSize)||pageSize<1||pageSize>50)
    throw new MerchantApiError('invalid_request');
   const account=await request('/accounts/v1/accounts/'+accountId,accessToken);
   if(account.name!=='accounts/'+accountId)throw new MerchantApiError('account_mismatch');
   const sourcesUrl=new URL('/datasources/v1/accounts/'+accountId+'/dataSources',MERCHANT_ORIGIN);
   sourcesUrl.searchParams.set('pageSize',String(pageSize));
   if(sourceToken)sourcesUrl.searchParams.set('pageToken',sourceToken);
   const issuesUrl=new URL('/accounts/v1/accounts/'+accountId+'/issues',MERCHANT_ORIGIN);
   issuesUrl.searchParams.set('pageSize',String(pageSize));
   if(issueToken)issuesUrl.searchParams.set('pageToken',issueToken);
   const [sources,issues]=await Promise.all([
    request(sourcesUrl.pathname+sourcesUrl.search,accessToken),
    request(issuesUrl.pathname+issuesUrl.search,accessToken)
   ]);
   const sourceRows=sources.dataSources??[],issueRows=issues.accountIssues??[];
   if(!Array.isArray(sourceRows)||sourceRows.length>pageSize||
      !Array.isArray(issueRows)||issueRows.length>pageSize||
      (sources.nextPageToken!==undefined&&safePageToken(sources.nextPageToken)===false)||
      (issues.nextPageToken!==undefined&&safePageToken(issues.nextPageToken)===false))
    throw new MerchantApiError();
   const sourcePrefix='accounts/'+accountId+'/dataSources/';
   const issuePrefix='accounts/'+accountId+'/issues/';
   if(sourceRows.some(row=>!row||typeof row.name!=='string'||
       !row.name.startsWith(sourcePrefix))||
      issueRows.some(row=>!row||typeof row.name!=='string'||
       !row.name.startsWith(issuePrefix)))
    throw new MerchantApiError('account_mismatch');
   return {
    source:'google_merchant_api_v1',
    account:{name:account.name,accountName:bounded(account.accountName,150),
     testAccount:account.testAccount===true},
    dataSources:sourceRows.map(row=>{
     const primary=row.primaryProductDataSource&&typeof row.primaryProductDataSource==='object'?
      row.primaryProductDataSource:{};
     return {
      name:bounded(row.name,200),displayName:bounded(row.displayName,200),
      input:bounded(row.input,60),
      fileInputType:bounded(row.fileInput?.fileInputType,60),
      primaryFeedLabel:bounded(primary.feedLabel,24),
      primaryContentLanguage:bounded(primary.contentLanguage,24),
      primaryCountries:countries(primary.countries),
      // Never disclose fileInput.fetchSettings (may contain private fetch URIs).
      hasFileInput:!!row.fileInput
     };
    }),
    accountIssues:issueRows.map(row=>({
     name:bounded(row.name,260),
     title:bounded(row.title,250),
     severity:bounded(row.severity,60),
     impactedDestinations:Array.isArray(row.impactedDestinations)?
      row.impactedDestinations.slice(0,20).map(d=>({
       reportingContext:bounded(d.reportingContext,64),
       impacts:Array.isArray(d.impacts)?d.impacts.slice(0,40).map(i=>({
        regionCode:bounded(i.regionCode,30),severity:bounded(i.severity,60)
       })):[]
      })):[]
    })),
    nextSourcePageToken:sources.nextPageToken||null,
    nextIssuePageToken:issues.nextPageToken||null,
    observedAt:new Date().toISOString(),
    disclaimer:'Read-only Merchant data sources and issues as currently returned by Google; not proof of product feed upload, connection persistence, eligibility or visibility.'
   };
  },
  async inspect({accountId,accessToken,pageToken,pageSize=25}){
   if(!validMerchantAccountId(accountId)||!accessTokenIsValid(accessToken))
    throw new MerchantApiError('invalid_request');
   const token=safePageToken(pageToken);
   if(token===false||!Number.isInteger(pageSize)||pageSize<1||pageSize>50)
    throw new MerchantApiError('invalid_request');
   // Account identity is checked first against the account ID cryptographically
   // bound by the central TAKATAK V1 JWT, not client-provided JSON.
   const account=await request('/accounts/v1/accounts/'+accountId,accessToken);
   if(account.name!=='accounts/'+accountId)throw new MerchantApiError('account_mismatch');
   const url=new URL('/products/v1/accounts/'+accountId+'/products',MERCHANT_ORIGIN);
   url.searchParams.set('pageSize',String(pageSize));
   if(token)url.searchParams.set('pageToken',token);
   const result=await request(url.pathname+url.search,accessToken);
   // Google omits the products field for legitimate empty result pages.
   const productRows=result.products??[];
   if(!Array.isArray(productRows)||productRows.length>pageSize)
    throw new MerchantApiError();
   if(result.nextPageToken!==undefined&&safePageToken(result.nextPageToken)===false)
    throw new MerchantApiError();
   if(productRows.some(p=>!p||typeof p!=='object'||typeof p.name!=='string'||
       !p.name.startsWith('accounts/'+accountId+'/products/')))
    throw new MerchantApiError('account_mismatch');
   return {
    source:'google_merchant_api_v1',
    account:{name:account.name,accountName:bounded(account.accountName,150),
     testAccount:account.testAccount===true},
    products:productRows.map(sanitizeProduct),
    nextPageToken:result.nextPageToken||null,
    received:productRows.length,
    observedAt:new Date().toISOString(),
    disclaimer:'Live provider data for a single read; not a stored connection, guarantee of eligibility, or proof of Google free-listings appearance.'
   };
  }
 };
}
