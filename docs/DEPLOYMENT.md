# Deployment and verification — SEOTAKATAK

Source of truth: `takatakca/SEOTAKATAK` main. Read `deploy/COOLIFY.md` for the GitHub Action details.

## Prerequisites (currently not all configured)
1. Obtain owner approval to use an **existing or approved non-billable Supabase PostgreSQL** project; take a backup and review `sql/0001_seo_core.sql` and the newer `sql/0002_domain_verification.sql` migration, in that order. Do not apply to TAKATAK V1's live database without its release coordinator.
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
