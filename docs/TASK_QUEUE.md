# SEOTAKATAK executable task queue

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
- [ ] Add regulatory-grade consistent snapshot, verifiable erasure receipts and owner-approved retention/subject-access policy across TAKATAK products; ordinary pages are not a transactionally consistent backup.
- [x] Prevent public /ready request amplification with bounded per-store success/failure probe caching and concurrent-call coalescing.
- [ ] Add a shared cross-instance/edge rate limit and approved audit/retention policy before large-scale production usage.
- [x] Build server-validated DNS TXT ownership proof, short-lived challenge, secret redaction, anti-rotation guard and tests.
- [x] Add real PostgreSQL 16 CI migration execution with 0001→0002→0003, FK/review/cascade assertions, RLS enabled, and anon/authenticated privilege-denial checks.
- [ ] Owner approves/applies `sql/0002_domain_verification.sql` after `0001` in the authorized project, and live-verifies TXT challenge through V1.
- [x] Confirm backend code CI run 38793391043 passed; fixed initial regression test expectations.
- [ ] Confirm latest V1 PR #182 full CI after all updates; fix only actual failures.
- [ ] Coordinator reviews/merges TAKATAK V1 PR #182; coordinator handles V1 production release. Do not bypass coordinator.
- [ ] Owner approves a **non-billable / already-owned** Supabase project and schema migration. Verify DB roles/grants, tenant FKs, RLS, real PostgREST reads/writes, and negative tests.
- [ ] Owner/admin configures SEOTAKATAK Coolify app and GitHub production environment values documented in `docs/DEPLOYMENT.md`; automated deployment then runs.
- [ ] Verify running /health and /ready, actual database connectivity and signed V1 service integration for separate client workspaces.
- [ ] Add reliable official backlink verification with evidence snapshots, quality review and broken-link alerts.
- [ ] Add per-client scheduled Search Console imports (quota, deduplication, rate limits, audit receipts, verified-domain mapping).
- [x] Add one-time manager-controlled editorial approval or rejection of unpublished content briefs with reviewer attribution and no auto-publishing.
- [ ] Obtain database owner approval for `sql/0003_brief_editorial_review.sql` after 0001+0002; verify schema and real review transition.
- [ ] Add multilingual original content creation, explicit CMS connection and separate verified-domain publishing consent (not part of editorial approval).
- [ ] Add evidence-based AI answer citation observation through approved provider/API; no synthetic positions presented as observed.
- [ ] Add per-client usage limits, privacy retention/erase flow, billing entitlements if approved, performance/security load tests, metrics/alarms, optional automation service.
- [ ] Verify actual deployed git SHA; document rollback rehearsal and owner sign-off.

Run locally: `npm run check` (Node 22), `docker build -t seotakatak:ci .` and `bash -n scripts/deploy-coolify.sh`.
