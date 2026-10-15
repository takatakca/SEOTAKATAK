# SEOTAKATAK — project status

Last audit: **2026-10-15** · GitHub repository: `takatakca/SEOTAKATAK` · branch: `main`.

## Implemented
- Node 22 HTTP API, Docker image and basic liveness/readiness endpoints.
- TAKATAK V1-issued 60-second HMAC-signed identity tokens; `seo:view`, `seo:manage`, `seo:import` roles and enforced tenant/site ownership.
- Tenant-separated site registry, content briefs, backlink prospects (not falsely labeled earned), Search Console ingest endpoint reserved for verified V1 server-side connector.
- Stored query opportunity scoring; bounded 200-row opportunity/brief/prospect data reads, honestly labeled sampled summary and formula-injection-safe CSV opportunity export.
- Supabase/PostgREST adapter, PostgreSQL schema proposal with RLS and tenant foreign keys.
- CI tests + Docker checks and GitHub Actions Coolify deployment job gated on green CI, with DB-ready probe.
- TAKATAK V1 dashboard integration in **PR #182** (existing SEO pages retained): public /free-tools, authenticated /dashboard/seo/free-tools and /dashboard/seo/portfolio; Google Search Console verified server-side import is under review.

## Not yet done / no false success
- Live Supabase database not provisioned or tested; `sql/0001_seo_core.sql` not applied to production.
- Coolify app, API token, app UUID, HTTPS service URL and runtime secrets **not confirmed**. The latest deployment attempts fail at GitHub environment configuration (first observed missing COOLIFY_API_URL).
- TAKATAK V1 PR #182 is open; only its designated coordinator may merge and deploy.
- Real backlink verification, real LLM citation/rankings provider, scheduled Google imports, multilingual content publishing, outreach delivery and full operational audit log remain future features. No guaranteed SEO outcome.
- A true immutable deployed revision has not been validated in a running application.

## Production criterion
CI success alone is insufficient. Require approved database, deployed HTTPS container, successful /ready DB probe, authenticated V1 client-scoped cross-tenant smoke, verified version and official V1 production promotion.

## Most recent verified checks

At backend SHA `c1be583a1c18750cc4fd2c9dae49a54a87992ede`, GitHub CI run `38793391043` passed. Automatic production job `38793423983` failed; see [release blocker issue #1](https://github.com/takatakca/SEOTAKATAK/issues/1). No hosted service is confirmed.

### Verified build pipeline milestone

Commit `bde41fb7` has green CI run `38794560027`. The deployment script checks Coolify's reported commit against the exact GitHub-verified SHA and requires database readiness. The subsequent deployment still failed on absent infrastructure configuration, so **production is not live**.

### 2026-10-15 domain ownership milestone
- Implemented 256-bit randomized DNS TXT challenge at `_seotakatak.<domain>`, seven-day expiry, strict tenant-managed endpoints, live DNS comparison, and conditional database update that refuses a rotated challenge.
- Read-only SEO users cannot fetch or start the TXT challenge; site-list and site-detail JSON explicitly redact stored challenge token and issuance time.
- New **pending** SQL migration `sql/0002_domain_verification.sql` adds challenge/verified columns. Neither this nor `0001` was executed against production.
- Backend CI passed on code SHA `4bcdc57c769ba92228e8c98090180a85c904d2bf`, run `38798985084`; corresponding production deployment `38799021739` failed due previously documented Coolify setup blockage. Client dashboard integration awaits V1 PR #182 coordinator review.

### 2026-10-15 runtime safety update

- Per-tenant-and-signer quotas enforced in-process (120 reads / 30 writes / 8 imports per minute, with 429 and Retry-After). This is **not** a shared multi-instance limiter.
- Readiness checks the exact columns of sites/verification, opportunities, prospects and briefs via PostgREST without returning customer data. A missing DNS verification migration now prevents production from reporting ready.
- Code CI passed at `c1d7861f`, run `38799814574`; following deployment job `38799844905` failed. **No successful live deployment has been demonstrated.**
