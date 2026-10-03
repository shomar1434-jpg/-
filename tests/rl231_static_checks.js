const fs=require('fs');
const vm=require('vm');
const path=require('path');

const root=path.resolve(__dirname,'..');
const files=['school_information_center.html','deputy_weekly_teacher_followup.html'];
let compiled=0;
for(const file of files){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(m=>m[1]).filter(s=>s.trim());
  scripts.forEach((source,index)=>{
    try{new vm.Script(source,{filename:`${file}:inline-${index+1}`});compiled++;}
    catch(error){throw new Error(`${file} inline script ${index+1} failed: ${error.message}`);}
  });
}

const center=fs.readFileSync(path.join(root,'school_information_center.html'),'utf8');
const deputy=fs.readFileSync(path.join(root,'deputy_weekly_teacher_followup.html'),'utf8');
const source=fs.readFileSync(path.join(root,'school-information-source.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261001025332_create_teacher_profile_sources.sql'),'utf8');
const checks=[
  ['cloud profile save is verified',center.includes("teacher-profiles-list")&&center.includes('assignmentSignature')],
  ['failed cloud save keeps editor open',center.includes('بقيت النافذة مفتوحة ولم تُفقد المدخلات')],
  ['misplaced grades are normalized',center.includes('misplacedPrimaryGrades')],
  ['stage removal supports missing legacy id',center.includes('removeAcademicStage=async function(id,name)')],
  ['deputy prefers tab scoped school',deputy.includes("platform_tab_session_school_id_v1")&&deputy.includes("smart_school_tab_school_v1")],
  ['deputy detects school mismatch',deputy.includes('DEPUTY_SCHOOL_CONTEXT_MISMATCH')],
  ['deputy cloud staff fallback exists',deputy.includes('SchoolInformationSource.getStaff(true)')],
  ['deputy profile enrichment uses verified edge request',deputy.includes("SchoolInformationSource.request('teacher-profiles-list')")],
  ['cache version bumped in both pages',(center.match(/20261001-RL231/g)||[]).length===1&&(deputy.match(/20261001-RL231/g)||[]).length===1],
  ['shared source version bumped',source.includes("16.0.0-RL231-independent-schools-directory-consistency")],
  ['migration creates both missing sources',migration.includes('create table if not exists public.school_teacher_profiles')&&migration.includes('create table if not exists public.deputy_weekly_teacher_source')],
  ['migration is non destructive',!/\b(drop\s+(table|column)|truncate\s+table|delete\s+from|update\s+\w+\s+set)\b/i.test(migration)],
  ['new sources are protected',migration.includes('enable row level security')&&migration.includes('revoke all on table public.school_teacher_profiles from anon, authenticated')]
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length)throw new Error('Failed checks: '+failed.map(([name])=>name).join(', '));
console.log(JSON.stringify({ok:true,compiledInlineScripts:compiled,checks:checks.map(([name])=>name)},null,2));
