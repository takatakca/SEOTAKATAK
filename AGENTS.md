# SEOTAKATAK agent rules

1. Read `docs/AGENT_HANDOFF.md`, `docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md` and `docs/DECISIONS.md` before changing code. Read `WORKLOG.md` for previous agent activity.
2. Work on **takatakca/SEOTAKATAK** unless the task explicitly includes TAKATAK V1. Preserve Node 22, the separate deployment, and API compatibility.
3. TAKATAK V1 is the **only** identity/tenant authority. No client login here. Every read/write must derive `tenant_id` from verified, short-lived signed server tokens; never trust client-submitted tenant IDs.
4. `seo:import` is reserved for TAKATAK's verified server-side Google Search Console integration. `seo:manage` alone must never allow fabricated search data.
5. Never label prospective backlinks as verified/earned; don't buy or auto-exchange manipulative links. Google and AI rankings must be measured, not guessed.
6. Service-role Supabase credentials remain server-only. No migrations to TAKATAK V1 production without the database coordinator's approval. No billable Supabase project without owner approval.
7. `npm run check`, the Docker build and GitHub Actions must pass after code changes. Do not claim production success when the Coolify job fails or no running release has been verified.
8. SEOTAKATAK's unprotected main permits normal non-destructive CI-tested commits. For `takatakca/takatak-v1`, respect its owner/coordinator-only merge/deploy instruction: open/update PR and hand off; do not merge or deploy.
9. Update all five files under `docs/` required by the owner, especially `docs/AGENT_HANDOFF.md`, at each handoff. Include checked SHA, actual CI state, modified files, blockers and the exact next action.
10. An agent cannot self-relaunch from a prompt. Automatic continuation needs a separately approved orchestrator with secure credentials; never claim it is running unless verified.
