# SocialOS

Global AI-powered social media operating system for brand management, content creation, video production, publishing, analytics and multi-tenant SaaS.

## Application

- Next.js App Router, TypeScript and Tailwind CSS
- Supabase Auth with SSR session management
- Multi-tenant organisations, memberships and brands

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the SocialOS Supabase project.
4. Run `npm run dev`.

The service-role key must never be exposed to browser code or committed. See `docs/development` and `docs/security` before deploying.

## Status

This is not yet a production release.

The integrated stack contains authentication and workspace onboarding, multi-brand management, social account OAuth (YouTube, LinkedIn, Facebook Pages and Instagram), secure media ingestion and processing, durable publishing with account-specific content versions, campaigns, analytics collection and reporting. Configure Supabase Auth email templates and redirect URLs before testing signup.

The hosted Supabase project has only the first seven migrations applied. Replay the full migration chain on a disposable database (`supabase db reset`, then `supabase/tests/*.sql`) before applying the remaining migrations to any shared environment.

Background workers live in `workers/` (`publisher`, `media-processor`, `analytics-collector`); each has its own `package.json`, tests (`npm test`) and Dockerfile. Environment variables for the app and workers are listed in `.env.example`.


## Creator Studio architecture

The Creator Studio architecture, current platform-adapter capability assessment, data model direction, phased implementation plan and release gates are documented in [`docs/creator-studio/ARCHITECTURE.md`](docs/creator-studio/ARCHITECTURE.md). This is an architecture baseline, not a claim that all listed future capabilities are implemented.
