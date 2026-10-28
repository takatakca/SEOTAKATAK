# SEOTAKATAK executable task queue

- [x] Reconcile current GitHub main/CI/PR state with Oct26 Drive field notes; keep pre-existing Merchant accounts and feeds untouched.
- [ ] Implement tested read-only Google Merchant API v1 integration (OAuth token obtained only by authorized TAKATAK server; no fake connected state), then V1 signed bridge and separate coordinator-owned PR.
- [ ] Connect existing Merchant Center brand accounts and feeds through owner-authorized OAuth + real successful API call; never recreate accounts or assume production data.
- [ ] Review separate local Free Listings engine artifact and master catalogue when it is actually available in the connected workspace; do not reproduce its algorithms from a summary.


Order by security and operational dependencies. Do not duplicate completed work.

- [x] Baseline Node.js backend, tenant-isolated REST API and schema.
- [x] Differentiate `seo:import` from `seo:manage`; bind import action to verified TAKATAK V1 Search Console source (PR #182).
- [x] Add bounded, honest SEO summary and safe CSV export.
- [x] Add per-process, per-tenant/request-type API quotas and Retry-After responses; tests pass.
- [x] Strengthen /ready to validate four tables and migration 0002 verification columns without leaking data.
- [x] Correct JSON request-size guard to count raw bytes, including multibyte input.
- [x] Implement manager-only dual-confirmation deletion of one tenant's SEO website and cascade records; verified via API and HTTP tests.
- [x] Add tenant-scoped single-site JSON snapshot with sensitive field allowlists and truthful partial-result labels; V1 authenticated download route.
- [x] Add tenant-scoped paginated workspace SEO data export, one collection at a time, with signed access, safe SQL selects and continuation metadata; V1 dashboard download UI.
- [x] Add atomic operational SEO-site deletion receipts (SQL 0004) with tenant-scoped manager-only receipt listing and V1 UI PR; do not claim legal compliance.
- [ ] Add owner-approved retention/subject-access policy, backup-erasure lifecycle and independently verifiable regulatory receipts across TAKATAK products; operational SEO receipts are not a certified system-wide erasure.
- [x] Prevent public /ready request amplification with bounded per-store success/failure probe caching and concurrent-call coalescing.
- [x] Add atomic PostgreSQL shared cross-instance quota for signed tenant/profile read/write/import, with concurrent CI and restricted RPC grants (SQL 0005).
- [ ] Add separate approved edge-level controls, owner-approved operational counter retention/purge policy, and real multi-replica load smoke.
- [x] Build server-validated DNS TXT ownership proof, short-lived challenge, secret redaction, anti-rotation guard and tests.
- [x] Add real PostgreSQL 16 CI migration execution with 0001→0002→0003, FK/review/cascade assertions, RLS enabled, and anon/authenticated privilege-denial checks.
- [ ] Owner approves/applies `sql/0002_domain_verification.sql` after `0001` in the authorized project, and live-verifies TXT challenge through V1.
- [x] Confirm backend code CI run 38793391043 passed; fixed initial regression test expectations.
- [x] Harden PostgREST reads with a streaming 1 MiB UTF-8 byte cap and cancel oversized responses before memory accumulation.
- [x] Minimize normal SEO site/evidence SELECT columns so private database fields are never fetched for listing.
- [x] Confirm TAKATAK V1 PR #196 full CI: SHA 179b61d4 passed run 38885867932, PR ready for coordinator review.
- [x] Confirm TAKATAK V1 PR #182 full CI: SHA ad8a2ffb succeeded (38844695036), PR merged 2026-10-16.
- [x] Confirm latest V1 PR #196 deletion-receipts full CI; designated V1 coordinator must still review/merge.
- [x] TAKATAK V1 PR #182 merged by its coordinator on 2026-10-16; SEO-specific live integration remains unverified.
- [ ] Coordinator reviews/merges new TAKATAK V1 PR #196 only after full CI; coordinator alone handles V1 production release.
- [ ] Owner approves a **non-billable / already-owned** Supabase project and schema migration. Verify DB roles/grants, tenant FKs, RLS, real PostgREST reads/writes, and negative tests.
- [ ] Owner/admin configures SEOTAKATAK Coolify app and GitHub production environment values documented in `docs/DEPLOYMENT.md`; automated deployment then runs.
- [ ] Verify running /health and /ready, actual database connectivity and signed V1 service integration for separate client workspaces.
- [ ] Add reliable official backlink verification with evidence snapshots, quality review and broken-link alerts.
- [ ] Add per-client scheduled Search Console imports (quota, deduplication, rate limits, audit receipts, verified-domain mapping).
- [x] Add one-time manager-controlled editorial approval or rejection of unpublished content briefs with reviewer attribution and no auto-publishing.
- [ ] Obtain database owner approval for `sql/0003_brief_editorial_review.sql` after 0001+0002; verify schema and real review transition.
- [ ] Add multilingual original content creation, explicit CMS connection and separate verified-domain publishing consent (not part of editorial approval).
- [ ] Add evidence-based AI answer citation observation through approved provider/API; no synthetic positions presented as observed.
- [x] Apply explicit API field allowlists and privacy-minimized HTTP request IDs, logs and controlled 503 error boundaries.
- [ ] Add approved central log aggregation/metrics/alerts, distributed rate controls, client usage entitlements, legal retention/backup erase flow, performance/load tests and optional automation service.
- [ ] Verify actual deployed git SHA; document rollback rehearsal and owner sign-off.

Run locally: `npm run check` (Node 22), `docker build -t seotakatak:ci .` and `bash -n scripts/deploy-coolify.sh`.

- [ ] Database owner reviews and approves `sql/0004_site_deletion_receipts.sql` after 0001→0003, including restricted service-role RPC grants and protected receipt retention.

- [ ] DB owner approves and applies `sql/0005_shared_rate_limits.sql` after 0001–0004, verifies RPC roles and real 429/Retry-After behavior across running Coolify replicas.
