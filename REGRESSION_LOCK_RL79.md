# RL79 — Self Evaluation Canonical Archive

## Baselines
- Manager page: RL78, preserving the confirmed manager/wakil record archive work.
- Self-evaluation writer: RL64, preserving its verified V5 save/PDF transaction and no-save-flash behavior.

## Canonical contract
- Canonical index: `self_eval_archive_index_v5`.
- Canonical record: `self_eval_archive_record_v5_<id>`.
- New self-evaluation archive writes go only to V5.
- The old `manager_self_evaluation_archive_v1` message mirror is disabled for new writes.

## Historical-school protection
- Legacy sources remain readable and are never deleted/overwritten by migration.
- Migration is lazy, school-scoped, copy -> cloud verify -> ledger.
- Existing V5 wins on ID collision.
- Failed migration falls back to read-only legacy display; no source is erased.
- Ledger: `self_eval_archive_migration_ledger_v1`.
- A V5 deletion writes a tombstone so a preserved legacy source is not silently re-migrated.
- Empty/failed cloud reads do not trigger legacy deletion or overwrite.

## Archive identity
- All 63 existing folder IDs `selfEval_01` … `selfEval_63` remain unchanged.
- No folder rename/removal in RL79.
- PDF remains a derived cloud artifact linked by `archivePdfFileId`; record/index are the authoritative archive metadata.

## Scope
- Modified files only: `manager.html`, `self_evaluation_records.html`.
- No Supabase schema, Edge Function, manager-record, wakil-record, teacher, employee, or role-routing change.
