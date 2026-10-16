-- Explicit database owner approval required after migrations 0001..0004.
-- Shared quota state across Coolify replicas. No direct browser role grants.
create table if not exists public.seo_api_rate_buckets (
 tenant_id uuid not null,
 subject_hash text not null check(subject_hash ~ '^[a-f0-9]{64}$'),
 bucket text not null check(bucket in ('read','write','import')),
 window_started timestamptz not null,
 used_count integer not null check(used_count between 1 and 121),
 updated_at timestamptz not null default now(),
 primary key (tenant_id,subject_hash,bucket)
);
alter table public.seo_api_rate_buckets enable row level security;
revoke all on public.seo_api_rate_buckets from anon,authenticated;

-- Conflict-update serializes concurrent requests on one tenant/profile/bucket.
-- DB clock and hardcoded limits prevent callers changing the rate policy.
create or replace function public.seo_consume_api_quota(
 p_tenant_id uuid,p_subject text,p_bucket text
) returns table(allowed boolean,retry_after integer)
language plpgsql
security invoker
set search_path=''
as $quota$
declare
 v_now timestamptz:=clock_timestamp();
 v_limit integer;
 v_used integer;
 v_window timestamptz;
 v_subject_hash text;
begin
 if p_tenant_id is null or p_subject is null or
  length(p_subject) not between 1 and 128 then
  raise exception 'Invalid quota identity' using errcode='22023';
 end if;
 v_limit:=case p_bucket when 'read' then 120
  when 'write' then 30 when 'import' then 8 else null end;
 if v_limit is null then
  raise exception 'Invalid quota bucket' using errcode='22023';
 end if;
 v_subject_hash:=encode(sha256(convert_to(p_subject,'UTF8')),'hex');
 insert into public.seo_api_rate_buckets as existing
  (tenant_id,subject_hash,bucket,window_started,used_count,updated_at)
 values(p_tenant_id,v_subject_hash,p_bucket,v_now,1,v_now)
 on conflict(tenant_id,subject_hash,bucket) do update set
  used_count=case
   when excluded.window_started>=existing.window_started+interval '60 seconds'
   then 1 else least(existing.used_count+1,v_limit+1) end,
  window_started=case
   when excluded.window_started>=existing.window_started+interval '60 seconds'
   then excluded.window_started else existing.window_started end,
  updated_at=excluded.updated_at
 returning used_count,window_started into v_used,v_window;
 return query select v_used<=v_limit,
  case when v_used<=v_limit then 0
   else greatest(1,ceil(extract(epoch from
    (v_window+interval '60 seconds'-v_now)))::integer)
  end;
end
$quota$;
revoke all on function public.seo_consume_api_quota(uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.seo_consume_api_quota(uuid,text,text)
 to service_role;
-- Counter retention/cleanup must be reviewed by the database owner.
