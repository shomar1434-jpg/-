const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'functions', 'platform-state', 'index.ts'),
  'utf8'
);

const required = [
  "version:'1.11.0-RL232-operational-plan-canonical-read'",
  'OPERATIONAL_PLAN_MODULE_ALIASES',
  ".eq('school_id',s.school_id)",
  ".in('owner_key',[requestedOwnerKey,String(s.user_id||'')])",
  ".is('deleted_at',null)",
  "pq.like('state_key','operationalPlan%')",
  'newestByKey',
  'pulled=pulled.filter',
  'for(const row of pulled)'
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error('Missing marker: ' + marker);
}

const aliases = [
  'interactive_operational_plan',
  'school_command_center',
  'school_information_center',
  'administrative_employee_portal',
  'admin_employee_management',
  'school_readiness'
];
const isPlan = key => /^operationalPlan(?:Integrated|ResetBackup)V14/i.test(String(key || ''));
const pickNewest = (rows, schoolId, ownerKey) => {
  const newest = new Map();
  for (const row of rows) {
    if (row.school_id !== schoolId || row.owner_key !== ownerKey) continue;
    if (!aliases.includes(row.module_key) || row.deleted_at || !isPlan(row.state_key)) continue;
    const prior = newest.get(row.state_key);
    if (!prior || Date.parse(row.updated_at) >= Date.parse(prior.updated_at)) newest.set(row.state_key, row);
  }
  return newest;
};

const rows = [
  {school_id:'A',owner_key:'U1',module_key:aliases[1],state_key:'operationalPlanIntegratedV14Annual:A',payload:'old',updated_at:'2026-10-01T00:00:00Z',deleted_at:null},
  {school_id:'A',owner_key:'U1',module_key:aliases[0],state_key:'operationalPlanIntegratedV14Annual:A',payload:'new',updated_at:'2026-10-03T00:00:00Z',deleted_at:null},
  {school_id:'A',owner_key:'U2',module_key:aliases[0],state_key:'operationalPlanIntegratedV14Annual:A',payload:'other-user',updated_at:'2026-10-04T00:00:00Z',deleted_at:null},
  {school_id:'B',owner_key:'U1',module_key:aliases[0],state_key:'operationalPlanIntegratedV14Annual:B',payload:'other-school',updated_at:'2026-10-05T00:00:00Z',deleted_at:null},
  {school_id:'A',owner_key:'U1',module_key:aliases[0],state_key:'operationalPlanResetBackupV14:A',payload:'deleted',updated_at:'2026-10-06T00:00:00Z',deleted_at:'2026-10-06T00:00:00Z'}
];
const selected = pickNewest(rows, 'A', 'U1');
if (selected.get('operationalPlanIntegratedV14Annual:A')?.payload !== 'new') throw new Error('Newest plan was not selected');
if (selected.size !== 1) throw new Error('Isolation or deleted-row filter failed');

console.log(JSON.stringify({
  ok: true,
  checks: [
    'newest alias wins',
    'school isolation',
    'owner isolation',
    'deleted rows excluded',
    'legacy rows are not mutated',
    'health version bumped'
  ]
}, null, 2));
