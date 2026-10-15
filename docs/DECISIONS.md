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
