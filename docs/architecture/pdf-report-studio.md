# PDF Report Studio

## Purpose
Provide a stakeholder-ready, print-optimised report from the authenticated Reports & Exports page without introducing a server-side PDF runtime or a second analytics query path.

## User flow
1. Open `/app/reports` and select the reporting period.
2. Review provider-separated comparisons and the factual executive brief.
3. Select **Print / Save as PDF**.
4. In the browser print dialog, choose **Save as PDF** or a connected printer.

## Report integrity
- Uses the same authenticated report data and active workspace scoping as the on-screen report.
- Daily provider metrics remain separated by platform.
- Lifetime snapshots are excluded from period comparisons.
- Missing metrics remain unavailable rather than being rendered as zero.
- The executive brief remains deterministic and does not invent causal explanations.
- The reporting-period controls and export/print actions are excluded from the printed document.

## Print presentation
- A4 page size with print margins.
- Removes application navigation and browser-only controls from the printed output.
- Preserves the light SocialOS report styling and avoids splitting report cards where possible.

## Deliberate scope limits
- This release uses the browser's native print-to-PDF workflow; it does not generate a server-side PDF file.
- PDF layout can vary slightly by browser and print settings.
- No scheduled report delivery, public sharing, PDF archival, custom logo upload or email distribution.
- Existing report query caps and unapplied database migrations remain unchanged.
