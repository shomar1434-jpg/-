import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync(new URL('../supabase/functions/platform-state/index.ts',import.meta.url),'utf8');
const js=stripTypeScriptTypes(source,{mode:'strip'}).replace(/^import .*?;\n/m,'');
new vm.Script(js); // Full deployed function must parse after TS stripping.
const start=js.indexOf("      if(moduleKey==='weekly_teacher_work'){",js.indexOf("if(action==='pull-school-users')"));
const end=js.indexOf('      return json({items:result',start);
const filter=js.slice(start,end);
const row=(key,owner,p,deleted_at=null)=>({state_key:key,owner_key:owner,payload:{value:JSON.stringify(p)},deleted_at});
function run(rows){const ctx={moduleKey:'weekly_teacher_work',result:rows,s:{school_id:'school-a',user_id:'reviewer-a'}};vm.createContext(ctx);vm.runInContext(filter,ctx);return ctx.result;}
test('legacy draft recovers school/reviewer only from same owner and same week',()=>{
 const rows=[row('weekly_submission_v1:w1:t1','t1',{week_id:'w1',teacher_id:'t1',school_id:'school-a',reviewer_id:'reviewer-a'}),row('weekly_evidence_draft_v1:w1:t1','t1',{week_id:'w1',teacher_id:'t1',items:{weeklyPlan:{cloud_file_ids:['f1']}}})];
 const result=run(rows);assert.equal(result.length,2);
 const p=JSON.parse(result[1].payload.value);assert.equal(p.school_id,'school-a');assert.equal(p.reviewer_id,'reviewer-a');
 assert.equal(JSON.parse(rows[1].payload.value).reviewer_id,undefined); // Read-only compatibility.
});
test('foreign school, reviewer, owner, deleted and unanchored drafts stay excluded',()=>{
 const rows=[row('weekly_submission_v1:w1:t1','t1',{week_id:'w1',school_id:'school-a',reviewer_id:'reviewer-a'}),row('weekly_evidence_draft_v1:w1:t2','t2',{week_id:'w1'}),row('weekly_evidence_draft_v1:w2:t1','t1',{week_id:'w2'}),row('weekly_evidence_draft_v1:w1:t1','t1',{week_id:'w1'},'2026-10-01'),row('weekly_submission_v1:w3:t1','t1',{week_id:'w3',school_id:'school-b',reviewer_id:'reviewer-a'}),row('weekly_submission_v1:w4:t1','t1',{week_id:'w4',reviewer_id:'reviewer-b'}),row('weekly_evidence_draft_v1:w1:t1','t1',{week_id:'w1',teacher_id:'t2',reviewer_id:'reviewer-a'})];
 assert.equal(run(rows).length,1);
});
test('conflicting historical reviewer anchors do not guess draft ownership',()=>{
 const rows=[row('weekly_submission_v1:w1:t1','t1',{week_id:'w1',reviewer_id:'reviewer-a'}),row('weekly_active_plan_v1','t1',{week_id:'w1',reviewer_id:'reviewer-b'}),row('weekly_evidence_draft_v1:w1:t1','t1',{week_id:'w1'})];
 assert.equal(run(rows).length,1);
});
test('deployment workflow retains all-function deployment and covers platform-state explicitly',()=>{
 const yaml=fs.readFileSync(new URL('../.github/workflows/deploy-supabase-functions.yml',import.meta.url),'utf8');
 assert.ok(yaml.includes('"supabase/functions/**"'));assert.ok(yaml.includes('"supabase/functions/platform-state/**"'));
 assert.match(yaml,/supabase functions deploy \\/);assert.match(yaml,/supabase functions deploy platform-state \\/);
});
