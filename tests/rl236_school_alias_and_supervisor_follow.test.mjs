import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('legacy school link is mapped non-destructively to the canonical school',()=>{
  const sql=read('supabase/migrations/20261006123000_school_identity_aliases.sql');
  assert.match(sql,/695d22d8-1483-412b-8ac8-97ce8c37e7f6/);
  assert.match(sql,/f836a31f-af7c-4928-8744-7bf0d514a896/);
  assert.match(sql,/on delete restrict/i);
  assert.doesNotMatch(sql,/delete\s+from\s+(schools|school_members|students)/i);
});

test('public school inspection and login session resolve aliases',()=>{
  const directory=read('supabase/functions/platform-directory/index.ts');
  const session=read('supabase/functions/platform-session/index.ts');
  const login=read('school-login.html');
  assert.match(directory,/school_identity_aliases/);
  assert.match(directory,/canonicalizedFrom/);
  assert.match(session,/resolveSchoolAlias/);
  assert.match(login,/school_link_canonicalized_from/);
});

test('deputy follow stays read-only and does not trigger direct login',()=>{
  const agent=read('agent.html');
  const teacher=read('teacher.html');
  assert.match(agent,/supervisor_follow_context_v1/);
  assert.match(agent,/viewer=agent/);
  assert.doesNotMatch(agent,/mode=supervisor_readonly[^'\n]+loginMode=direct/);
  assert.match(teacher,/MANAGER_FOLLOW_VIEWER_NOT_SUPERVISOR/);
  assert.match(teacher,/r\.viewer==='agent'\?'agent\.html':'manager\.html'/);
});

test('deputy can read teacher library but cannot follow another private role',()=>{
  const files=read('supabase/functions/platform-files/index.ts');
  assert.match(files,/\['manager','agent'\]\.includes\(sessionRole\)/);
  assert.match(files,/sessionRole==='agent'&&privateModuleRole\(moduleKey\)!=='teacher'/);
});

test('teacher comprehensive follow reads target cloud state and blocks writes',()=>{
  const state=read('supabase/functions/platform-state/index.ts');
  const guard=read('platform-persistence-guard.js');
  const records=read('platform-record-save-engine.js');
  const page=read('teacher_comprehensive_record.html');
  assert.match(state,/teacher_comprehensive_records/);
  assert.match(state,/STATE_TARGET_NOT_TEACHER/);
  assert.match(guard,/if\(readOnly\) return \{ok:false,readOnly:true/);
  assert.match(records,/if\(followReadOnly\(\)\)throw new Error/);
  assert.match(page,/ownerUserId:follow\?target:''/);
});

test('deployment applies alias migration before edge functions',()=>{
  const workflow=read('.github/workflows/deploy-supabase-functions.yml');
  assert.ok(workflow.indexOf('Apply database migrations')<workflow.indexOf('Deploy all Supabase Edge Functions'));
  for(const fn of ['platform-state','platform-directory','platform-session','platform-files']) assert.match(workflow,new RegExp(`supabase functions deploy ${fn}`));
});
