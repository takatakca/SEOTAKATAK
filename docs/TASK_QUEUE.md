# SEOTAKATAK executable task queue

Order by security and operational dependencies. Do not duplicate completed work.

- [x] Baseline Node.js backend, tenant-isolated REST API and schema.
- [x] Differentiate `seo:import` from `seo:manage`; bind import action to verified TAKATAK V1 Search Console source (PR #182).
- [x] Add bounded, honest SEO summary and safe CSV export.
- [ ] Confirm latest backend CI and V1 integration PR #182 full CI after synchronization; fix only actual failures.
- [ ] Coordinator reviews/merges TAKATAK V1 PR #182; coordinator handles V1 production release. Do not bypass coordinator.
- [ ] Owner approves a **non-billable / already-owned** Supabase project and schema migration. Verify DB roles/grants, tenant FKs, RLS, real PostgREST reads/writes, and negative tests.
- [ ] Owner/admin configures SEOTAKATAK Coolify app and GitHub production environment values documented in `docs/DEPLOYMENT.md`; automated deployment then runs.
- [ ] Verify running /health and /ready, actual database connectivity and signed V1 service integration for separate client workspaces.
- [ ] Add reliable official backlink verification with evidence snapshots, quality review and broken-link alerts.
- [ ] Add per-client scheduled Search Console imports (quota, deduplication, rate limits, audit receipts, verified-domain mapping).
- [ ] Add multilingual original content drafting and mandatory approval before any CMS publication; verified ownership + consent for publishing.
- [ ] Add evidence-based AI answer citation observation through approved provider/API; no synthetic positions presented as observed.
- [ ] Add per-client usage limits, privacy retention/erase flow, billing entitlements if approved, performance/security load tests, metrics/alarms, optional automation service.
- [ ] Verify actual deployed git SHA; document rollback rehearsal and owner sign-off.

Run locally: `npm run check` (Node 22), `docker build -t seotakatak:ci .` and `bash -n scripts/deploy-coolify.sh`.
