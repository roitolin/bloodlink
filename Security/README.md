# Security

This folder stores security-related documentation and operational notes for BloodLink.

## Contents

- `hardening-checklist.md`
- `incident-response.md`
- `firestore-rules-deploy.md`
- `auth-rate-limit-notes.md`
- `input-validation-notes.md`

## Code References

- Firestore rules: `config/firebase/firestore.rules`
- Mobile rate limit core: `src/utils/rateLimiter.ts`
- Mobile login attempt guard: `src/utils/authAttemptGuard.ts`
- Web login attempt guard: `bloodlink_web/src/utils/authAttemptGuard.ts`
- Mobile input safety helpers: `src/utils/inputSecurity.ts`
- Web input safety helpers: `bloodlink_web/src/utils/inputSecurity.ts`

## Current Security Controls (Summary)

- Firestore rules hardened for requests/chat/abuse reports.
- Client-side and rule-side input validation for risky payloads.
- Login attempt guards (mobile + web) for brute-force mitigation.
- Rate limiting for chat, support messages, abuse reports, and request creation.

## Deployment Reminder

After rule changes, deploy with:

```bash
firebase deploy --only firestore:rules
```
