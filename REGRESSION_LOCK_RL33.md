# RL33 — Independent School Isolation Regression Lock

Security contract:
- Browser tab identity is sessionStorage-scoped; localStorage is never authoritative for active user/role/session.
- A newly opened tab never inherits an authenticated cloud token from another tab; after RL33 rollout, a one-time fresh school login may be required.
- Every private state/file read is constrained by school_id + current session user_id.
- Section libraries are additionally constrained by the active session role/module.
- Performance-domain archive is personal; legacy school-owned states are recovered only when updated_by equals the current user.
- Administrative employees are bound to an exact supervisor_user_id. Legacy role-only bindings are recovered only when exactly one eligible supervisor exists.
- Session renewal preserves the exact school + role + user. Role changes require an explicit membership switch.
- Impact internal CRUD is server-authoritative. Public survey access is token-only through two narrow RPCs.
- Direct browser access to schools, users, school_members, students, private state/files, internal impact tables, and permissive external-evaluation tables is revoked by the final SQL lock.

Deployment order:
1. Upload RL33 frontend and Edge Function files.
2. Deploy the Edge Functions.
3. Confirm login, role route, library, performance archive, and impact smoke tests.
4. Apply `20260905_rl33_independent_school_isolation_lock.sql`.
5. Repeat smoke tests after the SQL lock.

Never apply step 4 before the RL33 frontend is live, because older pages contain legacy direct-table code.
