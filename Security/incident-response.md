# Incident Response (Template)

## 1. Detect

- What happened?
- When did it start?
- Who reported it?

## 2. Contain

- Disable affected flow if needed.
- Tighten Firestore rule paths if actively exploited.
- Revoke/rotate exposed credentials if applicable.
- Reference rule file: `config/firebase/firestore.rules`

## 3. Eradicate

- Patch root cause in code and/or rules.
- Add tests or checks to prevent recurrence.
- Common security code paths:
  - `src/utils/rateLimiter.ts`
  - `src/utils/authAttemptGuard.ts`
  - `bloodlink_web/src/utils/authAttemptGuard.ts`
  - `src/utils/inputSecurity.ts`
  - `bloodlink_web/src/utils/inputSecurity.ts`

## 4. Recover

- Redeploy fixed rules/app.
- Validate critical flows:
  - login
  - chat
  - request creation
  - reporting

## 5. Postmortem

- Document impact, timeline, root cause, and action items.
- Update security docs in this folder.
