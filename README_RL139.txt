RL139 — Login failure-stage diagnostic
Changed only:
1) school-login.html
2) supabase/functions/platform-session/index.ts

Purpose: identify the exact stage where previously-active accounts fail across schools, without changing passwords, roles, school ownership, memberships, or successful-login behavior.
Opaque diagnostic codes are returned only on failure. No password/PII is logged in the diagnostic payload.
