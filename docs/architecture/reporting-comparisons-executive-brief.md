# Reporting Comparisons & Executive Brief

## Scope
This milestone extends the Reporting & Export Centre with equal-length period comparisons and a deterministic executive brief based on reported daily provider metrics.

## Period rules
- Route: `/app/reports?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- The selected period is limited to 90 calendar days.
- The comparison period is the immediately preceding period with the same number of calendar days.
- The report reads published destinations in the active workspace and daily analytics rows visible through the authenticated Supabase client and RLS.
- Metrics are grouped by the connected account's platform code.

## Comparison semantics
- Current and previous period totals are calculated separately for impressions, reach, engagements and clicks.
- A percentage change is shown only when both periods have a reported value and the previous value is non-zero.
- Missing data is described as insufficient reported data; a zero baseline is never used as a denominator.
- No totals or rankings are created across different providers.
- Lifetime snapshots are excluded because they are point-in-time values, not additive daily observations.

## Executive brief
The brief is deterministic and rules-based. It reports platform-specific totals and changes and explicitly avoids causal claims, unsupported interpretations, or AI-invented context. It is not a substitute for analyst review.

## Limits and known gaps
- Reads up to 5,000 published destinations and 40,000 metric rows in this initial synchronous page.
- The current collector's daily series coverage is provider-dependent. Meta and LinkedIn lifetime-only collection is not represented in daily comparisons.
- PDF export, scheduled delivery, public sharing, campaign attribution reconciliation and background pagination are not included.
- All SocialOS database migrations remain unapplied in a live project; no production provider validation or deployment is implied.
