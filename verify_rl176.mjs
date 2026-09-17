import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const center = read('./central_task_center.html');
const managerRecords = read('./manager_records.html');
const deputyRecords = read('./wakil-records.html');
const manager = read('./manager.html');
const core = read('./supabase/functions/platform-core/index.ts');
const workflow = read('./.github/workflows/deploy-supabase-functions.yml');

assert.match(center, /searchParams\.set\('record',recordId\)/);
assert.match(center, /searchParams\.set\('record_id',recordId\)/);
assert.match(managerRecords, /get\('record_id'\) \|\| RL162_INITIAL_RECORD_PARAMS\.get\('record'\)/);
assert.match(deputyRecords, /get\('record_id'\)\|\|delegatedRecordParams\.get\('record'\)/);
assert.match(core, /dynamic_exact_id/);
assert.match(core, /edu-\[0-9a-f\]\{10\}/i);
assert.match(manager, /LegacySelfEvaluationRecovery/);
assert.match(manager, /اتحاد المصدرين دائمًا/);
assert.match(workflow, /supabase\/functions\/\*\*/);
assert.doesNotMatch(core, /delete\(\).*self_eval|\.delete\(\).*self_eval/i);

console.log('RL176 static verification passed.');
