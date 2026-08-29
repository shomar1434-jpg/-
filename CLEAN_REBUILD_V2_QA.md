# Performance Archive Clean Rebuild V2 — Manager Pilot

## Scope
- Base: applied V10 / Manager Pilot V1 line. V11 was not used.
- Modified file: `manager.html` only.
- Legacy cloud data is read-only; no legacy cloud key is deleted.

## Root cause fixed
V1 correctly wrote the new cloud key, but `publish()` mirrored the merged archive into `localStorage['school_reports']`. Large historical archives could exceed browser quota and abort the user-visible save flow.

## V2 design
- New cloud state key: `manager_performance_reports_clean_v2`.
- New writes: `moduleKey=manager`, `scope=school` only.
- Legacy keys read-only: `school_reports`, `reports_archive`, `performance_reports_archive_v2`.
- Archive UI reads from the engine's in-memory view, not `localStorage['school_reports']`.
- No `setItem('school_reports', ...)` or `setLocalSilently('school_reports', ...)` exists in the Clean V2 engine.
- Save is verified by cloud readback before success is shown.

## Static regression checks
- Embedded JavaScript syntax: 22/22 scripts passed `node --check`.
- Report UI archive reads before the Clean V2 block: 0 references to `localStorage.getItem('school_reports')`.
- Clean V2 contains cloud write and readback verification.
- Printing logic was not changed.

## Behavioral simulation
A cloud mock was used while all `localStorage` operations were configured to throw quota/read errors.
Result: PASS.
- New report persisted under `manager_performance_reports_clean_v2`.
- No legacy cloud key was written.
- Legacy report remained visible as read-only in merged archive view.
- Save did not require localStorage.

## Required live validation
1. Log into one authenticated independent school.
2. Create a manager performance report and select a domain.
3. Save; confirm success message.
4. Open performance archive; confirm report appears in matching domain folder.
5. Verify Supabase row uses the same `school_id`, `module_key=manager`, `owner_key=school`, and `state_key=manager_performance_reports_clean_v2`.
6. Repeat with a second school to confirm isolation.
