# Deployment and verification — SEOTAKATAK

Source of truth: `takatakca/SEOTAKATAK` main. Read `deploy/COOLIFY.md` for the GitHub Action details.

## Prerequisites (currently not all configured)
1. Obtain owner approval to use an **existing or approved non-billable Supabase PostgreSQL** project; take a backup and review `sql/0001_seo_core.sql` then `sql/0002_domain_verification.sql`, then `sql/0003_brief_editorial_review.sql`, then `sql/0004_site_deletion_receipts.sql`, in that order. Do not apply to TAKATAK V1's live database without its release coordinator.
2. In Coolify (Contabo instance only after verifying its active hostname), configure one SEOTAKATAK Dockerfile application pointing to this GitHub repository `main`, Node 22 port 3000, HTTPS/valid TLS. Runtime env: `NODE_ENV=production`, `SEO_SUPABASE_URL`, `SEO_SUPABASE_SERVICE_ROLE_KEY`, `SEOTAKATAK_SIGNING_KEY` (random >=32 bytes; same shared secret in V1). Never put secrets in Git.
3. In SEOTAKATAK GitHub **Settings → Environments → production**, variable `SEOTAKATAK_COOLIFY_API_URL` (trusted Coolify HTTPS origin), variable `SEOTAKATAK_COOLIFY_APP_UUID`, variable `SEOTAKATAK_HEALTH_URL` (service HTTPS origin), secret `SEOTAKATAK_COOLIFY_API_TOKEN` (least-privilege API token).
4. In TAKATAK V1 runtime configure `SEOTAKATAK_API_URL` (service HTTPS origin) and matching `SEOTAKATAK_SIGNING_KEY`. GSC imports additionally require verified domain-linked Google service account access.

## Release / smoke
- Push to SEOTAKATAK main → SEOTAKATAK CI → only green CI triggers `.github/workflows/deploy.yml`. Coolify must not simultaneously auto-deploy before this gate.
- Script posts to Coolify /api/v1/deploy, polls exact deployment until success and checks `/ready` for `{ok:true,status:"ready",database:"reachable"}`. A missing variable or failed probe marks the deployment failed, **not skipped success**.
- `curl -fsS https://<approved-service-host>/health` should return ok/service.
- `curl -fsS https://<approved-service-host>/ready` must prove DB reads, not just TCP up.
- Unauthorized `GET /v1/sites` must respond **401**; with signed scoped V1 token, authorized current workspace should see only its records; second workspace must see **no** first-workspace rows.
- In TAKATAK V1 `/dashboard/seo/portfolio`, add site for a permitted client, ensure isolation, link a *verified* Search Console domain, perform one real import and validate values.
- Verify exact running release SHA through your container/image metadata and Coolify deployment record. The CI-gated deployment script now rejects a Coolify deployment whose reported \`commit\` differs from the exact verified GitHub Actions SHA. Confirm the container is healthy and cross-tenant tests pass as well; API metadata alone does not prove application behavior.

## Latest known deployment failure
CI for previous backend revisions passed. Coolify deployment job for SHA `9488b43e` failed on **missing production setting COOLIFY_API_URL**; subsequent jobs also cannot launch without administrator configuration. No actual service deployment or database migration has been verified. Do not invent hostnames, secret values or availability.

## Rollback
Use Coolify's previously verified image/commit if available; never roll back DB blindly. Protect database with a backup and migration approval. Verify /ready, API permissions and TAKATAK V1 bridge after rollback.

### Immutable-release SHA guard

The workflow supplies `EXPECTED_COMMIT_SHA` from its successful CI run to `scripts/deploy-coolify.sh`. The script checks Coolify `GET /api/v1/deployments/{deployment_uuid}` and requires the returned `commit` field to equal that exact SHA before considering the release successful. Missing or different metadata fails closed. API contract: https://coolify.io/docs/api/endpoints/deployments/get-deployment-by-uuid.

### DNS verification acceptance test (after database approval)

For a domain you control, register it under the authorized TAKATAK client workspace and start a DNS challenge in `/dashboard/seo/portfolio/{siteId}`. Publish the exact TXT host/value in your DNS provider. Before propagation, `/verification/check` must fail without recording proof. After TXT propagation, the API should return `verified:true` with `verifiedAt`, redact `verification_token` in `GET /v1/sites` and deny all challenge mutations to users without `seo:manage`. A second TAKATAK workspace must receive 404 for the first workspace site. The initial database (0001) alone is insufficient for these new endpoints; missing columns are an operator-visible 503, never silently treated as verification.

### New readiness and quota acceptance

The SEO application's `/ready` now requires both migrations 0001 and 0002 and all four data tables. Apply these only after documented owner/DB-coordinator approval. Before enabling public traffic, verify a missing column produces HTTP 503, while the fully migrated database produces HTTP 200 with `{ok:true,status:"ready",database:"reachable",schema:"verified"}`. Confirm real client A and client B remain isolated and repeated authenticated requests return HTTP 429 with Retry-After; configure shared edge limits separately for multi-instance deployments.

### Controlled deletion smoke on an approved staging workspace

After migration approval and a **live** SEO service deploy, create a disposable domain/site under staging tenant A and add a draft, a prospect and a query import. First confirm a viewer's `DELETE` returns 403, another tenant's manager gets 404, and a wrong domain or unchecked acknowledgment returns 400. With the correct typed hostname and independent acknowledgment, verify a manager's `DELETE` returns `{ok:true,deleted:true}`; subsequent reads show no site and no child SEO records. Confirm that the central TAKATAK client account still exists. Do not perform this destructive smoke on a customer's production website.

### Readiness probe concurrency acceptance

The backend now collapses many simultaneous `GET /ready` calls to one set of four PostgREST schema requests. It caches ready for 10 seconds and unavailable for 5 seconds, per running instance. After migrations are applied, confirm a valid /ready response and that an intentionally unreachable PostgREST host causes 503 (and recovers after the short failure TTL). This is load-shedding, not a distributed rate limiter.

### Migration 0003 and editorial review smoke (owner-approved staging only)

Review and apply `sql/0003_brief_editorial_review.sql` strictly after 0001 and 0002. Back up the database before changes; validate that existing draft records satisfy the new constraints. A 200 /ready now requires `reviewed_at`, `reviewed_by` and `review_note` columns on `seo_briefs`. Create an original draft in a disposable client workspace; a manager can approve it or reject it with at least 10 characters of explanation, and only one decision can succeed because the PostgREST PATCH contains `status=eq.draft`. A second decision must return 409. A read-only client or manager of another workspace cannot review the draft. Confirm a draft becomes a reviewed editorial plan, **never a published CMS article**, and that list responses do not leak the reviewer profile ID.

### Tested SQL migration chain (GitHub CI)

The non-production `scripts/test-sql.sh` boots `postgres:16-alpine` on the GitHub runner and provisions the standard Supabase-specific `anon`/`authenticated` roles **inside this disposable container only**. CI then executes migrations `0001`, `0002`, `0003` and a transactional `tests/sql/schema-smoke.sql` to validate foreign keys, review constraints and SEO-site deletion cascading. This test passed as part of `38842836948`. It does not provision/alter the owner database, and cannot substitute for real migrated PostgREST `/ready`, RLS, auth and two-client smoke checks.

### Private SEO JSON export acceptance (approved staging only)

On a disposable client A site with at least one content draft, prospective backlink and Search Console import, verify `GET /v1/sites/{id}/export` yields a `format:seotakatak-site-snapshot` JSON object, no `verification_token`, `verification_issued_at`, `reviewed_by` or service secret fields, and `coverage.guaranteedComplete:false`. A signed client B token must get 404; an import-only token must get 403. Via V1 `/dashboard/seo/portfolio/{siteId}`, download the `snapshot.json` attachment, with `Cache-Control: private, no-store` and no browser-visible backend signing secret. Records are bounded at 200 per collection and are NOT a complete account backup. No production customer records were exported in CI.

### Paginated workspace export smoke (approved staging only)

With approved database migrations, create two distinct clients A/B with sites, briefs, prospects and opportunities. Request `GET /v1/workspace/export?collection=sites&offset=0` under a signed client A view token; data must contain only A records, `pageSize=200`, `hasMore` and `nextOffset`. Repeat independently for the other three collections, changing `offset` until `hasMore=false`. Client B must never receive A records. Unknown collections, malformed offsets and import-only scopes must fail; exported JSON must omit verification-token and reviewer-ID fields. V1 `/dashboard/seo/exports` must require the active client and `view_reports`, offer per-page private/no-store attachment downloads, and show the nontransactional warning. This validation is **not completed on live production**.

### Database privilege smoke checks

Isolated SQL CI asserts that every SEO table has PostgreSQL row-level security enabled and that temporary `anon`/`authenticated` roles cannot directly SELECT/INSERT/UPDATE SEO data. These assertions pass on a disposable PostgreSQL 16 schema; they **do not prove permissions of the owner-approved real Supabase project**. After approval and migration 0001→0002→0003, repeat `pg_class.relrowsecurity` and `has_table_privilege` checks against live deployment under authorized DB admin, then run real client A/B negative tests. Do not share service-role credentials in logs.

### SQL migration 0004 + deletion receipt verification (approved staging only)

After the DB owner approves and applies 0001→0002→0003, review/backup then apply 0004. The container CI applies all four SQL files and checks privileged function EXECUTE grants, tenant isolation, invalid-domain negative attempts, same-transaction receipt+delete, child-row counts and no duplicate receipt. The production `/ready` now requires the fifth SEO table (`seo_site_deletion_receipts`), so a pre-0004 DB intentionally fails readiness. On disposable staging data, test that a manager deletion returns an operational receipt identifier, counts match child SEO rows, subsequent site reads return 404, duplicate deletes do not create receipts, another client's manager cannot see receipts, and read-only users receive 403 at `GET /v1/workspace/deletion-receipts`. Also inspect real SQL RPC grants and verify anon/authenticated cannot execute it; keep the authenticated actor only in restricted DB rows. Never perform destructive acceptance testing against a customer's production site. V1 draft PR #196 displays the manager's own receipts after authorization, but must not be merged/deployed by this agent.

### Operational diagnostics acceptance (after approved Coolify rollout)

Request `GET /health`, `GET /ready` and a signed tenant API operation; each should emit a distinct `X-Request-ID` UUID. Inspect Coolify logs to ensure there are corresponding `http_request` JSON records containing only `routeGroup`, `method`, `status`, `durationMs` and the request ID. No JWT, raw URL/Google query, customer identifier, request body or IP address should be logged. Unexpected handler failures should result in 503 `service_unavailable` without stack traces in client responses. Tests validate the logger in CI, but central monitoring and alert routing require separate approved infrastructure. Existing SEO production deployment is still **not verified**.

### PostgREST memory guard acceptance

CI regression tests now prove oversized UTF-8 JSON responses and endless upstream streams are stopped/cancelled after a hard 1 MiB boundary, with normal bounded JSON responses unaffected. In approved staging, monitor container memory and error response when the database/API returns an unexpectedly large collection; prefer paginated routes for complete exports, as ordinary collection reads remain capped at 200 rows. Normal site/opportunity/prospect/brief reads request only public SELECT fields; DNS verification uses privileged site-specific fields separately. These tests are not proof of a running SEO production deployment.
