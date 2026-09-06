RL87 — Registration Contract Root Fix

Affected files only:
- register.html
- supabase/functions/platform-directory/index.ts
- supabase-bridge.js

No login page was changed.

Contract:
1. Permanent system-owner school registration link: no manager signature fields. Server verifies active school + exact schoolId/schoolCode/registrationCode. source is descriptive only.
2. Manager registration link: requires BOTH managerUserId and generalRegistrationToken; HMAC and active manager membership are verified.
3. Half manager signature is rejected explicitly and never downgraded to owner mode.
4. Administrative employee link remains separately signed.
5. register.html uses one direct endpoint path and performs a contract-version probe, so a stale Edge Function is reported explicitly instead of being misdiagnosed as an expired link.
6. supabase-bridge preserves manager signature fields for all other callers.

Deployment: upload register.html + supabase-bridge.js; deploy platform-directory. Existing login links are untouched. Existing owner-generated registration links remain valid.
