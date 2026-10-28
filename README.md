# SEOTAKATAK — Organic SEO Operations Engine

**GROUPE TAKATAK** · A tenant-scoped SEO backend built to integrate into the existing **TAKATAK V1** dashboard. TAKATAK Auth remains the identity and customer master. This service does not have a separate customer login.

## Features implemented

- Site registry per TAKATAK V1 client workspace (domain, niche, target market, locale)
- Domain ownership verification via random seven-day DNS TXT challenge, with tenant-scoped checks and replay-safe conditional updates (requires reviewed migration `sql/0002_domain_verification.sql`)
- Real Search Console query import (clicks, impressions and position) with a transparent opportunity priority score
- Editorial backlink prospect management (identified, researching, contacted, declined; earned is reserved for future independently verified links)
- Original content brief queue requiring human editorial review
- 60-second signed JWT API authentication and read/manage scopes; tenant and site ownership enforced for every operation
- Per-process burst controls **plus** shared PostgreSQL 60-second quotas (120 reads/30 writes/8 imports per signed profile and tenant), with Retry-After; requires approved migration 0005
- PostgreSQL schema, PostgREST service integration, Docker image and Node 22 tests

**Not implemented or verified yet:** Live Google OAuth ingest, verified backlink crawling, AI answer citation measurement, automated publication, email campaigns, live production database or Coolify deployment. No traffic or search ranking outcome is guaranteed.

## API

All routes under /v1 require a signed 60-second server-to-server token issued by TAKATAK V1 with issuer=takatak-v1, audience=seotakatak, sub=the authenticated TAKATAK profile ID, tenant_id=the selected and authorized workspace UUID, permissions=[seo:view,seo:manage,seo:import]. All writes require seo:manage.

- GET /health (public liveness)
- GET /ready (database and signing configuration readiness)
- GET /v1/sites
- POST /v1/sites {domain,niche,market,locale}
- GET /v1/sites/:siteId
- DELETE /v1/sites/:siteId {confirmDomain:"exact.example",confirmDelete:true} — atomic, auditable, irreversible tenant-scoped deletion of the SEO site; on database approval, foreign-key ON DELETE CASCADE also removes its keywords, prospects and briefs; TAKATAK master identity is unchanged
- GET /v1/sites/:siteId/verification (seo:manage only; DNS challenge details)
- POST /v1/sites/:siteId/verification/start (issues/rotates DNS TXT challenge)
- POST /v1/sites/:siteId/verification/check (verifies live DNS, conditionally persists proof)
- GET /v1/workspace/deletion-receipts?offset=0 — **seo:manage** only; paginated tenant-specific operational receipts (IDs, timestamp, counts; no actor identity), 100 rows/page; requires SQL migration 0004; NOT legal certification of ecosystem-wide data erasure.
- GET /v1/workspace/export?collection=sites|opportunities|prospects|briefs&offset=0 — signed tenant-scoped, paginated JSON export; 200 records/page, `hasMore` and `nextOffset`, allowlisted database columns, no DNS tokens or reviewer IDs. Follow pagination for each category. Exports are nontransactional.
- GET /v1/sites/:siteId/export — client-tenant-scoped **bounded JSON site snapshot** with up to 200 SEO records from each collection, explicit coverage flags and redacted DNS/reviewer secrets. NOT a full account/workspace export.
- GET /v1/sites/:siteId/summary (explicitly sampled, evidence-aware reporting)
- GET /v1/sites/:siteId/opportunities.csv (tenant-filtered, spreadsheet-safe CSV)
- GET /v1/sites/:siteId/opportunities
- POST /v1/sites/:siteId/opportunities/import {source:"search_console",rows:[{keyword,clicks,impressions,position}]} — requires dedicated seo:import server scope; seo:manage alone is forbidden
- GET/POST /v1/sites/:siteId/prospects; POST {publication,url,relevance}
- PATCH /v1/sites/:siteId/prospects/:id/status {status}
- GET/POST /v1/sites/:siteId/briefs; POST {keyword,angle} (always begins as an unpublished draft)
- PATCH /v1/sites/:siteId/briefs/:briefId/review {status:"approved"|"rejected",note} — a one-time server-attributed editorial decision, never a CMS publication; rejected reviews require a 10+ character reason

## Install & deploy

Requires Node 22. Run npm run check. No third-party NPM packages required.

1. Review and apply `sql/0001_seo_core.sql` followed by `sql/0002_domain_verification.sql`, `sql/0003_brief_editorial_review.sql` and `sql/0004_site_deletion_receipts.sql`, in that order, to an explicitly authorized Supabase PostgreSQL project. This is a new schema: DO NOT change the TAKATAK V1 production DB without the database release coordinator approval.
2. Set all variables in .env.example as runtime secrets in Coolify, never at build time. The service role key must never be sent to a browser.
3. Set identical SEOTAKATAK_SIGNING_KEY in TAKATAK V1 and the SEO service. Configure SEOTAKATAK_API_URL in TAKATAK V1, pointing to the internal HTTPS SEO API.
4. Build using the repository Dockerfile. Check GET /health = 200, GET /ready = 200, and GET /v1/sites without a valid token = 401. Test real database reads/writes and cross-tenant access before production launch.
5. Merge the separate V1 dashboard integration PR following V1's coordinator rules. Do not replace TAKATAK's existing /dashboard/seo audits or rankings pages.

## Safety and scope

Only independent editorial outreach, relevant content and compliant citations; no purchased link packages or automated manipulative reciprocal links. Search Console measurements are evidence-backed, not invented. Do not expose cross-tenant metrics. Store service role secrets server-side only.

See docs/ROADMAP.md for the remaining phases and production prerequisites.

## Abuse prevention and complete schema readiness

The Node service applies per-process authenticated request quotas: read 120/minute, write 30/minute and trusted Search Console ingestion 8/minute per tenant and signer. The API returns HTTP 429 and Retry-After when exceeded. These process-local limits are not an organization-wide distributed quota; production should additionally apply Coolify/reverse-proxy or shared-store limits. The public `/ready` endpoint verifies required columns in all four SEO PostgREST tables, **including verification columns from SQL migration 0002**, without returning tenant records. It cannot report readiness before both migrations are present.

## Isolated SQL migration verification

`SEOTAKATAK CI` now starts a disposable PostgreSQL 16 container, bootstraps only its test-only Supabase `anon` and `authenticated` roles, runs migrations `0001`, `0002`, `0003` in order and asserts review consistency, composite tenant foreign keys and cascading deletion in a rollback transaction. Run `bash scripts/test-sql.sh` where Docker is available. **This never migrates production or connects to a paid database.** Real migrations still require owner approval, backups and release coordination.

## SEO data export integrity and role validation

The `/v1/workspace/export` API is an authenticated, per-tenant paginated view, not a guaranteed point-in-time snapshot. Retrieve every page of the four collections, following `nextOffset`, to obtain the currently available records. The content may change between page requests. Public/visitor roles must never have direct table privileges: CI now asserts PostgreSQL RLS on all SEO tables and no `anon` or `authenticated` table read/write privileges. This is tested in disposable Postgres, not by inspecting the owner's production grants.

## Atomic SEO deletion receipts (reviewed migration 0004 required)

A signed `seo:manage` operator can delete one owned SEO site after the exact-hostname and separate-confirmation checks. The server calls `seo_delete_site_with_receipt` in PostgreSQL: a single transaction locks the owned site, records deleted-child counts and the server-authenticated reviewer profile ID, deletes the site and cascades its dependent SEO rows. A wrong workspace/domain or a repeated request produces no successful receipt. The database retains a tenant-scoped receipt without retaining the deleted hostname in plaintext; the receipt API never returns the actor ID. Server-only `service_role` has EXECUTE permission, while `anon` and `authenticated` do not. An operational database receipt is **not** a cryptographic seal, a complete cross-product erasure certificate, or a retention-policy substitute. Approval of 0004 and a written retention/subject-access policy are outstanding.

## Privacy-safe operational observability

Each HTTP response includes a server-generated `X-Request-ID` UUID. The Node listener logs structured `http_request` records containing only request ID, broad route category (`health`/`ready`/`api`), method, status and elapsed milliseconds; it never logs tokens, request body, original URL/query, customer identifiers or IP addresses. Unexpected handler exceptions produce a 503 `service_unavailable` with a matching, identifier-only error log, not a stack trace to the browser. CI exercises real HTTP request IDs and ensures no token/body leak. Managers can use the request ID to correlate operational problems when Coolify logging is enabled; there is no external alerting integration yet.

## PostgREST memory and privacy boundary (2026-10-16)

The server-side data adapter enforces the maximum size of a PostgREST response **during stream consumption**, before buffering it in memory: 1,048,576 UTF-8 bytes per response. Larger payloads cancel the upstream stream and return a safe API unavailable status without exposing service-role secrets. JSON returned under this bound is still parsed and validated by the existing API. Normal site, opportunity, prospect and brief lists query only their explicit public columns at the PostgREST `select` layer, never `*`; privileged operations such as DNS ownership checks still retrieve the additional private fields they legitimately need. This limit protects the application process; it does not create additional records or guarantee full export coverage.

## Multi-instance request quotas (reviewed migration 0005 required)

Migration `sql/0005_shared_rate_limits.sql` adds `seo_api_rate_buckets` and privileged SECURITY INVOKER `seo_consume_api_quota` with atomic `INSERT ... ON CONFLICT DO UPDATE` counters. The subject is hashed before storage, with separate tenant and read/write/import buckets. The database clock controls the 60-second windows across multiple Node instances. Locally rejected bursts avoid a database call; requests otherwise must also pass this shared quota. A limit hit returns HTTP 429 with Retry-After; an unavailable quota datastore yields a safe HTTP 503 rather than silently allowing access. PostgreSQL integration tests prove 8 allowed/12 denied when 20 import requests run concurrently. Only server-side `service_role` can execute the RPC; anon/authenticated are denied. Counters are operational, **not** an approved customer billing or legal retention policy. No actual Supabase database has been migrated yet.

## Google Merchant Center Free Listings — initial read-only backend integration

`POST /v1/sites/:siteId/merchant/inspect` is a **server-to-server only** read-only Merchant API v1 inspection (account GET, processed products GET, actual reported destination statuses/issues). Requires a 60-second TAKATAK V1 JWT with `seo:import` **and** a trusted `merchant_account_id` claim, tenant-owned **DNS verified** SEO site, and a short-lived OAuth token obtained by the matching merchant's V1 server-side Google connection. Product pages are bounded (max 50) and source responses capped at 1 MiB; the result never returns or stores OAuth tokens. This is not a product upload, a linked/connected dashboard status, or evidence of Google listing appearance. **No real OAuth merchant connection has been activated.** See `docs/MERCHANT_API_V1_INTEGRATION.md`. Google's legacy Content API for Shopping sunset 2026-08-18; Merchant API v1 is required.
