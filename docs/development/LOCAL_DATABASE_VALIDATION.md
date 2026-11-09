# Local database validation

This guide is the safe, repeatable validation path for SocialOS migrations. It uses only a disposable local Supabase stack.

## Prerequisites

- Docker-compatible runtime running (Docker Engine or Podman configured for Docker compatibility).
- Supabase CLI v2 or v3 installed.
- Node.js 22 for the application checks.
- At least 7 GB RAM available to the local container runtime.

Do not link the local checkout to the production project for this validation. Do not use `--remote`, `--linked`, or a production database URL.

## 1. Start from a clean checkout

```bash
git checkout integration/socialos-feature-stack
git pull --ff-only
supabase --version
docker info
```

If using Podman, verify its Docker-compatible socket is available to the CLI before continuing.

## 2. Replay all migrations locally

```bash
supabase start
supabase db reset
supabase migration list
```

The reset must be local. It recreates the disposable local database and applies all files under `supabase/migrations` in order. Never add `--linked` or `--remote`.

Expected result: all 17 migration files apply without SQL errors.

## 3. Run schema and security smoke tests

```bash
supabase db query --local -f supabase/tests/migration_smoke.sql
supabase db lint --local --fail-on error
supabase gen types typescript --local > /tmp/socialos.types.ts
test -s /tmp/socialos.types.ts
```

The smoke test checks required tables, RLS enablement, worker RPC presence, the private media bucket and restricted execution of privileged worker RPCs.

## 4. Run application checks

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

Run worker tests when their packages are present:

```bash
npm test --prefix workers/analytics-collector
npm test --prefix workers/publisher
```

Use only fake provider credentials and test accounts. Never connect live social accounts during migration validation.

## 5. Evidence to attach to the integration pull request

Record:
- CLI version and container runtime version.
- Full output of `supabase db reset`.
- Output of `supabase migration list`.
- Smoke-test result.
- Database lint result.
- Typecheck, lint and build results.
- Worker test results.
- Any failures with the exact migration filename and error output.

## 6. Production boundary

A passing local replay is necessary but not sufficient for production. Before production rollout, verify the schema diff against a protected staging environment, review the backup/restore path, test tenant isolation with two independent users, test service-role boundaries and provider idempotency, and obtain explicit release approval.

Never run `supabase db reset --linked` or a remote reset against production.
