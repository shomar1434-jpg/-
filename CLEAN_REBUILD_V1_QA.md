# Performance Archive Clean Rebuild V1 — Manager Pilot

- Baseline: V10 (V11 deliberately not applied).
- Pilot file only: `manager.html`.
- New cloud state key: `manager_performance_reports_clean_v1`.
- New writes: `moduleKey=manager`, `scope=school` only.
- Legacy keys are read-only: `school_reports`, `reports_archive`, `performance_reports_archive_v2`.
- Legacy data is never overwritten or deleted by the new engine.
- Removed manager-side V10 canonical performance wrapper from the pilot to prevent dual writers.
- Save cycle: validate domain -> serialize report -> read clean cloud state -> upsert -> write -> read back -> verify report id + category -> refresh combined archive -> success message.
- Delete cycle applies only to clean-path reports; legacy reports are protected.
- Archive view combines clean reports plus same-school legacy reports for continuity.
- Printing logic was not changed in this pilot because the V10 printing correction is already working.

## Internal checks
- All inline JavaScript blocks: syntax PASS (23/23).
- Clean engine save/readback/delete with legacy data untouched: PASS.
- Two-school isolation simulation using identical state key: PASS.
- No remaining manager references to V8 domain keys or V10 canonical performance wrapper: PASS.

## Live test still required
A real authenticated school session must create one manager report and confirm the new state key appears in Supabase under the same school_id and owner_key=school before rollout to other roles.
