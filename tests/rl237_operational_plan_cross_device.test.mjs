import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('operational plan state is explicitly school-scoped before persistence starts',()=>{
  const page=read('interactive_operational_plan.html');
  const config=page.indexOf("window.CLOUD_STATE_CONFIG={moduleKey:'interactive_operational_plan',scope:'school'");
  const guard=page.indexOf('src="platform-persistence-guard.js');
  assert.ok(config>0&&config<guard);
  assert.match(page,/operationalPlanIntegratedV14Annual:\$\{sid\}/);
  assert.match(page,/operationalPlanArchivesV14:\$\{sid\}/);
});

test('page recovers and hydrates cloud plan before rendering local state',()=>{
  const page=read('interactive_operational_plan.html');
  const boot=page.indexOf('async function bootOperationalPlanFromCloud');
  assert.ok(boot>0);
  const body=page.slice(boot,boot+1800);
  assert.ok(body.indexOf("request('recover-operational-plan'")<body.indexOf('load();'));
  assert.ok(body.indexOf('readExact')<body.indexOf('load();'));
});

test('manual save verifies active plan in cloud before reporting archive success',()=>{
  const page=read('interactive_operational_plan.html');
  assert.match(page,/const activeSave=await verifyActivePlanCloudSave\(\)/);
  assert.match(page,/if\(!activeSave\?\.ok\)throw new Error/);
});

test('recovery selects a same-school legacy candidate and never deletes it',()=>{
  const state=read('supabase/functions/platform-state/index.ts');
  const section=state.slice(state.indexOf("if(action==='recover-operational-plan')"),state.indexOf("if(action==='pull')"));
  assert.match(section,/\.eq\('school_id',s\.school_id\)/);
  assert.match(section,/owner_key:'school'/);
  assert.match(section,/populated\*100\+fields/);
  assert.doesNotMatch(section,/\.delete\(|deleted_at:now/);
});

test('deployment workflow still deploys the changed platform-state function',()=>{
  const workflow=read('.github/workflows/deploy-supabase-functions.yml');
  assert.match(workflow,/supabase\/functions\/platform-state\/\*\*/);
  assert.match(workflow,/supabase functions deploy platform-state/);
});
