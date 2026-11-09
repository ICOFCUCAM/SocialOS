# GitHub Actions runner diagnostics

**Repository:** `ICOFCUCAM/SocialOS`
**Affected branch:** `integration/socialos-feature-stack`
**Observed:** workflows create run/job records and then fail before any step is recorded. The job-step API returns an empty array and the job-log download returns `BlobNotFound`.

## What this evidence means

The available run records do not establish that a workflow command, dependency install, Supabase CLI, Docker service, migration, or application test ran. Do not treat these failures as SQL or application test failures. Conversely, they are not passing checks.

The root cause is not yet established. Possible causes include repository/org Actions policy, unavailable hosted runner capacity, billing/minutes restrictions, a disabled Actions setting, or an Actions service-side failure. Do not claim any one cause until the repository owner checks the settings or GitHub provides a diagnostic message.

## Owner-side checks

A repository administrator should inspect:

1. **Repository → Settings → Actions → General**
   - Confirm Actions are enabled for the repository.
   - Confirm the selected policy permits the required GitHub-hosted runners.
   - Confirm the workflow permissions policy does not prohibit the workflow.
2. **Organization → Settings → Actions → General**
   - Check whether organization policy overrides repository settings.
   - Check allowed actions and runner restrictions.
3. **Billing / usage**
   - Check whether the organization or account has exhausted included Actions minutes or has a payment/usage restriction.
4. **Runners**
   - Confirm GitHub-hosted runners are permitted for this private repository, or configure an approved self-hosted runner.
   - If self-hosted, confirm it is online, labels match `runs-on`, and the runner group grants this repository access.
5. **GitHub service status**
   - Check Actions incidents around the run timestamps.

## Safe reproduction

After confirming the settings, run the database-validation workflow manually from the Actions tab using `workflow_dispatch`, or push a harmless documentation-only commit to the integration PR branch.

Expected sequence for a healthy GitHub-hosted runner:
- A runner is assigned.
- Checkout and Supabase CLI setup appear as job steps.
- Local Supabase starts.
- `supabase db reset` replays migrations from an empty local database.
- Smoke tests, tenant-isolation tests, lint and type generation execute.

If the job still fails with no steps, collect the run URL, job ID, runner assignment fields and any GitHub UI banner, then contact GitHub Support or the organization administrator. Do not add schema migrations as a workaround.

## Duplicate-trigger reduction

The database-validation workflow is configured to run for pull requests targeting `main`, pushes to `main`, and manual dispatch. It no longer starts a second database stack for every push to the integration branch while the same commit is also covered by the pull-request event.

## Production boundary

Do not merge PR #29, apply migrations to the hosted project, or connect live social accounts until the local replay and security tests have completed successfully and the evidence is attached to the PR.
