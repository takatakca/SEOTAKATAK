#!/usr/bin/env bash
set -euo pipefail
name="seotakatak-schema-ci"
docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=only-ci-test -e POSTGRES_DB=seo_ci postgres:16-alpine >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
ready=false
for attempt in $(seq 1 35); do
  if docker exec "$name" pg_isready -U postgres -d seo_ci >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then echo "::error::CI PostgreSQL unavailable"; exit 1; fi
for file in sql/0001_seo_core.sql sql/0002_domain_verification.sql sql/0003_brief_editorial_review.sql; do
  docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d seo_ci < "$file" >/dev/null
done
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d seo_ci < tests/sql/schema-smoke.sql
echo "SEO migrations and PostgreSQL invariants PASS"
