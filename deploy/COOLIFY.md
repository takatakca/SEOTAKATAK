# SEOTAKATAK → Coolify production

Deploy repository takatakca/SEOTAKATAK `main` using the root Dockerfile (Node 22, port 3000). TAKATAK V1 retains login, authorization and the central dashboard.

Provision an approved PostgreSQL/Supabase database and apply `sql/0001_seo_core.sql` after database-owner approval. In Coolify set runtime secrets `SEO_SUPABASE_URL`, `SEO_SUPABASE_SERVICE_ROLE_KEY` and `SEOTAKATAK_SIGNING_KEY`. Never expose service keys in a browser or commit them.

For the SEOTAKATAK GitHub repository, Settings > Environments > production: set secret `SEOTAKATAK_COOLIFY_API_TOKEN` (Coolify deploy-scoped API token), and variables `SEOTAKATAK_COOLIFY_API_URL` (HTTPS origin), `SEOTAKATAK_COOLIFY_APP_UUID`, `SEOTAKATAK_HEALTH_URL` (SEO application HTTPS origin).

On a green CI run for main, GitHub Actions queues an authenticated Coolify deployment, polls the exact deployment and verifies `/ready` confirms database connectivity. The job fails visibly if secrets are missing, Coolify fails, or production is unhealthy. Turn off parallel auto-deploy on push in Coolify; don't bypass CI.

Configure V1 runtime `SEOTAKATAK_API_URL` (SEO app HTTPS origin) and the matching `SEOTAKATAK_SIGNING_KEY`. Test unauthorized GET /v1/sites → 401; approved TAKATAK client in /dashboard/seo/portfolio can list own sites; cross-tenant denied.

This pipeline does not auto-provision applications, domains, the database or secrets. These need administrator configuration before the first successful deployment.
