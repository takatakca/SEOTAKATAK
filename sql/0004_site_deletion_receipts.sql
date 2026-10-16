-- Owner/database-coordinator review required. Apply AFTER 0001, 0002, 0003.
-- Receipts remain available after an SEO site's dependent rows are deleted.
-- No TAKATAK master identity or unrelated workspace data is touched.
create table if not exists public.seo_site_deletion_receipts (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 site_id uuid not null,
 domain_sha256 text not null check (domain_sha256 ~ '^[a-f0-9]{64}$'),
 actor_subject text not null check (length(actor_subject) between 1 and 128),
 opportunities_removed integer not null check (opportunities_removed >= 0),
 prospects_removed integer not null check (prospects_removed >= 0),
 briefs_removed integer not null check (briefs_removed >= 0),
 deleted_at timestamptz not null default now(),
 unique (tenant_id, site_id)
);
create index if not exists seo_deletion_receipts_tenant_time_idx
 on public.seo_site_deletion_receipts(tenant_id,deleted_at desc,id desc);
alter table public.seo_site_deletion_receipts enable row level security;
revoke all on public.seo_site_deletion_receipts from anon, authenticated;

-- A single transaction creates the receipt and cascades deletion.
-- Function is SECURITY INVOKER; only server-side service_role may call it.
-- A missing site, wrong tenant, or wrong domain returns no rows, not a receipt.
create or replace function public.seo_delete_site_with_receipt(
 p_tenant_id uuid,p_site_id uuid,p_expected_domain text,p_actor_subject text
)
returns table(
 receipt_id uuid,
 deleted_site_id uuid,
 deleted_at timestamptz,
 opportunities_removed integer,
 prospects_removed integer,
 briefs_removed integer
)
language plpgsql
security invoker
set search_path = ''
as $seo_delete$
declare
 v_site uuid;
 v_domain text;
 v_receipt uuid;
 v_time timestamptz;
 v_o integer;
 v_p integer;
 v_b integer;
begin
 if p_tenant_id is null or p_site_id is null or p_actor_subject is null or
    length(p_actor_subject) not between 1 and 128 then
  raise exception 'Invalid deletion request' using errcode='22023';
 end if;
 select s.id,s.domain into v_site,v_domain
  from public.seo_sites s
  where s.id=p_site_id and s.tenant_id=p_tenant_id
  for update;
 if v_site is null or v_domain is distinct from lower(btrim(p_expected_domain)) then
  return;
 end if;
 select count(*)::integer into v_o from public.seo_opportunities
  where tenant_id=p_tenant_id and site_id=p_site_id;
 select count(*)::integer into v_p from public.seo_prospects
  where tenant_id=p_tenant_id and site_id=p_site_id;
 select count(*)::integer into v_b from public.seo_briefs
  where tenant_id=p_tenant_id and site_id=p_site_id;
 insert into public.seo_site_deletion_receipts (
  tenant_id,site_id,domain_sha256,actor_subject,
  opportunities_removed,prospects_removed,briefs_removed
 ) values (
  p_tenant_id,p_site_id,encode(digest(v_domain,'sha256'),'hex'),
  p_actor_subject,v_o,v_p,v_b
 ) returning id,seo_site_deletion_receipts.deleted_at into v_receipt,v_time;
 delete from public.seo_sites s where s.tenant_id=p_tenant_id and s.id=p_site_id;
 return query select v_receipt,v_site,v_time,v_o,v_p,v_b;
end
$seo_delete$;

-- PostgreSQL defaults to EXECUTE for PUBLIC on new functions; revoke explicitly.
revoke all on function public.seo_delete_site_with_receipt(uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.seo_delete_site_with_receipt(uuid,uuid,text,text)
 to service_role;
