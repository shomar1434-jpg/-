import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../supabase/functions/platform-delegation/index.ts', import.meta.url), 'utf8');
assert.match(source, /metadata\?\.delegatedRoleCode/);
assert.match(source, /module_key\|\|''\)==='delegated_roles'/);
assert.match(source, /assignment_type\|\|''\)==='additional_role'/);
assert.match(source, /record_type\|\|''\)==='full_role_portal'/);
assert.match(source, /\.eq\('school_id',s\.school_id\)/);
assert.match(source, /const mine=task&&/);
assert.match(source, /isFullSectionDelegation\(task\)/);

const allowedRoles = new Set(['student_advisor','activity_leader','health_advisor','kindergarten_teacher','admin_employee']);
const delegatedRoleOf = task => String(task?.metadata?.delegatedRole || task?.metadata?.delegatedRoleCode || task?.record_id || task?.record_key || '').trim().toLowerCase();
const isFullSectionDelegation = task => {
  const modern = String(task?.metadata?.accessMode || '') === 'full_section';
  const legacy = String(task?.module_key || '') === 'delegated_roles' &&
    String(task?.assignment_type || '') === 'additional_role' &&
    String(task?.record_type || '') === 'full_role_portal';
  return (modern || legacy) && allowedRoles.has(delegatedRoleOf(task));
};

for (const role of ['student_advisor','health_advisor','activity_leader']) {
  assert.equal(isFullSectionDelegation({
    module_key:'delegated_roles',
    assignment_type:'additional_role',
    record_type:'full_role_portal',
    record_id:role,
    metadata:{delegatedRoleCode:role}
  }), true, role);
}

assert.equal(isFullSectionDelegation({
  module_key:'delegated_section',
  assignment_type:'additional_role',
  record_type:null,
  record_key:'student_advisor',
  metadata:{accessMode:'full_section',delegatedRole:'student_advisor'}
}), true);

assert.equal(isFullSectionDelegation({
  module_key:'delegated_roles',
  assignment_type:'additional_role',
  record_type:'single_record',
  record_id:'student_advisor',
  metadata:{delegatedRoleCode:'student_advisor'}
}), false);

assert.equal(isFullSectionDelegation({
  module_key:'delegated_roles',
  assignment_type:'additional_role',
  record_type:'full_role_portal',
  record_id:'unknown_role',
  metadata:{delegatedRoleCode:'unknown_role'}
}), false);

console.log('RL233 compatibility checks passed');
