# SEOTAKATAK — Organic SEO Operations Engine

**GROUPE TAKATAK** · A tenant-scoped SEO backend built to integrate into the existing **TAKATAK V1** dashboard. TAKATAK Auth remains the identity and customer master. This service does not have a separate customer login.

## Features implemented

- Site registry per TAKATAK V1 client workspace (domain, niche, target market, locale)
- Domain ownership verification via random seven-day DNS TXT challenge, with tenant-scoped checks and replay-safe conditional updates (requires reviewed migration `sql/0002_domain_verification.sql`)
- Real Search Console query import (clicks, impressions and position) with a transparent opportunity priority score
- Editorial backlink prospect management (identified, researching, contacted, declined; earned is reserved for future independently verified links)
- Original content brief queue requiring human editorial review
- 60-second signed JWT API authentication and read/manage scopes; tenant and site ownership enforced for every operation
- PostgreSQL schema, PostgREST service integration, Docker image and Node 22 tests

**Not implemented or verified yet:** Live Google OAuth ingest, verified backlink crawling, AI answer citation measurement, automated publication, email campaigns, live production database or Coolify deployment. No traffic or search ranking outcome is guaranteed.

## API

All routes under /v1 require a signed 60-second server-to-server token issued by TAKATAK V1 with issuer=takatak-v1, audience=seotakatak, sub=the authenticated TAKATAK profile ID, tenant_id=the selected and authorized workspace UUID, permissions=[seo:view,seo:manage,seo:import]. All writes require seo:manage.

- GET /health (public liveness)
- GET /ready (database and signing configuration readiness)
- GET /v1/sites
- POST /v1/sites {domain,niche,market,locale}
- GET /v1/sites/:siteId
- GET /v1/sites/:siteId/verification (seo:manage only; DNS challenge details)
- POST /v1/sites/:siteId/verification/start (issues/rotates DNS TXT challenge)
- POST /v1/sites/:siteId/verification/check (verifies live DNS, conditionally persists proof)
- GET /v1/sites/:siteId/summary (explicitly sampled, evidence-aware reporting)
- GET /v1/sites/:siteId/opportunities.csv (tenant-filtered, spreadsheet-safe CSV)
- GET /v1/sites/:siteId/opportunities
- POST /v1/sites/:siteId/opportunities/import {source:"search_console",rows:[{keyword,clicks,impressions,position}]} — requires dedicated seo:import server scope; seo:manage alone is forbidden
- GET/POST /v1/sites/:siteId/prospects; POST {publication,url,relevance}
- PATCH /v1/sites/:siteId/prospects/:id/status {status}
- GET/POST /v1/sites/:siteId/briefs; POST {keyword,angle}

## Install & deploy

Requires Node 22. Run npm run check. No third-party NPM packages required.

1. Review and apply `sql/0001_seo_core.sql` followed by `sql/0002_domain_verification.sql` to an explicitly authorized Supabase PostgreSQL project. This is a new schema: DO NOT change the TAKATAK V1 production DB without the database release coordinator approval.
2. Set all variables in .env.example as runtime secrets in Coolify, never at build time. The service role key must never be sent to a browser.
3. Set identical SEOTAKATAK_SIGNING_KEY in TAKATAK V1 and the SEO service. Configure SEOTAKATAK_API_URL in TAKATAK V1, pointing to the internal HTTPS SEO API.
4. Build using the repository Dockerfile. Check GET /health = 200, GET /ready = 200, and GET /v1/sites without a valid token = 401. Test real database reads/writes and cross-tenant access before production launch.
5. Merge the separate V1 dashboard integration PR following V1's coordinator rules. Do not replace TAKATAK's existing /dashboard/seo audits or rankings pages.

## Safety and scope

Only independent editorial outreach, relevant content and compliant citations; no purchased link packages or automated manipulative reciprocal links. Search Console measurements are evidence-backed, not invented. Do not expose cross-tenant metrics. Store service role secrets server-side only.

See docs/ROADMAP.md for the remaining phases and production prerequisites.

## Abuse prevention and complete schema readiness

The Node service applies per-process authenticated request quotas: read 120/minute, write 30/minute and trusted Search Console ingestion 8/minute per tenant and signer. The API returns HTTP 429 and Retry-After when exceeded. These process-local limits are not an organization-wide distributed quota; production should additionally apply Coolify/reverse-proxy or shared-store limits. The public `/ready` endpoint verifies required columns in all four SEO PostgREST tables, **including verification columns from SQL migration 0002**, without returning tenant records. It cannot report readiness before both migrations are present.
