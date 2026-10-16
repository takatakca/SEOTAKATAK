#!/usr/bin/env bash
set -euo pipefail
name="seotakatak-schema-ci"
docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=only-ci-test -e POSTGRES_DB=seo_ci postgres:16-alpine >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
ready=false
for attempt in $(seq 1 35); do
  if docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d seo_ci -tAc 'SELECT 1' >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then echo "::error::CI PostgreSQL unavailable"; exit 1; fi
# Supabase provides anon/authenticated roles; vanilla PostgreSQL does not.
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d seo_ci \
 -c 'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;' >/dev/null
for file in sql/0001_seo_core.sql sql/0002_domain_verification.sql sql/0003_brief_editorial_review.sql sql/0004_site_deletion_receipts.sql sql/0005_shared_rate_limits.sql; do
  docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d seo_ci < "$file" >/dev/null
done
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d seo_ci < tests/sql/schema-smoke.sql
# Exercise the shared rate quota under real concurrent PostgreSQL connections.
# 20 parallel requests for an 8/minute import bucket must admit exactly 8,
# never one allowance per process. Run only inside disposable CI database.
quota_dir=$(mktemp -d)
trap 'rm -rf "$quota_dir"; docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
for n in $(seq 1 20); do
 (
  docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d seo_ci -tAc \
   "SELECT allowed FROM public.seo_consume_api_quota('7d87a2c9-fb84-474a-8ccc-43d6fe47605c','ci-concurrent-actor','import')" \
   > "$quota_dir/$n"
 ) &
done
wait
passed=0
rejected=0
for n in $(seq 1 20); do
 if [[ "$(tr -d '\r\n ' < "$quota_dir/$n")" == "t" ]]; then
  passed=$((passed+1))
 elif [[ "$(tr -d '\r\n ' < "$quota_dir/$n")" == "f" ]]; then
  rejected=$((rejected+1))
 else
  echo "::error::Unexpected result from concurrent PostgreSQL quota operation $n"
  exit 1
 fi
done
if [[ "$passed" != 8 || "$rejected" != 12 ]]; then
 echo "::error::Shared quota concurrency invariant failed: allowed=$passed denied=$rejected"
 exit 1
fi
echo "20 concurrent import calls: 8 allowed, 12 rejected (shared quota PASS)"
echo "SEO migrations and PostgreSQL invariants PASS"
