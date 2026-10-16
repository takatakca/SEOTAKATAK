begin;
do $$
declare
 tenant uuid := '7d87a2c9-fb84-474a-8ccc-43d6fe47605c';
 site uuid := '7d87a2c9-fb84-474a-8ccc-43d6fe47605e';
 brief_id uuid := '7d87a2c9-fb84-474a-8ccc-43d6fe47605f';
begin
 insert into public.seo_sites(id,tenant_id,domain,niche,market) values(site,tenant,'ci-example.test','SEO tests','Canada');
 insert into public.seo_briefs(id,tenant_id,site_id,keyword,angle) values(brief_id,tenant,site,'original SEO','Original research with cited primary evidence');
 begin
  update public.seo_briefs set status='approved' where id=brief_id;
  raise exception 'Approval without reviewer must fail';
 exception when check_violation then null;
 end;
 begin
  update public.seo_briefs set status='rejected',reviewed_by='reviewer',reviewed_at=now() where id=brief_id;
  raise exception 'Rejection without reason must fail';
 exception when check_violation then null;
 end;
 update public.seo_briefs set status='approved',reviewed_by='reviewer',reviewed_at=now(),review_note='Human editor checked primary sources' where id=brief_id;
 if not exists(select 1 from public.seo_briefs where id=brief_id and status='approved') then raise exception 'Approved brief missing'; end if;
 insert into public.seo_opportunities(tenant_id,site_id,keyword,source,clicks,impressions,position,priority) values(tenant,site,'real search','search_console',2,100,8,65);
 insert into public.seo_prospects(tenant_id,site_id,publication,url,relevance) values(tenant,site,'Journal','https://example.org/story','Relevant editorial opportunity');
 begin
  insert into public.seo_opportunities(tenant_id,site_id,keyword,source,clicks,impressions,position,priority) values('8d87a2c9-fb84-474a-8ccc-43d6fe47605d',site,'cross tenant','search_console',0,10,8,55);
  raise exception 'Cross-tenant insertion must fail';
 exception when foreign_key_violation then null;
 end;
 -- Invalid tenant/domain cannot create a deletion receipt.
 if exists(select 1 from public.seo_delete_site_with_receipt(
  '8d87a2c9-fb84-474a-8ccc-43d6fe47605d',site,'ci-example.test','tester'
 )) then raise exception 'Wrong tenant allowed deletion'; end if;
 if exists(select 1 from public.seo_delete_site_with_receipt(
  tenant,site,'incorrect.example','tester'
 )) then raise exception 'Wrong domain allowed deletion'; end if;
 if exists(select 1 from public.seo_site_deletion_receipts where site_id=site) then
  raise exception 'Invalid deletion emitted receipt';
 end if;
 if not exists(select 1 from public.seo_delete_site_with_receipt(
  tenant,site,'ci-example.test','tester'
 )) then raise exception 'Correct owned deletion must produce receipt'; end if;
 if not exists(select 1 from public.seo_site_deletion_receipts
  where tenant_id=tenant and site_id=site and opportunities_removed=1
   and prospects_removed=1 and briefs_removed=1 and actor_subject='tester') then
  raise exception 'Deletion receipt missing or child counts incorrect';
 end if;
 if exists(select 1 from public.seo_delete_site_with_receipt(
  tenant,site,'ci-example.test','tester'
 )) then raise exception 'Repeated deletion must not create another receipt'; end if;
 if exists(select 1 from public.seo_briefs where site_id=site) or exists(select 1 from public.seo_opportunities where site_id=site) or exists(select 1 from public.seo_prospects where site_id=site) then raise exception 'Cascade failed'; end if;
end $$;
-- Authenticated and anonymous frontend roles must have no direct SEO table access.
do $audit$
declare
 table_name text;
begin
 foreach table_name in array array['seo_sites','seo_opportunities','seo_prospects','seo_briefs','seo_site_deletion_receipts','seo_api_rate_buckets'] loop
  if not exists (
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=table_name and c.relrowsecurity
  ) then raise exception 'RLS disabled on %',table_name; end if;
  if has_table_privilege('anon','public.'||table_name,'SELECT') or
     has_table_privilege('anon','public.'||table_name,'INSERT') or
     has_table_privilege('authenticated','public.'||table_name,'SELECT') or
     has_table_privilege('authenticated','public.'||table_name,'UPDATE') then
   raise exception 'Browser role has direct privileges on %',table_name;
  end if;
 end loop;
 if has_function_privilege('anon','public.seo_delete_site_with_receipt(uuid,uuid,text,text)','EXECUTE') or
    has_function_privilege('authenticated','public.seo_delete_site_with_receipt(uuid,uuid,text,text)','EXECUTE') then
  raise exception 'Client can call privileged deletion RPC';
 end if;
 if has_function_privilege('anon','public.seo_consume_api_quota(uuid,text,text)','EXECUTE') or
    has_function_privilege('authenticated','public.seo_consume_api_quota(uuid,text,text)','EXECUTE') then
   raise exception 'Browser can call shared quota RPC';
 end if;
 if not has_function_privilege('service_role','public.seo_consume_api_quota(uuid,text,text)','EXECUTE') then
   raise exception 'Service role cannot call shared quota RPC';
 end if;
 if not has_function_privilege('service_role','public.seo_delete_site_with_receipt(uuid,uuid,text,text)','EXECUTE') then
  raise exception 'Service role cannot use deletion RPC';
 end if;
end $audit$;
do $quota_test$
declare
 tenant uuid:='7d87a2c9-fb84-474a-8ccc-43d6fe47605c';
 other uuid:='8d87a2c9-fb84-474a-8ccc-43d6fe47605d';
 accepted boolean;
 retry integer;
 k integer;
begin
 for k in 1..8 loop
  select q.allowed,q.retry_after into accepted,retry
   from public.seo_consume_api_quota(tenant,'gsc-sync-user','import') q;
  if not accepted or retry<>0 then raise exception 'GSC request should pass'; end if;
 end loop;
 select q.allowed,q.retry_after into accepted,retry
  from public.seo_consume_api_quota(tenant,'gsc-sync-user','import') q;
 if accepted or retry<1 or retry>60 then raise exception 'Shared limit did not reject'; end if;
 select q.allowed,q.retry_after into accepted,retry
  from public.seo_consume_api_quota(other,'gsc-sync-user','import') q;
 if not accepted then raise exception 'Second tenant must be isolated'; end if;
 select q.allowed,q.retry_after into accepted,retry
  from public.seo_consume_api_quota(tenant,'different-user','import') q;
 if not accepted then raise exception 'Second actor must be isolated'; end if;
 if exists(select 1 from public.seo_api_rate_buckets
  where subject_hash='gsc-sync-user') then
  raise exception 'Quota must not store plaintext actors';
 end if;
end $quota_test$;
rollback;
