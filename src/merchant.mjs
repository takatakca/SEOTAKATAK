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
   if(!Array.isArray(result.products)||result.products.length>pageSize)
    throw new MerchantApiError();
   if(result.nextPageToken!==undefined&&safePageToken(result.nextPageToken)===false)
    throw new MerchantApiError();
   if(result.products.some(p=>!p||typeof p!=='object'||typeof p.name!=='string'||
       !p.name.startsWith('accounts/'+accountId+'/products/')))
    throw new MerchantApiError('account_mismatch');
   return {
    source:'google_merchant_api_v1',
    account:{name:account.name,accountName:bounded(account.accountName,150),
     testAccount:account.testAccount===true},
    products:result.products.map(sanitizeProduct),
    nextPageToken:result.nextPageToken||null,
    received:result.products.length,
    observedAt:new Date().toISOString(),
    disclaimer:'Live provider data for a single read; not a stored connection, guarantee of eligibility, or proof of Google free-listings appearance.'
   };
  }
 };
}
