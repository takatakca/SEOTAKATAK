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
 delete from public.seo_sites where tenant_id=tenant and id=site;
 if exists(select 1 from public.seo_briefs where site_id=site) or exists(select 1 from public.seo_opportunities where site_id=site) or exists(select 1 from public.seo_prospects where site_id=site) then raise exception 'Cascade failed'; end if;
end $$;
-- Authenticated and anonymous frontend roles must have no direct SEO table access.
do $audit$
declare
 table_name text;
begin
 foreach table_name in array array['seo_sites','seo_opportunities','seo_prospects','seo_briefs'] loop
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
end $audit$;
rollback;
