// Process-local safety gate; production additionally needs a shared edge/global quota.
export class RateGate {
 constructor(maxKeys=5000){this.entries=new Map();this.maxKeys=maxKeys;}
 take(key,limit,windowMs,now=Date.now()){
  if(typeof key!=='string'||!key||!Number.isInteger(limit)||limit<1||windowMs<1000)return {allowed:false,retryAfter:60};
  let entry=this.entries.get(key);
  if(!entry||now<entry.start||now-entry.start>=windowMs){
   entry={start:now,count:0};
   this.entries.delete(key);
   if(this.entries.size>=this.maxKeys){
    for(const [k,v] of this.entries){if(now-v.start>=windowMs)this.entries.delete(k);}
    if(this.entries.size>=this.maxKeys)this.entries.delete(this.entries.keys().next().value);
   }
   this.entries.set(key,entry);
  }
  if(entry.count>=limit)return {allowed:false,retryAfter:Math.max(1,Math.ceil((windowMs-(now-entry.start))/1000))};
  entry.count++;
  return {allowed:true,retryAfter:0};
 }
}
export const apiRateGate=new RateGate();
