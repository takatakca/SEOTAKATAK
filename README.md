# SEOTAKATAK — Organic SEO Operations Engine

**GROUPE TAKATAK** · A tenant-scoped SEO backend built to integrate into the existing **TAKATAK V1** dashboard. TAKATAK Auth remains the identity and customer master. This service does not have a separate customer login.

## Features implemented

- Site registry per TAKATAK V1 client workspace (domain, niche, target market, locale)
- Real Search Console query import (clicks, impressions and position) with a transparent opportunity priority score
- Editorial backlink prospect management (identified, researching, contacted, declined; earned is reserved for future independently verified links)
- Original content brief queue requiring human editorial review
- 60-second signed JWT API authentication and read/manage scopes; tenant and site ownership enforced for every operation
- PostgreSQL schema, PostgREST service integration, Docker image and Node 22 tests

**Not implemented or verified yet:** Live Google OAuth ingest, verified backlink crawling, AI answer citation measurement, automated publication, email campaigns, live production database or Coolify deployment. No traffic or search ranking outcome is guaranteed.

## API

All routes under /v1 require a signed 60-second server-to-server token issued by TAKATAK V1 with issuer=takatak-v1, audience=seotakatak, sub=the authenticated TAKATAK profile ID, tenant_id=the selected and authorized workspace UUID, permissions=[seo:view,seo:manage]. All writes require seo:manage.

- GET /health (public liveness)
- GET /ready (database and signing configuration readiness)
- GET /v1/sites
- POST /v1/sites {domain,niche,market,locale}
- GET /v1/sites/:siteId
- GET /v1/sites/:siteId/opportunities
- POST /v1/sites/:siteId/opportunities/import {source:"search_console",rows:[{keyword,clicks,impressions,position}]}
- GET/POST /v1/sites/:siteId/prospects; POST {publication,url,relevance}
- PATCH /v1/sites/:siteId/prospects/:id/status {status}
- GET/POST /v1/sites/:siteId/briefs; POST {keyword,angle}

## Install & deploy

Requires Node 22. Run npm run check. No third-party NPM packages required.

1. Review and apply sql/0001_seo_core.sql to an explicitly authorized Supabase PostgreSQL project. This is a new schema: DO NOT change the TAKATAK V1 production DB without the database release coordinator approval.
2. Set all variables in .env.example as runtime secrets in Coolify, never at build time. The service role key must never be sent to a browser.
3. Set identical SEOTAKATAK_SIGNING_KEY in TAKATAK V1 and the SEO service. Configure SEOTAKATAK_API_URL in TAKATAK V1, pointing to the internal HTTPS SEO API.
4. Build using the repository Dockerfile. Check GET /health = 200, GET /ready = 200, and GET /v1/sites without a valid token = 401. Test real database reads/writes and cross-tenant access before production launch.
5. Merge the separate V1 dashboard integration PR following V1's coordinator rules. Do not replace TAKATAK's existing /dashboard/seo audits or rankings pages.

## Safety and scope

Only independent editorial outreach, relevant content and compliant citations; no purchased link packages or automated manipulative reciprocal links. Search Console measurements are evidence-backed, not invented. Do not expose cross-tenant metrics. Store service role secrets server-side only.

See docs/ROADMAP.md for the remaining phases and production prerequisites.
