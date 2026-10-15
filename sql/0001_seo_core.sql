-- Apply only after database owner approval. Managed with Supabase PostgreSQL.
create extension if not exists pgcrypto;
create table if not exists public.seo_sites (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 domain text not null check (length(domain) between 4 and 253),
 niche text not null check(length(niche) between 2 and 120),
 market text not null check(length(market) between 2 and 80),
 locale text not null default 'en-CA' check(locale in ('fr-CA','en-CA','es')),
 created_at timestamptz not null default now(),
 unique(tenant_id,domain),
 unique(id,tenant_id)
);
create index if not exists seo_sites_tenant_idx on public.seo_sites(tenant_id);
create table if not exists public.seo_opportunities (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 site_id uuid not null,
 keyword text not null check(length(keyword) between 2 and 160),
 source text not null check(source='search_console'),
 clicks integer not null check(clicks>=0),
 impressions integer not null check(impressions>=clicks),
 position numeric(8,3) not null check(position>=1),
 priority integer not null check(priority between 0 and 100),
 updated_at timestamptz not null default now(),
 foreign key(site_id,tenant_id) references public.seo_sites(id,tenant_id) on delete cascade,
 unique(tenant_id,site_id,keyword,source)
);
create index if not exists seo_opportunities_tenant_priority_idx on public.seo_opportunities(tenant_id,site_id,priority desc);
create table if not exists public.seo_prospects (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 site_id uuid not null,
 publication text not null check(length(publication) between 2 and 150),
 url text not null check(length(url)<=512),
 relevance text not null check(length(relevance) between 10 and 500),
 status text not null default 'identified' check(status in ('identified','researching','contacted','earned','declined')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(site_id,tenant_id) references public.seo_sites(id,tenant_id) on delete cascade
);
create index if not exists seo_prospects_tenant_idx on public.seo_prospects(tenant_id,site_id);
create table if not exists public.seo_briefs (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 site_id uuid not null,
 keyword text not null check(length(keyword) between 2 and 160),
 angle text not null check(length(angle) between 10 and 500),
 status text not null default 'draft' check(status='draft'),
 created_at timestamptz not null default now(),
 foreign key(site_id,tenant_id) references public.seo_sites(id,tenant_id) on delete cascade
);
create index if not exists seo_briefs_tenant_idx on public.seo_briefs(tenant_id,site_id);
alter table public.seo_sites enable row level security;
alter table public.seo_opportunities enable row level security;
alter table public.seo_prospects enable row level security;
alter table public.seo_briefs enable row level security;
revoke all on public.seo_sites,public.seo_opportunities,public.seo_prospects,public.seo_briefs from anon,authenticated;
-- No anon or authenticated policies. Service role only, with mandatory tenant filters in API.
