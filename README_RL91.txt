RL91 — School-scoped registration identity fix

Scope: one file only
- supabase/functions/platform-directory/index.ts

Fix:
- Resolve an existing registration inside the target school first using school_members(school_id + email + role).
- Do not treat a same-email user row from another school as the target school's existing registration.
- Because users.email is globally unique in the current schema, reuse the canonical user row only as an identity anchor when needed, then create a separate pending membership for the target school.
- Password mismatch blocks only when the same school membership already exists; a password from another school's identity no longer blocks creating the target school's pending membership.
- Protected owner/system-admin identities cannot be attached through the public school registration flow.
- No changes to school-login.html or registration links.
