-- REVIEW REQUIRED: apply after 0001 and 0002 ONLY to an owner-approved SEO database.
-- Approval is strictly for editorial planning; it does NOT publish to a CMS.
alter table public.seo_briefs
 add column if not exists reviewed_at timestamptz,
 add column if not exists reviewed_by text,
 add column if not exists review_note text;

alter table public.seo_briefs
 drop constraint if exists seo_briefs_status_check;
alter table public.seo_briefs
 add constraint seo_briefs_status_check
 check (status in ('draft','approved','rejected'));

alter table public.seo_briefs
 drop constraint if exists seo_briefs_review_consistency;
alter table public.seo_briefs
 add constraint seo_briefs_review_consistency check (
   (status = 'draft' and reviewed_at is null and reviewed_by is null and review_note is null)
   or
   (status in ('approved','rejected') and reviewed_at is not null
     and length(reviewed_by) between 1 and 128
     and (review_note is null or length(review_note) between 1 and 500)
     and (status <> 'rejected' or length(review_note) between 10 and 500))
 );
-- The API PATCH filters status=eq.draft, so review decisions are immutable.
-- No new permissions to anon/authenticated: tenant-filtered server-only service-role access.
