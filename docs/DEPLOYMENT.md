# Deployment and verification — SEOTAKATAK

Source of truth: `takatakca/SEOTAKATAK` main. Read `deploy/COOLIFY.md` for the GitHub Action details.

## Prerequisites (currently not all configured)
1. Obtain owner approval to use an **existing or approved non-billable Supabase PostgreSQL** project; take a backup and review `sql/0001_seo_core.sql`. Do not apply to TAKATAK V1's live database without its release coordinator.
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
