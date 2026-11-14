# SocialOS — professional product plan

**Goal:** a mainstream social media product whose code and interface are both exceptionally professional and recognisably SocialOS.
**Decision owner:** Chief designer, with engineering decisions recorded here.
**Started:** 14 November 2026

## Baseline (measured before this plan)

The backend design is sound and is kept: tenant isolation in the database, a durable publishing queue that will not double-post, and encrypted provider tokens, with 21 migrations verified on Supabase.

The frontend and code craft were not at professional standard:

| Area | Measured |
|---|---|
| Readability | 251 lines over 200 characters; longest line 3,657 characters |
| Design system | none — 879 hard-coded colours (126 distinct), 158 one-off font sizes, no shared components |
| Typography | Arial; no brand typeface |
| States | no loading, error or not-found screens; Media and Inbox linked but not built |
| Accessibility | 24 ARIA attributes across 20 pages |
| Types | no generated database types; 13 type-escape casts; no input validation library |
| Tests | no web app or end-to-end tests |
| Operations | no error monitoring, logging, analytics or i18n |

## Decisions

1. **v1 launch channels:** Instagram, Facebook Pages, LinkedIn and YouTube — the four with working publishing adapters. TikTok and X follow once their adapters and app reviews are done.
2. **Brand:** the "Signal" identity in `docs/design/brand.md`.
3. **Stack:** Next.js App Router, Tailwind v4 tokens, accessible headless primitives (Radix) with `cva` variants, Zod at every boundary, Supabase generated types, Playwright for end-to-end tests, Sentry for errors.
4. **Quality bar:** a change merges only when formatting, lint, types, unit, integration and end-to-end checks pass, and every new screen is built from the design system.

## Phases

### Phase 0 — Engineering foundations · done

- Prettier with Tailwind class sorting, enforced in CI; codebase reformatted.
- Generated Supabase types committed.
- Design and validation dependencies pinned.

### Phase 1 — Brand and design system · foundation done

- Done: identity, tokens (light/dark), bundled fonts, logo, Button, Badge, Card, Input, Label, Container, homepage rebuilt.
- Next: Dialog, Dropdown menu, Tabs, Tooltip, Toast, Select, Checkbox/Switch, Table, Skeleton, Empty state, Avatar, chart primitives; Storybook with visual and accessibility checks.
- **Exit:** every product screen can be built from the library with no one-off styling.

### Phase 2 — Rebuild the product experience

- App shell: navigation, workspace and brand switcher, command palette (⌘K), notifications, theme toggle.
- Rebuild every screen with designed loading, empty, error and success states: dashboard, composer, calendar, campaigns, channels, publishing, analytics, reports, AI studio, onboarding and auth.
- Build Media library and Inbox, or remove them until they exist.
- Marketing: pricing, legal (privacy, terms), SEO metadata and social images.
- **Exit:** design review passes for every screen in both themes at phone and desktop widths; Lighthouse ≥ 95 for performance and accessibility; zero raw hex values outside `globals.css` (enforced by lint).

### Phase 3 — Code quality and reliability

- Upgrade `@supabase/ssr` and type every Supabase client with the generated `Database` types; remove all `as unknown as` casts.
- Zod schemas for every route and server action; one data-access layer.
- Consistent error handling, Sentry, structured logs, product analytics.
- Rate limits and per-workspace AI budgets.
- Tests: unit (logic), integration (routes against Supabase), Playwright end-to-end for sign-up → connect → compose → schedule → publish → analytics, visual regression.
- **Exit:** critical journeys covered by end-to-end tests that gate every merge.

### Phase 4 — Mainstream readiness

- Platform app reviews: Meta, Google (YouTube), LinkedIn.
- Security review and penetration test; GDPR export and deletion; privacy policy and terms.
- Monitoring, alerting, SLOs, backups and incident runbook; load tests for workers.
- Internationalisation for launch markets.
- **Exit:** approved platform apps, passed security review, on-call runbook in place.

## How we work

Each increment ships as its own pull request with screenshots (light, dark, mobile) and passes CI before merge. This document is updated as phases complete.
