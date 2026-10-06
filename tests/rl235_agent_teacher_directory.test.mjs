import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const agent=fs.readFileSync(new URL('../agent.html',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../supabase-bridge.js',import.meta.url),'utf8');
const directory=fs.readFileSync(new URL('../supabase/functions/platform-directory/index.ts',import.meta.url),'utf8');
const workflow=fs.readFileSync(new URL('../.github/workflows/deploy-supabase-functions.yml',import.meta.url),'utf8');

test('agent follow list uses the cloud school directory and has no fake teacher seed',()=>{
  assert.match(agent,/SmartSchoolSupabase\.listFollowUsers\('teacher'\)/);
  assert.doesNotMatch(agent,/id:'teacher_1',name:'المعلم'/);
  assert.match(agent,/تعذر تحميل حسابات المدرسة من المصدر السحابي/);
});

test('agent can request only active teachers and never persists the cloud list globally',()=>{
  assert.match(agent,/u\.role==='teacher'&&u\.status==='active'/);
  assert.match(agent,/followDirectoryUsers=list/);
  assert.doesNotMatch(agent,/write\(NS\+'_users',list\)/);
});

test('directory exposes a school-scoped read-only follow action to manager and agent',()=>{
  assert.match(directory,/action==='list-follow-users'/);
  assert.match(directory,/if\(!isManager&&!isAgent\)return json\(\{error:'SUPERVISOR_REQUIRED'/);
  assert.match(directory,/\.eq\('school_id',schoolId\)\.eq\('role','teacher'\)/);
  assert.match(bridge,/listFollowUsers: safeListFollowUsers/);
});

test('deployment workflow covers the changed edge function',()=>{
  assert.ok(workflow.includes('"supabase/functions/platform-directory/**"'));
  assert.match(workflow,/grep -q "action==='list-follow-users'"/);
});
