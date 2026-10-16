# SEOTAKATAK — agent handoff (2026-10-15)

## Current GitHub and last completed task
- Repository: `takatakca/SEOTAKATAK`, branch `main`; TAKATAK V1 integration: `takatakca/takatak-v1` branch `feat/seotakatak-free-tools-20261015`, PR #182 (open, coordinator merge only).
- Last substantive implementation: dedicated `seo:import` scope, verified V1 Search Console server-side import, tenant-isolated bounded summary and CSV export with spreadsheet formula protection.
- Latest tested backend code SHA: **c1be583a1c18750cc4fd2c9dae49a54a87992ede** (CI run 38793391043 succeeded). To get the latest (including handoff docs), fetch main branch SHA; do not assume the code SHA equals the docs commit.
- V1 integration branch tested code SHA during handoff: **7a3aa013aa1d3ae25a10fb711f8237b2a1281a87** (PR #182; latest CI still pending).

## Current task
- Confirm the newly introduced backend/V1 CI runs are green; resolve any failure.
- Publish and maintain required project documentation; then resume independent tasks in `docs/TASK_QUEUE.md`.

## Files modified in resumed work
- SEOTAKATAK: `src/auth.mjs`, `src/app.mjs`, `src/server.mjs`, `tests/engine.test.mjs`, `README.md`; this docs set and `AGENTS.md`.
- TAKATAK V1 PR #182: `src/lib/seo/seotakatak-bridge.ts`, `src/app/dashboard/seo/portfolio/actions.ts`, `src/app/dashboard/seo/portfolio/page.tsx`.

## Checks and evidence
- GitHub CI backend at **c1be583a** passed, run **38793391043**; previous failing tests corrected (cross-tenant import test needed dedicated scope; CSV escaping test expected literal quote order).
- Prior V1 PR commit **7829963d** passed full CI run **38732237723**. Newest V1 PR CI is pending for the updated bridge/docs. Verify its terminal result and continue if failed.
- Run `npm run check`, `bash -n scripts/deploy-coolify.sh`, `docker build -t seotakatak:ci .`. GitHub CI executes all; no local production database was accessed.

## Known problems / deployment
- Production is **NOT VERIFIED / NOT LIVE**. Blocker recorded in [GitHub issue #1](https://github.com/takatakca/SEOTAKATAK/issues/1). Automatic Coolify job last confirmed failing because `COOLIFY_API_URL` was absent from GitHub environment. Domain, Supabase database, Coolify UUID/token and runtime secrets are not verified.
- No database migration applied. Backend schema is a proposal awaiting owner approval. Cross-tenant database smoke tests remain required.
- V1 PR #182 must be reviewed/merged/deployed by its authorized coordinator only.
- No AI provider-backed citation reporting, verified external backlinks, automated content publishing or scheduled imports yet.

## Required accesses without secrets
- Existing owner-approved Supabase project/DB role and migration approval; Coolify production application, HTTPS hostname, authorized token/UUID, GitHub environment variables; TAKATAK V1 coordinator merge/deploy approval.
- Do not create billable Supabase resources automatically.

## Exact next action
1. Read latest main SHAs, CI run results and PR #182. If either latest CI failed, open the failing job logs and fix on the owning repo branch.
2. Implement the next independent task from `docs/TASK_QUEUE.md` without waiting for Coolify credentials; run tests and push.
3. When an authorized admin configures Coolify/database, re-run the gated deployment; validate /ready and cross-tenant application flow before declaring production success.

**No external agent-restart orchestrator was configured or verified during this session.**

## Latest verified checkpoint (later on 2026-10-15)

- Backend HEAD code revision before this documentation update: **bde41fb788b7e239a1baf699469501d925d5edc3**; CI run **38794560027** passed with Node tests, mocked deployment SHA checks, bash syntax and Docker build.
- The downstream production job **38794610199** failed due incomplete Coolify release prerequisites; backend has **not** gone live. The exact human action is documented in [issue #1](https://github.com/takatakca/SEOTAKATAK/issues/1).
- The deployment runner now compares Coolify's returned `commit` field with the exact SHA validated by CI and also requires successful database-ready health. Neither check can substitute for supplying a real application and approved database.
- V1 PR #182 branch code reached **8cd20b5ef03797a328bbe7083f012ba69d605d49** with a verified-query table; latest full V1 CI is still running and V1 coordinator controls merge/promotion.
- **Next exact step:** check the latest V1 PR CI; if green, hand to designated coordinator; separately configure the Coolify and database values from issue #1, then verify the deployed SHA and two-client tenancy.

## Latest 2026-10-15 checkpoint: domain ownership

- **Last completed code**: `4bcdc57c769ba92228e8c98090180a85c904d2bf` — backend DNS verification, ownership-token redaction, SQL migration 0002 and tests. GitHub CI **passed** at run `38798985084`. Subsequent deploy run `38799021739` failed because Coolify production is not configured.
- **Files modified**: `src/verification.mjs`, `src/app.mjs`, `src/store.mjs`, `tests/verification.test.mjs`, `sql/0002_domain_verification.sql`, `package.json`, readme and docs. TAKATAK V1 PR #182 branch adds signed DNS bridge, server actions and TXT instructions UI.
- **Commands/verification**: GitHub Actions ran `npm run check`, `bash -n scripts/deploy-coolify.sh` and `docker build -t seotakatak:ci .` on code SHA `4bcdc57c`. DNS tests include manager permissions, cross-tenant refusal, TXT matching, expiry, concurrent rotation and no token leak to viewers.
- **Ongoing task**: verify full V1 PR CI after DNS UI update; fix any typecheck/build/contract issues on the PR branch, then hand green PR to the designated V1 coordinator.
- **Production**: NOT LIVE. Owner-approved existing database and migration 0001 + 0002, Coolify app/tokens/HTTPS, V1 runtime settings and coordinator release are still required. All specifics tracked in SEOTAKATAK issue #1; no secret value is documented here.
- **Exact next action**: retrieve new GitHub branch SHA + CI run, inspect failures if any; once green, test real DNS proof after owner-approved DB migration and Coolify deployment. Continue independent work from TASK_QUEUE without inventing deployments.

## Latest checkpoint — rate limits and schema readiness (2026-10-15)

- **Last completed code SHA**: `c1d7861fe731d0fd7b14ac6cddcea8e8c3e5ab6d`. Backend GitHub CI **passed** in run `38799814574`; subsequent production job `38799844905` **failed** on the previously known missing Coolify production settings.
- **Files changed**: `src/rate-limit.mjs`, `tests/rate-limit.test.mjs`, `src/app.mjs`, `src/server.mjs`, `src/store.mjs`, `tests/store.test.mjs`, `tests/engine.test.mjs`, `package.json`. Verified with GitHub `npm run check`, bash syntax and Docker image CI. No real database migrated or provisioned.
- **Rate limits**: 120 GET/min, 30 writes/min, 8 trusted Search Console imports/minute per workspace+user on each Node process; HTTP 429 with Retry-After. Not a global cross-instance quota; a production proxy/shared quota is still required at scale.
- **Readiness**: `/ready` validates PostgREST's required columns on sites (including migration 0002), opportunities, prospects and briefs with limit zero. It now fails 503 before migrations are applied. Test the real deployed database before go-live.
- **V1 integration**: PR #182 includes DNS ownership challenge UI and a real content-brief draft form; latest full V1 CI must be verified and merger is coordinator-only.
- **Access blocker**: Owner-approved non-billable existing DB, migration approval, Coolify application/HTTPS/UUID/token and V1 runtime secrets; see SEOTAKATAK issue #1. No secrets are in the repository.
- **Exact next action**: check the newest V1 PR CI logs and fix failing tests; get coordinator approval for PR #182. Separately obtain infra admin settings from issue #1, apply approved SQL 0001+0002, validate the endpoint /ready and two-client DNS/SEO smoke, then verify deployed SHA. No external coding orchestrator was configured.

## 2026-10-15 resumed security checkpoint

- **Last completed change:** request JSON body parser now counts incoming Buffer bytes, rather than JavaScript string characters, before enforcing 64 KiB limit. Files: `src/server.mjs`; commits `5f2af2c9`, `dab67f2b` on `main`.
- **Latest checked prior green CI:** backend SHA `78693972f24c0075c1df730ff26b699722e5d31a`, CI `38800026740` succeeded; associated Coolify deploy `38800109915` failed. New CI on `dab67f2b` was queued at this checkpoint; verify its final result before promotion.
- **V1 integration:** PR #182 head `27b5465280a840cee33b5998f9bb5dc7fdd1c5e8` passed full CI run `38800217288`, still open, coordinator-only merge/deploy.
- **Checks:** inspected GitHub source, latest branches, CI runs and deployment script; GitHub Actions will execute `npm run check`, Docker build and shell checks on the new code. No live database, secrets or production release accessed.
- **Blockers:** owner-approved DB/migrations 0001+0002, Coolify environment/token/UUID/HTTPS and V1 coordinator. Issue #1 tracks infrastructure. No external restart orchestrator configured.
- **Exact next action:** check latest backend CI; if green, proceed with independent work on shared quota/audit retention or backlink verification; obtain approved infrastructure and perform live /ready, two-tenant and deployed SHA checks before declaring production.

## 2026-10-15 verified continuation — testable site deletion

- **Last completed task:** scoped irreversible deletion of a tenant-owned SEO site including its dependent SEO rows (existing SQL foreign keys) with a literal domain confirmation and an explicit approval boolean. Node API and real HTTP tests are included.
- **Last substantive tested commit:** `6308c81fd97156dab620690bd5fbb629875299c0`, CI **passed** `38841219269`. Current branch head after this handoff commit must be read from GitHub; do not mistake the code SHA for the docs SHA.
- **Files touched this session:** `tests/http.test.mjs` (real HTTP checks), `src/app.mjs` (DELETE validation), `src/store.mjs` (tenant-filtered DELETE), `src/server.mjs` (DELETE JSON reader), `tests/engine.test.mjs`, `tests/store.test.mjs`, `README.md`, and `docs/AGENT_HANDOFF.md`, `docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md`, `docs/DEPLOYMENT.md`, `docs/DECISIONS.md`, `WORKLOG.md`.
- **Verification:** GitHub `npm run check` (Node 22 syntax + tests), `bash -n scripts/deploy-coolify.sh` and `docker build` succeeded on the code commit; tested no auth 401, 64 KiB/multibyte HTTP 413, wrong deletion confirmation 400, read-only role 403, second tenant 404 and owner deletion 200. No real database was used for these tests.
- **In progress:** V1 PR #182 `feat/seotakatak-free-tools-20261015` adds form-based site removal; its head after feature work is `1f9d46bab1466147f852afc7e7fb06e54df522a5`, full V1 CI run `38841109038` was still in progress when last checked. The preceding V1 PR head `27b54652` passed CI run `38800217288`.
- **Deployment reality:** the latest tested backend production job `38841246305` failed; logs of preceding deployment `38841050904` explicitly show `Missing production setting: COOLIFY_API_URL`. No production/approved database has been provisioned or migrated. Issue `#1` documents configuration. V1 coordinator alone may merge/deploy PR #182.
- **Access required (do not print secrets):** approved existing/non-billable database plus permission for SQL 0001 then 0002, Coolify HTTPS application / UUID / scoped API token, GitHub environment settings, matching V1 signing keys and V1 coordinator release action.
- **Next exact action:** check V1 PR #182 CI for the removal interface and fix if it fails; if green, hand PR to authorized coordinator. Then implement independent privacy/audit tasks without inventing live providers. Only after infra approval, test real /ready, DNS TXT and two-client isolation plus deletion on disposable staging data, and verify deployed SHA. No restart orchestrator was configured.

## Latest verified backend security release checkpoint — 2026-10-15

- **Last task completed:** suppressed public /ready PostgREST request amplification using a per-store concurrent-promise single-flight gate, a 10-second success cache, a 5-second failure cache and fail-closed 503 on cached outage. Tests cover 40 concurrent probes and negative caching.
- **Last tested code SHA:** `220902cd67211aabbbe8c9bb380b722072883878`; GitHub Actions CI **passed** run `38841642177`; following Coolify workflow `38841667084` **failed** because production environment remains unconfigured. The next docs commit will move main again; inspect branch SHA before making updates.
- **Files modified in this continuation:** `src/store.mjs`, `tests/store.test.mjs` plus `docs/AGENT_HANDOFF.md`, `docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md`, `docs/DECISIONS.md`, `docs/DEPLOYMENT.md`, `WORKLOG.md`; in V1 PR #182, the portfolio bridge, portfolio actions/page, QA contract and handoff documents (details in V1 handoff).
- **Verified:** GitHub `npm run check` including live HTTP checks and store concurrency tests, bash syntax and Docker image build passed. No actual customer database was used; schema migration 0001+0002 remains unapproved.
- **Current task:** validate the full newest CI of V1 PR #182, then hand it to its designated coordinator for authorized review/merge/deploy. Do not touch V1 main or production.
- **Remaining blockers:** Coolify configuration / environment variables / token / HTTPS app, approved existing/non-billable DB and SQL migrations, V1 coordinator. See open SEOTAKATAK issue #1. No autonomous agent restart orchestrator is installed.
- **Next exact action:** read newest V1 PR head and full CI status; correct any failure. Once infrastructure owner configures GitHub production settings and applies approved DB migrations, use CI-gated deployment and verify same Git SHA, /ready, separate client A/B site records, DNS verification and staging-only deletion.

## Editorial workflow development checkpoint — 2026-10-15

- **Most recent implemented work:** immutable, human-only SEO brief review in `src/app.mjs` and `src/store.mjs`, tests in `tests/engine.test.mjs` and `tests/store.test.mjs`, proposed `sql/0003_brief_editorial_review.sql`. The signed actor is retained in the datastore and never exposed in list API. Reviewed briefs are not published.
- **Code SHA before this document commit:** `fc6120911ea2609620424c9ef382af0b91e02ec5`; previous feature SHA `3fc053d347b07e794cf9d4b8385620d77c201729` passed CI `38842223371`. Check latest CI for `fc612091` before release.
- **V1 PR #182:** editorial review UI, server action and signed bridge at branch `feat/seotakatak-free-tools-20261015`, code SHA `3c8912637fd4f827d443fe48f6c7a9a34f99d6a7`. Full newest V1 CI is in progress; preceding branch `18e846fd` passed full CI `38841472062`.
- **Production reality:** NO live SEO API confirmed. Coolify environment missing `COOLIFY_API_URL`, plus database migrations 0001, 0002 and now 0003 all require explicit approved database. Do not run SQL or change V1 production without V1 coordinator. See open issue #1.
- **Files affected:** backend app/store, engine/store tests, SQL 0003, five docs, README and WORKLOG; V1 bridge, site page/actions, SEO QA test and five V1 docs.
- **Tests/commands:** `npm run check`, `bash -n scripts/deploy-coolify.sh`, `docker build -t seotakatak:ci .` through GitHub CI; no live DB or provider external actions. Verify no second review, rejected note requirement, tenant isolation, and reviewed_by privacy in live staging.
- **Next action:** check backend CI for `fc612091` and V1 PR #182 newest CI; fix actual failing jobs. With both green, hand V1 PR to coordinator. Wait for approved migrations 0001→0002→0003 and verified Coolify settings before true deployment and multi-client smoke. No restart orchestrator is configured.

## 2026-10-15 real PostgreSQL CI release checkpoint

- **Last completed task:** added `scripts/test-sql.sh`, `tests/sql/schema-smoke.sql` and a GitHub CI step to execute migrations 0001→0002→0003 in a disposable PostgreSQL 16 container; proved editorial review constraints, tenant isolation FKs and cascade deletes without touching Supabase.
- **Last tested code SHA:** `9df805b778b98504036490fa5bd0a8a91d28ab30`, **CI PASS** run `38842836948`. The documentation commit that follows has its own newer SHA; check live GitHub branch HEAD.
- **Files changed:** SQL test script and smoke SQL, `.github/workflows/ci.yml`; `docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md`, `docs/AGENT_HANDOFF.md`, `docs/DEPLOYMENT.md`, `docs/DECISIONS.md`, `README.md` and `WORKLOG.md`. V1 PR #182 remains on separate feature branch, no V1 main commits or releases.
- **Commands verified by CI:** `npm run check` (Node/test suite), `bash -n scripts/deploy-coolify.sh scripts/test-sql.sh`, `bash scripts/test-sql.sh` (real SQL in Postgres), `docker build -t seotakatak:ci .`. CI initial attempts revealed and fixed a PostgreSQL startup timing race and missing Supabase roles in vanilla PostgreSQL.
- **Current task:** check latest V1 PR #182 full CI; its editorial-review UI SHA `3c8912637fd4f827d443fe48f6c7a9a34f99d6a7` and followup docs SHA `446053baff88534277f1e317d3e4fa74a18d3683` were still in CI during this checkpoint.
- **Actual deployment:** NOT live/verified. Backend production Coolify jobs still fail because GitHub production `COOLIFY_API_URL` and other required settings have not been configured. There is no approved real SQL migration or running SEO service. See issue #1.
- **Required approvals/access:** existing approved non-billable Supabase PostgreSQL project and migrations 0001/0002/0003, Coolify app/UUID/API token/HTTPS hostname, V1 coordinator-only PR merge/deploy. No secrets recorded; no restart agent configured.
- **Exact next action:** inspect newest V1 PR CI and fix any failure; request designated coordinator merge only after full green. Once infrastructure owner resolves issue #1, apply approved migrations and verify /ready + two tenant smoke + exact Coolify deployed SHA + disposable-site removal and human brief review. Continue other backlog items without invented provider data.
