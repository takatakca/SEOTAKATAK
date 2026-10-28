## 2026-10-28 — Merchant API v1 backend probe, not a live merchant connection

Implemented `src/merchant.mjs` (official Google Merchant API v1 GET account + processed product statuses; bounded read-only response and strict safe URL/token validation). `POST /v1/sites/{siteId}/merchant/inspect` requires the **signed** `seo:import` permission, `merchant_account_id` claim minted by trusted V1 backend, tenant-owned SEO site and its verified DNS challenge, plus a short-lived Google OAuth access token supplied by the V1 server. The API calls Google directly only when those prerequisites pass, returns provider-measured status/diagnostics and never stores OAuth token, account or feed data. Tests use controlled provider mocks, with negative wrong tenant/scopes/account/site checks. No actual merchant account was connected or probed. Commits `bc91d5a9` and `65a0fe50`; full CI `40740549546` success. Coolify deployment `40740617448` failed on missing `COOLIFY_API_URL`. Additional V1 OAuth mapping and owner approvals are required; this feature is not live or in V1 dashboard yet.

## 2026-10-28 — Actualisation GitHub + Drive

Dernier SHA vérifié avant reprise: `711c64a1337cf265a368c8a3f7173698c6f303a9`, CI verte `40297914773`, déploiement Coolify échoué `40297957121`. PR V1 #196 ouverte, non fusionnée. Les nouveaux guides terrain (`TAKATAK_FIELD_STATE.md`, `FREE_LISTINGS_CONNECTION_GUIDE.md`) proviennent du commit du 26 octobre, confirmé par la note Drive correspondante. Aucun moteur Free Listings local signalé sur Drive n'a été retrouvé dans le dépôt distant; ne pas confondre dossier local `~/workspace/free-listings-engine/` et code GitHub publié. L'ancienne Content API for Shopping est périmée depuis le 18 août 2026; Merchant API v1 remplace cette intégration. OAuth et accès marchands réels restent à vérifier. Aucun déploiement opérationnel ni marchand « connecté » attesté.

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

### HTTP request-size hardening (2026-10-15)

`src/server.mjs` now measures JSON upload size using raw bytes, preventing multibyte UTF-8 content from exceeding the 64 KiB cap undetected. Latest CI after this change is pending; earlier backend CI `38800026740` was green. TAKATAK V1 PR #182 CI `38800217288` passed, but PR remains open and neither production deployment is verified.

### Data lifecycle / client-owned site removal (2026-10-15)

- Server accepts a JSON DELETE for `/v1/sites/{id}` only with a signed `seo:manage` token, matching tenant ownership, `confirmDelete:true` and the exact registered domain in `confirmDomain`.
- `seo_sites` is removed through a tenant-filtered PostgREST DELETE. Migration 0001 already defines foreign-key `ON DELETE CASCADE` for opportunity, backlink prospect and content-brief records. This never deletes the TAKATAK identity/client workspace.
- Backend API and actual Node HTTP regression tests passed CI at `6308c81fd97156dab620690bd5fbb629875299c0`, run `38841219269`. Production remains not verified (Coolify GitHub environment missing `COOLIFY_API_URL`).
- TAKATAK V1 PR #182 adds destructive-action UI with required typed domain + acknowledgment. Its CI must be checked before coordinator review. This feature does not implement full GDPR erasure of other TAKATAK product records.

### Public readiness hardening (2026-10-15)

The public `/ready` endpoint now coalesces concurrent PostgREST schema checks into one four-table probe. Successful checks cache for 10 seconds; failed checks for 5 seconds, always responding unavailable on a cached failure. This reduces unauthenticated database-request amplification, but is not a global edge rate limiter. Backend SHA `220902cd67211aabbbe8c9bb380b722072883878` passed `SEOTAKATAK CI` run `38841642177`; following Coolify deploy `38841667084` failed without configured deployment settings, not because of test failures.

### Original content brief review — 2026-10-15

A client workspace manager can move an unpublished SEO content brief from `draft` to `approved` or `rejected` once. The signed server authenticates the reviewer; the PostgREST PATCH constrains tenant, site, brief ID and `status=eq.draft` in one atomic update. Rejections require a meaningful reason; reviewer identity is saved server-side but omitted from the general list response. An approved **editorial plan is not a published article**. SQL `0003_brief_editorial_review.sql` is a proposed, *unapplied* migration adding review fields, constraints and allowed statuses; readiness now requires its columns. A coordinator must approve migration order 0001→0002→0003 before a live /ready can pass. Backend CI passed on implementation SHA `3fc053d3`, run `38842223371`; subsequent immutable-review tests must still be checked.

### PostgreSQL integration validation in GitHub Actions (2026-10-15)

Isolated Postgres 16 migrations `0001→0002→0003` have now been executed successfully in CI; the test checks a real database against tenant/site FK separation, editorial reviewer metadata/rejection constraints, and cascade deletion of SEO child rows. GitHub CI **passed** SHA `9df805b778b98504036490fa5bd0a8a91d28ab30`, run `38842836948`. The temporary CI container creates Supabase-like test roles; it is not a replacement for real Supabase RLS/security validation or an approved production migration. The production Coolify blocker still exists.

### SEO site privacy export (2026-10-15)

Implemented `GET /v1/sites/:siteId/export`, secured by the same signed TAKATAK tenant and `seo:view` scope as other site reads. The returned `seotakatak-site-snapshot` includes site metadata and sampled opportunities, prospects and content briefs; fields are explicitly allowlisted, excluding DNS verification challenges, reviewer profile identifiers and unrecognized private database columns. Each collection has a 200-row read ceiling and an explicit `coverage.guaranteedComplete:false` / `limitReached` marker: it is **not** claimed to be a full export or a complete measurement history. The V1 bridge additionally requires `view_reports` and an authorized active workspace. Backend feature SHA `24b2c1b4a214f806cd6707529ed690455420f6bd`, GitHub CI `38843705978` **PASSED**; V1 PR #182 new CI must be checked. No production data exported.

### Paginated workspace data export (2026-10-15)

In addition to per-site partial snapshots, the API implements `GET /v1/workspace/export?collection={sites|opportunities|prospects|briefs}&offset=N`. Each call is signed and tenant-scoped, with 200 records/page and a 201st-row lookahead to determine `hasMore` and `nextOffset`. PostgREST uses stable `id.asc` and an explicit SELECT allowlist *at the database query*, so DNS TXT challenge values, internal reviewer profile IDs and future private columns are never requested. The V1 PR #182 has a workspace export dashboard and authenticated downloads; users must traverse every page/collection. Pages are nontransactional and changes between pages may alter coverage; the system is not a legally complete cross-product erasure/export service. CI passed code SHA `fd0ff79f82fd29277a0c3c968c67ea0f50f5a498` in run `38844277527`. Production deployment remains unverified.

### PostgreSQL permissions CI and API pagination HTTP checks (2026-10-15)

The existing disposable Postgres migration test was strengthened to verify `relrowsecurity=true` and denial of direct SELECT/INSERT/UPDATE privileges to Supabase-style `anon` and `authenticated` test roles across all four SEO tables. Also expanded live Node HTTP tests to verify malformed signed workspace-pagination queries are refused. Both checks passed along with SQL migrations 0001→0003, Node unit/integration tests and Docker build at **`c6f65e803edb1d96aede633b2edd848fc84c85d3`**, GitHub CI **`38844898256`**. The release pipeline remains separate; it has never been verified live.

## 2026-10-16 — SQL-backed, tenant-scoped SEO deletion receipts

SEOTAKATAK now uses a new proposed migration `sql/0004_site_deletion_receipts.sql`. The server calls `public.seo_delete_site_with_receipt`, a PostgreSQL SECURITY INVOKER, server-only `service_role` function. The function locks the verified tenant-owned site, checks the requested domain, counts its existing child SEO rows, inserts an operational receipt with authenticated `actor_subject` and SHA-256 of the hostname (not plaintext), then deletes the site and cascades child rows atomically. Incorrect tenant/domain or a repeated deletion returns no success. The server exposes a sanitized receipt ID/UTC date/deleted counts; `GET /v1/workspace/deletion-receipts?offset=N` requires `seo:manage`, filters by the signed tenant and omits the actor. Normal site API serializers now allowlist fields rather than exposing future database additions. SQL 0004 was verified with a disposable PostgreSQL 16 database on backend SHA `02f2c0120f495a52b8ab42612676b8559ebb53d8`, CI `38883517261` **PASSED**; follow-up API/privacy CI must be checked. No owner-approved live migration was executed. TAKATAK V1 PR #182 was merged 2026-10-16, and new **draft** PR #196 adds a manager-only receipt UI on an isolated branch. No verified SEO production backend.

### Backend API privacy serializers and request diagnostics (2026-10-16)

Regular site, opportunity, prospect and content-brief API read/write responses now use explicit allowlists, protecting against accidental disclosure of `tenant_id`, internal `reviewed_by`, future private schema fields and verification challenge secrets. The Node HTTP entrypoint issues one random UUID `X-Request-ID` per response, emits only privacy-minimized structured request diagnostics (route group, status, latency, method, request ID), and returns a safe HTTP 503 on unexpected dispatcher exceptions without exposing user data or secrets. Code SHA `216b205b5096f1dcb424af8d6129f813f861d448` **PASSED** CI `38885007096`, including Node HTTP/unit tests, isolated PostgreSQL migrations 0001–0004 and Docker. There is no deployed/connected log aggregation or full operational alert system yet.

### Data adapter transport-memory safety (2026-10-16)

A 1 MiB PostgREST response limit is now enforced on the actual received UTF-8 bytes while consuming the stream. This avoids `response.text()` buffering oversized external responses before checking their length; oversized upstream streams are cancelled. Tests exercise an unbounded streaming source, Unicode payload and a bounded JSON response. Code SHA `c402191f` passed all GitHub CI at run `38941677513`. Follow-up SHA `d745f3ab` strengthens ordinary list queries to SELECT only approved non-secret fields at the database boundary; its CI was queued at this checkpoint. No SQL migrations or production data changed.

### Shared cross-replica SEO rate limiting (2026-10-16)

The backend now uses both existing process-local rate controls and an atomic PostgreSQL RPC shared across all replicas. Quotas are fixed per signed TAKATAK `tenant_id`, hashed actor, and read/write/import bucket: 120/30/8 requests per 60s. Shared counters use the PostgreSQL clock and a unique-key `ON CONFLICT` row update, preventing parallel app instances from each granting a separate allowance. The upstream quota fails closed if PostgREST is unavailable and returns 429 with Retry-After on depletion. New owner-review-required `sql/0005_shared_rate_limits.sql` grants RPC only to `service_role`, prohibits browser role table access, and makes `/ready` verify the sixth schema table. In disposable PostgreSQL CI, 20 simultaneous import calls for one actor gave exactly 8 admitted and 12 refused; separate tenants and actors do not share a counter. Code SHA `5274fb80` **PASS** backend CI `38942967374`. Real production DB/Coolify remains unconfigured; this is not yet a live distributed quota.
