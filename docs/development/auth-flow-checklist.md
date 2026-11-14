# Authentication and onboarding test checklist

Run against a dedicated development project and test email accounts only.

- [ ] Signup rejects invalid email and weak passwords.
- [ ] Signup creates an Auth user and profile row.
- [ ] Unverified user cannot access `/app` or `/onboarding`.
- [ ] Confirmation email link returns through `/auth/callback`.
- [ ] Confirmed user can sign in.
- [ ] User can request password recovery without account enumeration.
- [ ] Recovery link reaches `/reset-password` and updates the password.
- [ ] User can sign out and protected routes redirect to login.
- [ ] A confirmed user can create one workspace.
- [ ] Workspace creation creates organisation, owner membership and starter brand atomically.
- [ ] Duplicate workspace slug returns a safe validation message.
- [ ] A user cannot create an organisation for another user.
- [ ] A user cannot access another organisation's workspace.
- [ ] Invalid or external callback redirect targets fall back to `/app`.
- [ ] Expired and already-used confirmation links show a recoverable error.

Do not use real customer social credentials during this test phase.
