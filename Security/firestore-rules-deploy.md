# Firestore Rules Deploy

## Deploy Command

```bash
firebase deploy --only firestore:rules
```

Rules source file:

- `config/firebase/firestore.rules`

## Verify Active Rules

1. Open Firebase Console -> Firestore Database -> Rules.
2. Confirm latest publish timestamp.
3. Run app smoke tests:
   - Login and open feed
   - Send chat message
   - Create request
   - Submit abuse report
4. Confirm forbidden actions are blocked:
   - Non-participant reading a conversation
   - Invalid request payload create
   - Invalid abuse report payload create

## Rollback Plan

1. Keep a backup of previous rules in version control.
2. If critical issue appears, redeploy previous rule revision.
3. Re-test core flows immediately after rollback.
