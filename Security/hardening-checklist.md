# Hardening Checklist

Use this checklist before production releases.

## Authentication

- Firebase Auth enabled with email verification.
- Login brute-force guard enabled on mobile and web.
  - Mobile: `src/utils/authAttemptGuard.ts`
  - Web: `bloodlink_web/src/utils/authAttemptGuard.ts`
- Ban/disabled account checks enforced on login.
  - Mobile login screen: `src/screens/auth/LoginScreen.tsx`
  - Web login page: `bloodlink_web/src/pages/LoginPage.tsx`

## Authorization

- Firestore rules deployed from `config/firebase/firestore.rules`.
- Chat read/write restricted to participants/admin.
- Abuse reports readable only by reporter/admin.
- Admin-only collections restricted (`admin_audit_logs`, admin announcements, etc.).

## Input Safety

- User text sanitized before writes (chat, support, requests, abuse reports).
  - Mobile helper: `src/utils/inputSecurity.ts`
- Suspicious payload patterns blocked (script/injection-like patterns).
- Server-side Firestore validations mirror key client checks.

## Abuse Protection

- Rate limits in place for:
  - chat messages
  - support messages
  - abuse reports
  - request creation
- Client and rule constraints both active.
  - Runtime limiter: `src/utils/rateLimiter.ts`
  - Rule guard for `rate_limits`: `config/firebase/firestore.rules`

## Secrets & Configuration

- Firebase and Cloudinary values loaded via `.env`.
- No hardcoded service keys in frontend source.
- Separate Cloudinary presets/folders for profile/certificate/evidence uploads.

## Operations

- Firestore rules deploy command documented and tested.
- Security docs updated after each security-related change.
