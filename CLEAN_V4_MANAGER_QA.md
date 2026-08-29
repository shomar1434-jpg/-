# Performance Archive Clean V4 — Manager Pilot QA

Baseline: V3 package actually tested by user. V11 not used.

## Root causes corrected
- V3 legacy reader omitted `manager_performance_reports_clean_v2`, `manager_performance_reports_clean_v1`, and `reports_archive`; the previously verified V2 report therefore stayed in Supabase but was absent from the archive view.
- `currentEditingId` remained set after a normal save, allowing a later report to overwrite/move the previous report instead of creating a new one.
- Archive UI still contained active references to the V2 engine in delete/export/import/edit functions.
- New-save path waited for cloud readback before the report could appear in the archive.

## V4 behavior
- Canonical write key remains `manager_performance_reports_clean_v3` to avoid creating another storage generation.
- Legacy read-only keys: `manager_performance_reports_clean_v2`, `manager_performance_reports_clean_v1`, `school_reports`, `reports_archive`, `performance_reports_archive_v2`.
- Legacy is read from school scope and current-user scope, always under the authenticated school session; it is never written/deleted by V4.
- Clean key is prefetched in the background on page load.
- On save: one canonical cloud write -> immediate in-memory archive appearance -> non-blocking cloud readback verification.
- Final “verified” message is shown only after readback finds the same report id and category.
- A normal new report always receives a new unique numeric id. Only explicit “Edit” mode reuses an id.
- Report title/programName is the exact trimmed value of `اسم البرنامج`; blank program name blocks save.

## Automated tests
- JavaScript syntax: 64 inline scripts, 0 syntax errors.
- 3 new reports in 3 categories: PASS; all 3 unique ids remain and retain their categories.
- Titles equal program names: PASS.
- Legacy V2 report appears after legacy hydration: PASS.
- `reports_archive` legacy appears: PASS.
- current-user historical legacy appears: PASS.
- Artificial 600 ms Legacy delay: new clean report appearance did not wait for Legacy (test ~1 ms after mocked cloud write acknowledgement): PASS.
- Writes touched only `manager_performance_reports_clean_v3`; no writes to legacy keys: PASS.
- Manager print CSS/class `manager-report-printing` remains present: PASS.

## Live Supabase evidence before V4 deployment
For school `7fdec859-6c52-4a5e-b7a9-891fadf56587`, Supabase contains school-scoped rows for clean_v1, clean_v2 and clean_v3, plus both school-scoped and current-user-scoped historical `school_reports`. V4 explicitly reads these as legacy sources instead of hiding them.
