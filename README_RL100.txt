RL100 - Self Evaluation Static Priority Cells

Files changed:
- self_evaluation_records.html only

Purpose:
- Fix overlapping input/select boxes in archived/print preview of the Actual School Reality priorities table.
- Keep live editable controls during normal editing.
- Use static, wrapping text values for archive preview and print/PDF output.
- No changes to Supabase storage, registration, school login, workflows, or manager.html.

QA:
- 7 inline JavaScript blocks checked with node --check: 0 syntax errors.
