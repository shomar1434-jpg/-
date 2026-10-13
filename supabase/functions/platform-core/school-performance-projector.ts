export const PERFORMANCE_STATE_MODULES=['manager','agent','teacher','student_advisor','activity_leader','health_advisor','kindergarten_teacher','admin_performance','manager_records','weekly_teacher_work','deputy_weekly_followup','teacher_comprehensive','teacher_comprehensive_records'];
const clamp=(v:any)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0};
async function parsed(row:any){let value=String(row.payload?.value??'');if(value.startsWith('__PG_GZIP_B64_V1__:')){const bytes=Uint8Array.from(atob(value.slice('__PG_GZIP_B64_V1__:'.length)),c=>c.charCodeAt(0));value=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}try{return JSON.parse(value)}catch{return null}}
const roleFor=(module:string)=>/teacher_comprehensive|weekly_teacher_work|^teacher$|kindergarten/.test(module)?'teacher':/agent|deputy/.test(module)?'vice':/advisor/.test(module)?'advisor':/activity/.test(module)?'activity':/admin_performance/.test(module)?'admin_employee':'manager';
export async function projectSchoolPerformance(rows:any[],schoolId:string){
 const byId=new Map<string,any>();
 for(const row of rows){
  if(String(row.school_id)!==schoolId||row.deleted_at)continue;
  const module=String(row.module_key||''),key=String(row.state_key||'');if(!PERFORMANCE_STATE_MODULES.includes(module))continue;
  const isReport=/(?:^|_)perf_report_v1_/.test(key),isWeekly=module==='weekly_teacher_work'&&key.startsWith('weekly_submission_v1:'),isRecord=key.startsWith('record_v1:'),isTeacherPeriod=module==='teacher_comprehensive'&&key.startsWith('teacher_records_period_v1:');
  if(!isReport&&!isWeekly&&!isRecord&&!isTeacherPeriod)continue;
  // One authoritative representation; metadata/index/draft and old class mirrors are excluded.
  if(module==='teacher_comprehensive_records'||(isRecord&&/record_v1:weekly_tasks_period:/.test(key)))continue;
  const p=await parsed(row);if(!p||p.schoolId&&String(p.schoolId)!==schoolId||p.school_id&&String(p.school_id)!==schoolId)continue;
  const owner=String(row.owner_key)==='school'?String(row.updated_by||''):String(row.owner_key||'');
  if(!owner)continue;
  const kind=isReport?'report':'record',role=roleFor(module);
  let logicalKey=key;if(isWeekly){if(String(p.teacher_id||owner)!==owner)continue;const number=String(p.week_number||'').replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))),term=String(p.term||'');logicalKey='weekly:'+String(p.year||'')+':'+(/الأول|الاول|semester_1/.test(term)?'1':/الثاني|semester_2/.test(term)?'2':term)+':'+(number?String(Number(number)):p.week_id);}
  const id=[role,owner,logicalKey].join('|'),prior=byId.get(id);
  if(prior&&(prior.canonical||'')==='user'&&row.owner_key==='school')continue;
  if(prior&&prior.canonical!=='school'&&String(prior.updated_at)>String(row.updated_at)&&row.owner_key!=='school')continue;
  const data=p.data||p,score=isWeekly?clamp(p.executive_score??p.score):clamp(data.progress??data.completionRate??data.score??p.meta?.progress);
  const ids=new Set<string>();for(const item of Object.values(p.items||{})){for(const file of (item as any)?.cloud_file_ids||[])ids.add(String(file))}
  const output={metric_id:id,school_id:schoolId,owner_id:owner,role,kind,title:String(p.title||p.meta?.title||(isWeekly?'تسليم أعمال الأسبوع '+String(p.week_number||''):isTeacherPeriod?'سجل المعلم الشامل':isReport?'تقرير أداء محفوظ':'سجل محفوظ')),score,evidence:ids.size,updated_at:String(row.updated_at||''),module_key:module,state_key:key,canonical:row.owner_key==='school'?'school':'user'};
  byId.set(id,output);
 }
 return [...byId.values()];
}
