# Supabase Auth configuration

Configure these values in the SocialOS development project before testing email-based authentication.

## URL Configuration

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `http://localhost:3000` during local development.
- Redirect URL allow-list: `http://localhost:3000/**`.
- When a production domain is selected, add its exact HTTPS callback and application paths, for example `https://app.example.com/**`. Do not replace the local URL until local testing is complete.
- Avoid broad wildcard domains. Add only domains controlled by SocialOS.

The application uses these callback routes:

- Email confirmation: `/auth/callback?next=/onboarding`
- Password recovery: `/auth/callback?next=/reset-password`

The callback handler exchanges the one-time authorization code for a session and only redirects to a relative in-app path.

## Email provider

For development, Supabase's built-in email service may be used within its current sending limits. Before public launch, configure a production SMTP provider, verified sender domain, SPF, DKIM and DMARC. Review confirmation and password-recovery templates and make the SocialOS identity clear.

## Authentication security

- Keep email confirmation enabled for public signups.
- Set an appropriate minimum password length and password policy.
- Enable CAPTCHA / bot protection and rate limits before public registration.
- Never disable email confirmation merely to make local testing easier.
- Do not expose service-role or secret API keys in browser environment variables.

## Current status

These settings are instructions for the project owner to apply in the Supabase Dashboard. They have not been changed automatically by this repository.
