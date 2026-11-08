# SocialOS local Supabase setup

## Prerequisites

Install Docker Engine/Desktop and start the Docker daemon. Install the Supabase CLI, or use npx with Node.js 20+. The repository already includes a Supabase config and two migrations. Do not run `supabase init` again.

## Commands

```bash
git clone https://github.com/ICOFCUCAM/SocialOS.git
cd SocialOS
git checkout feat/database-foundation
npx supabase start
npx supabase status
```

The local Studio is at http://127.0.0.1:54323 and the API is at http://127.0.0.1:54321. The local PostgreSQL port is 54322.

To reapply all local migrations and discard local database data:

```bash
npx supabase db reset
```

WARNING: `db reset` deletes data in the targeted local database. Do not use it with a linked production project or `--linked`.

Use `npx supabase stop` to stop local services. To preserve local data, do not use the `--no-backup` option.

## Environment

Copy `.env.example` to `.env.local` for the Next.js frontend. Use values from `npx supabase status`. Never commit credentials, and never put a service-role key in a NEXT_PUBLIC_ variable. Backend secrets should be injected only into the backend process.

## Testing gate

After `npx supabase start` and `npx supabase db reset` succeed, implement and run the tests in `docs/security/tenant-isolation-test-plan.md`. Do not merge the draft PR or connect real social accounts until migration, privilege and tenant-isolation checks pass.

## Troubleshooting

If ports 54320–54324 are occupied, change them in `supabase/config.toml`. If Docker cannot connect, start the Docker daemon. CLI/database compatibility may require adjusting the PostgreSQL major version in config to the installed Supabase CLI's supported version.

## Current status

Configuration is committed, but local Docker and Supabase CLI are not available in the assistant's execution environment. No migrations or tests have been run.
