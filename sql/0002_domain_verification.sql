-- REVIEW REQUIRED: run after 0001 in an owner-approved SEOTAKATAK project.
-- Domain registration is not proof of domain ownership.
alter table public.seo_sites
 add column if not exists verification_token text,
 add column if not exists verification_issued_at timestamptz,
 add column if not exists verified_at timestamptz;
-- A new random challenge invalidates earlier verification. The API only writes verification
-- after resolving the exact DNS TXT challenge for this tenant-owned site.
alter table public.seo_sites
 drop constraint if exists seo_sites_verification_token_format;
alter table public.seo_sites
 add constraint seo_sites_verification_token_format
 check (verification_token is null or verification_token ~ '^[0-9a-f]{64}$');
