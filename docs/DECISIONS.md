## 2026-10-28 — Merchant API replaces sunset Content API

Google's Content API for Shopping reached its sunset on 18 August 2026. New Free Listings integrations use official `merchantapi.googleapis.com` Merchant API v1; references to Content API v2.1 in older field guides are superseded. Source https://developers.google.com/shopping-content/guides/deprecation-and-sunset and https://developers.google.com/merchant/api/reference/rest . Accounts, brand-specific feeds, GBP profiles and master catalogue described in `docs/TAKATAK_FIELD_STATE.md` already exist on the field side; this repository only has documentation until integration code is committed. OAuth must be merchant-specific and server-only, attached to the signed TAKATAK workspace, never a single shared account. No "connected" designation without an actual successful Merchant API response for the matching merchant. Google free listing eligibility and appearance are distinct and never guaranteed. TAKATAK V1 controls identity and deployment to its own main.

# Architecture and operational decisions

| Decision | Reason |
|---|---|
| Identity master = TAKATAK V1 | TAKATAK V1 owns clients, Supabase session, memberships, permissions and active workspace; SEOTAKATAK does not register or authenticate end users. |
| Separate Node 22 API deployed in Coolify | Independent releases and possible standalone resale while preserving TAKATAK customer relationships through API. |
| Signed 60-second server-to-server HS256 JWT | `iss=takatak-v1`, `aud=seotakatak`, strict tenant UUID and least-privilege permissions. Never accept tenant ID directly from browser/form. |
| `seo:view`, `seo:manage`, `seo:import` scopes | Only TAKATAK's server-side verified Google integration may submit Search Console values; ordinary client managers cannot falsify rankings. |
| PostgREST server-side with service role only | No service key or anonymous SQL endpoints exposed in the web app. All API queries include a token-derived tenant filter; DB schema also enforces tenant/site FKs and RLS. |
| Reporting calls out bounded samples | Initial API reads max 200 rows per table; never claim sample aggregations are all-time statistics or an AI ranking. |
| Editorial-only link prospect workflow | Backlinks never marked earned without independent evidence; reject mass link-exchange/purchase schemes. |
| Google Search Console first, real providers next | Use V1's already verified GSC properties, avoid redundant OAuth identity systems. |
| Migration/release gates remain | Owner approves database provisioning/migration; V1 coordinator alone merges/deploys V1. A CI-passing branch isn't live production. |
| No autonomous agent reactivation declared | GitHub CI can run unattended but cannot itself resume open-ended coding; any true agent scheduler needs explicit outside orchestration. |

## Domain ownership verification (2026-10-15)

A registered site is **unverified** by default. Only an authorized TAKATAK V1 integration manager can ask SEOTAKATAK to create a cryptographically random 64-hex-character DNS TXT challenge and check the externally published TXT record. The exact record name is `_seotakatak.<site-domain>` and the value begins `seotakatak-verify=`. Challenge expires after 7 days; regenerating invalidates the previous proof. The verification write requires both the signed workspace and the original challenge token in the database filter to prevent a concurrent rotation from being falsely approved. Challenge secrets never appear in general site listings or read-only API results. Verified ownership is necessary infrastructure for future publishing and must not be conflated with granting any publishing capability today. Database migration needs owner approval.

## API abuse prevention and readiness

Use a small, deterministic, process-local authenticated rate gate with independent read, write and trusted-Google-import budgets. It is testable without network dependencies and fails with HTTP 429 + Retry-After. It is **not** a substitute for global edge or distributed quotas once replicas are deployed. `GET /ready` checks the full required PostgREST schema, including DNS ownership migration 0002, with `limit=0` so it never reads customer records. An incomplete migration returns HTTP 503 and blocks the CI-gated Coolify release instead of appearing healthy.

## Controlled SEO-site erasure and retention boundary (2026-10-15)

An authorized manager may irreversibly remove a single SEO site by submitting `DELETE /v1/sites/{id}` with both `confirmDelete:true` and `confirmDomain` equal to the site's stored hostname. The server derives tenant from a signed TAKATAK token, loads the site under that tenant, and performs an identically scoped SQL DELETE. Existing `ON DELETE CASCADE` references remove SEO opportunity, prospect and editorial-brief rows; TAKATAK V1 retains all master accounts and membership. The browser's typed confirmation is a UX safeguard, never a substitute for server-side role/tenant enforcement. A separate retention and evidence-erasure policy still requires owner approval; do not claim one-site deletion covers the entire ecosystem.

## Public readiness load-shedding

`GET /ready` remains public for infrastructure health checks. Each Node process now caches a successful schema probe for 10 seconds and a failing probe for 5 seconds; overlapping checks share one pending operation. Negative cached checks remain 503. This does not conceal a failing schema indefinitely and prevents untrusted traffic from initiating four PostgREST requests per HTTP request. A separate shared/edge rate limit is still required for multi-instance deployment.

## Human-only editorial review

A content brief starts as an unpublished draft. An authorized workspace manager may issue one signed `PATCH /v1/sites/:siteId/briefs/:briefId/review` transitioning `status=draft` to `approved` or `rejected`. The database stores the signed TAKATAK profile ID, review timestamp and optional decision note; rejection requires a reason. The tenant/site/brief AND draft status appear in the same atomic PostgREST filter. General readers see state and note, not the profile identifier. Review decisions are final unless a future expressly approved amendment workflow is added. Approval is for planning only, with no CMS API, posting, monetization or generated article. Migration 0003 is mandatory and requires owner approval.

### Schema validation without production risk

Before an approved migration is applied, every source change must pass GitHub's disposable PostgreSQL 16 migration smoke. Vanilla Postgres does not provide Supabase's `anon`/`authenticated` roles, so only the throwaway CI container bootstraps them. Database schema tests use a rollback transaction and cover cross-tenant composite FKs, editorial status invariants and cascading data deletion. No release agent executes this script against production. It cannot validate live Supabase configuration or replace owner approval.

## Scoped customer data portability (2026-10-15)

An authorized TAKATAK reader may obtain a bounded JSON snapshot for one SEO site only. The SEO API derives tenant scope exclusively from verified TAKATAK JWT, checks site ownership and explicitly allowlists exported site, opportunity, prospect and brief fields to exclude DNS TXT secret challenges, reviewer internal identifiers and any future unrecognized columns. The V1 signed proxy requires `view_dashboard` + `view_reports` in the active client workspace. The JSON snapshot is capped at 200 rows per collection and ALWAYS reports `guaranteedComplete:false`; a 200-row collection sets `limitReached` to indicate possible omissions. This is **not** a complete GDPR/Quebec privacy-access response or TAKATAK master identity export; a paginated full-workspace export requires separate work and a written retention policy.

## Paginated workspace portability

Provide four separately pageable SEO collections (`sites`, `opportunities`, `prospects`, `briefs`) via `GET /v1/workspace/export`, with `offset` 0–1,000,000 and a fixed 200-row page size. The backend always derives `tenant_id` from a verified TAKATAK JWT and queries only allowlisted fields: site ownership/DNS secrets and reviewer profile identifiers are not exported. PostgREST selects `id.asc` and fetches 201 rows to indicate the next page. Each page is **not transactionally consistent with other pages**; it may differ if records are created or deleted while exporting. This is a data portability feature, not a certified full GDPR/Quebec-law disclosure, backup, or account erasure, and does not modify TAKATAK master identity.

## Database access-control invariants

The SEO backend uses a server-only service role with mandatory tenant filtering; browser-originated `anon`/`authenticated` must not receive table privileges on `seo_sites`, `seo_opportunities`, `seo_prospects` or `seo_briefs`. GitHub CI checks each table's `relrowsecurity` and denies role privileges in a temporary PostgreSQL 16 container. These are preflight tests, not live Supabase permission checks. Existing production security remains unverified until approved deployment and negative access tests.

## 2026-10-16 — Atomic deletion receipts, not a regulatory seal

Site deletion must not succeed unless an operational receipt was inserted in the same PostgreSQL transaction. SQL 0004 defines `seo_site_deletion_receipts` with tenant/site identity, hashed domain, server-verified actor, timestamp and dependent row counts. `seo_delete_site_with_receipt` uses SECURITY INVOKER, tenant/site/domain checks and `FOR UPDATE` site locking; DELETE cascades are atomic with receipt insertion, eliminating a "deleted without audit" window. The public API exposes only receipt UUID, site UUID, timestamp and counts; no actor, DNS secret or original deleted domain. Reads require `seo:manage` and current TAKATAK tenant. SQL restricts RPC EXECUTE to `service_role`, not public, anon or authenticated. The long-term receipt retention, subject-access policy, backups and cross-product erasure rules still require owner/legal review. Neither immutability against database superusers nor regulatory certification is claimed. Migration 0004 is not approved/applied to live DB.

## 2026-10-16 — Defensive API serialization and operational diagnostics

Because the SEO PostgREST service role can see all table columns, external API responses must use explicit public field allowlists on every site, opportunity, prospect and content-brief view/create/update/review route. New privileged columns are private by default. Every HTTP response gets an unguessable request UUID returned in `X-Request-ID`; structured logs include only category-level routing, method, status and elapsed time. We intentionally exclude headers, JWTs, tenant identifiers, source URL/queries, request bodies and client IPs to avoid a new sensitive data store. Unexpected dispatch failures produce safe 503 responses without stack traces. Do not claim that standalone application logs constitute central monitoring, or that operational receipts constitute legal erasure certification.

## Streaming PostgREST response limits and least-data reads (2026-10-16)

Any backend HTTP response body from PostgREST is untrusted until its bytes have been bounded. A 1 MiB cap is enforced **while streaming**, and the reader is cancelled immediately when the threshold is exceeded, even if Content-Length was absent or misleading. This bounds response allocation and prevents UTF-8 multibyte evasion of a JavaScript string-length test. Normal user-visible list functions use explicit SELECT allowlists before data leaves PostgREST. Only the site-specific owner verification path may request sensitive DNS verification fields; these remain omitted from external API responses. Do not infer full dataset completeness from ordinary 200-row lists.

## Shared rate limiting, signed actors and SQL 0005 (2026-10-16)

Rate protection must be correct even if several copies of the SEO API run behind Coolify. Keep the local 120/30/8 per-minute actor/tenant quota to stop immediate bursts, but also require server-only `seo_consume_api_quota` in PostgreSQL for every locally admitted authenticated API operation. The RPC binds the verified TAKATAK `tenant_id`, the hash of the signed JWT profile subject, and read/write/import operation bucket in a unique key with an atomic update and database-timed 60-second window; SQL hardcodes quota sizes, not client input. Failure to reach the shared quota rejects the request with 503, while exhausted quota returns 429 and Retry-After. No secret JWT or raw subject is stored in the counter table. The counter's hashed identifier still needs owner-approved retention controls and does **not** provide a global per-company budget, edge/DDoS protection, billing metering or regulatory identity erasure. RLS and absence of direct browser RPC grants are CI-verified. Migration 0005 requires owner permission; production remains blocked.
