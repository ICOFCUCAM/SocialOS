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

The authentication and first-workspace onboarding foundation is under review in pull request #2. Configure Supabase Auth email templates and redirect URLs before testing signup. This is not yet a production release.
