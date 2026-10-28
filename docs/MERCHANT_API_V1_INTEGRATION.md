# Merchant API v1 integration contract — SEOTAKATAK / TAKATAK V1

Last reviewed: 2026-10-28. Backend main is the source of truth; latest code CI 40740549546 PASSED at SHA 65a0fe5006ed72310ed1529ec1f8cf7e94441c63. These are **integration instructions, not proof of a live connection**.

## Official Google provider and surface

Google Merchant API, not the deprecated Content API for Shopping:
- Account GET: `https://merchantapi.googleapis.com/accounts/v1/accounts/{merchantAccountId}`
- Processed products GET: `https://merchantapi.googleapis.com/products/v1/accounts/{merchantAccountId}/products?pageSize=25`
- Per-merchant Google OAuth access token with authorized `https://www.googleapis.com/auth/content` scope.

Official: https://developers.google.com/merchant/api/reference/rest and https://developers.google.com/shopping-content/guides/deprecation-and-sunset (sunset 18 August 2026).

## Backend API and signed authorization

`POST /v1/sites/{siteId}/merchant/inspect` with JSON:
```json
{"oauthAccessToken":"SERVER_ONLY_EPHEMERAL_OAUTH_TOKEN","pageSize":25}
```

Optional `pageToken` comes directly from the previous Google response. The caller must be the trusted TAKATAK V1 backend, NEVER a browser or external consumer. This endpoint will return 401 without valid central JWT, 403 without `seo:import` or signed account binding, 404 for cross-tenant site, 409 for site lacking DNS proof, 502 for provider failure. Google 401/403 is returned as a safe 403 without copying upstream text. The existing shared `import` quota (8/minute per signed tenant/actor) applies.

The signed HS256 JWT must contain `iss=takatak-v1`, `aud=seotakatak`, `tenant_id=<current active client UUID>`, `sub=<authorized V1 profile UUID>`, `permissions=["seo:import"]`, `merchant_account_id="<owner-approved numeric MC account ID>"`, `iat`, `exp<=iat+60`. This claim is NOT sourced from arbitrary browser input: V1 must look up an existing, verified client/account association in its own trusted connection table. Do not expose refresh tokens, client secrets or service-role keys in HTML, logs or downloadable records.

The backend first checks tenant-owned site and verified DNS, then GETs the exact signed Google account and validates the returned `name`. Product rows, destination statuses and issues are selected from real provider JSON, without fabricated approval or an invented account connection. Opaque Google page tokens are bounded; responses cap at 50 products and 1 MiB per HTTP response. Provider calls do NOT create/update Merchant accounts, upload feeds, mutate inventory, buy ads or persist Google credentials in SEO DB.

## Remaining V1 implementation / staged acceptance

1. Confirm official Merchant API activation and merchant-specific OAuth for **existing** Merchant Center accounts and consent. Reuse the TAKATAK V1 Google connector where permitted. Avoid Content API v2.1.
2. Implement verified `tenantId ↔ merchantAccountId ↔ OAuth connection ↔ site/domain` association in V1, on a separate reviewed PR. Confirm Google's account name, site/domain and current active tenant before signing.
3. Retrieve access tokens only on the V1 server. Issue the merchant-bound short-lived SEO JWT, call the read-only inspection over HTTPS. Never send OAuth tokens to browser pages or store them in SEO DB.
4. Persist/mark `connected` only after a real Google call succeeds and permission checks pass; distinguish `not_configured`, `configured_untested`, `error`, `disabled`. Display provider issues/countries exactly as reported; missing product status = unknown, not "approved".
5. Use existing account/brand/feed inventory documented in `docs/TAKATAK_FIELD_STATE.md` and the Oct26 Drive lot. Do not recreate MC accounts or reimplement the local Free Listings CSV/XML generator from a short summary. Review the actual source artifacts when available.
6. Run tenant A/B and wrong Merchant binding negative tests, staging Google Merchant actual API read, per-account data-source verification and product-policy checks. A green mock CI is **not** a live provider connection.
7. Deployment: existing approved Supabase/PostgreSQL migrations 0001→0005 and Coolify application/HTTPS secrets configured by owner; designated V1 coordinator alone merges/deploys V1. Exact running SHA and /ready must pass before production claims.

## Operator and privacy notes

Do not invent Merchant IDs, prices, URLs, images or approval status. The Free Listings categories do not guarantee appearance. Some field-side product images exist in the master catalogue, but current published Merchant feed coverage must be verified from actual connected diagnostics; no invented image URLs. Existing V1 local-listings adapters that contain demo data must not be labelled live. Keep product/merchant data separated per client and follow owner-approved retention rules.
