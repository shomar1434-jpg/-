import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const text=(v:unknown)=>String(v??'').trim(), norm=(v:unknown)=>text(v).toLowerCase();
const managers=new Set(['manager','school_manager','principal','مدير','مديرة']);
const scopeOf=(x:any)=>({stage:text(x?.stage),grade:text(x?.grade),track_name:text(x?.track_name||x?.track),section_name:text(x?.section_name||x?.section)});
const applyScope=(q:any,s:any)=>{if(s.stage)q=q.eq('stage',s.stage);if(s.grade)q=q.eq('grade',s.grade);if(s.track_name)q=q.eq('track_name',s.track_name);if(s.section_name)q=q.eq('section_name',s.section_name);return q};
const studentKey=(r:any)=>text(r?.national_id)?'nid:'+text(r.national_id):text(r?.student_number)?'num:'+text(r.student_number):'name:'+norm(r?.student_name);

const stageLabel=(v:unknown)=>{const s=text(v);if(['رياض الأطفال','رياض اطفال','رياض أطفال','روضة'].includes(s))return 'رياض أطفال';if(['الطفولة المبكرة','طفولة مبكرة'].includes(s))return 'طفولة مبكرة';if(['الابتدائية','ابتدائية','ابتدائي'].includes(s))return 'ابتدائية';if(['المتوسطة','متوسطة','متوسط'].includes(s))return 'متوسطة';if(['الثانوية','ثانوية','ثانوي'].includes(s))return 'ثانوية';return s};
const gradeLabel=(v:unknown)=>{const s=text(v).replace(/^ال/,'');const m:any={'أول':'الأول','اول':'الأول','1':'الأول','١':'الأول','ثاني':'الثاني','2':'الثاني','٢':'الثاني','ثالث':'الثالث','3':'الثالث','٣':'الثالث','رابع':'الرابع','4':'الرابع','٤':'الرابع','خامس':'الخامس','5':'الخامس','٥':'الخامس','سادس':'السادس','6':'السادس','٦':'السادس'};return m[s]||text(v)};
const wantedGrades=(stage:string)=>stage==='ابتدائية'?['الرابع','الخامس','السادس']:['رياض أطفال','طفولة مبكرة','متوسطة','ثانوية'].includes(stage)?['الأول','الثاني','الثالث']:[];

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!service||!anon)return json({error:'ENV_MISSING'},500);
 const sb=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),requestId=crypto.randomUUID();
 try{
  const body:any=await req.json().catch(()=>({})),action=text(body.action),year=text(body.academicYear||'1448'),now=new Date().toISOString();
  let schoolId='',userId='',role='',accessMode:'school_manager'|'system_admin'='school_manager',canWrite=false,isSystemAdmin=false;
  const raw=text(req.headers.get('x-platform-session'));
  if(raw){
   const h=await sha256(raw),q=await sb.from('platform_sessions').select('*').eq('session_token_hash',h).eq('status','active').gt('expires_at',now).limit(1).maybeSingle();
   if(q.error)throw q.error; const s:any=q.data;
   if(!s?.school_id||!s?.user_id)return json({error:'SESSION_SCHOOL_REQUIRED',requestId},401);
   schoolId=String(s.school_id);userId=String(s.user_id);role=text(s.role);canWrite=managers.has(norm(role));
  }else{
   const bearer=text(req.headers.get('authorization')).replace(/^Bearer\s+/i,'');if(!bearer)return json({error:'SESSION_MISSING',requestId},401);
   const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),ur=await auth.auth.getUser(bearer),au=ur.data?.user;
   if(ur.error||!au)return json({error:'SYSTEM_ADMIN_SESSION_INVALID',requestId},401);
   const aq=await sb.from('system_admins').select('user_id').eq('user_id',au.id).eq('is_active',true).limit(1).maybeSingle();
   if(aq.error||!aq.data)return json({error:'SYSTEM_ADMIN_DENIED',requestId},403);
   schoolId=text(body.schoolId);if(!schoolId)return json({error:'SYSTEM_ADMIN_SCHOOL_REQUIRED',requestId},400);
   userId=au.id;role='system_admin';accessMode='system_admin';canWrite=true;isSystemAdmin=true;
  }
  const structureKey='academic_structure:'+year;
  const writeStructure=async(structure:any,marker='manager')=>{structure=structure&&typeof structure==='object'?structure:{academicYear:year,stages:[]};structure.academicYear=year;structure.updatedAt=now;const row={school_id:schoolId,owner_key:'school',module_key:'school_information',state_key:structureKey,payload:structure,updated_by:marker==='recovery'?'system_recovery':userId,updated_at:now,deleted_at:null};const q=await sb.from('platform_module_state').upsert(row,{onConflict:'school_id,owner_key,module_key,state_key'}).select('payload').single();if(q.error)throw q.error;return q.data.payload};
  const mergeScopeIntoStructure=(structure:any,scope:any)=>{const s=scopeOf(scope||{});s.stage=stageLabel(s.stage);s.grade=gradeLabel(s.grade);if(!s.stage||!s.grade||!s.section_name)return {structure,changed:false};structure=structure&&typeof structure==='object'?structuredClone(structure):{academicYear:year,stages:[]};if(!Array.isArray(structure.stages))structure.stages=[];let changed=false;let st=structure.stages.find((x:any)=>stageLabel(x?.name)===s.stage);if(!st){st={id:'stage_'+crypto.randomUUID(),name:s.stage,grades:[]};structure.stages.push(st);changed=true}if(!Array.isArray(st.grades))st.grades=[];for(const gn of wantedGrades(s.stage)){if(!st.grades.some((g:any)=>gradeLabel(g?.name)===gn)){st.grades.push({id:'grade_'+crypto.randomUUID(),name:gn,sections:[],tracks:[]});changed=true}}let gr=st.grades.find((g:any)=>gradeLabel(g?.name)===s.grade);if(!gr){gr={id:'grade_'+crypto.randomUUID(),name:s.grade,sections:[],tracks:[]};st.grades.push(gr);changed=true}if(!Array.isArray(gr.sections))gr.sections=[];if(!gr.sections.some((x:any)=>text(x?.name)===s.section_name)){gr.sections.push({id:'section_'+crypto.randomUUID(),name:s.section_name});changed=true}if(!Array.isArray(gr.tracks))gr.tracks=[];if(s.stage==='ثانوية'&&s.track_name&&!gr.tracks.some((x:any)=>text(x)===s.track_name)){gr.tracks.push(s.track_name);changed=true}return {structure,changed}};
  const deriveStructureFromStudents=async()=>{const q=await sb.from('students').select('stage,grade,track_name,section_name').eq('school_id',schoolId).eq('academic_year',year).neq('student_status','محذوف').limit(10000);if(q.error)throw q.error;let structure:any={academicYear:year,stages:[],updatedAt:now,recoveredFromStudents:true};for(const r of q.data||[]){const merged=mergeScopeIntoStructure(structure,r);structure=merged.structure}return structure};
  const structureGet=async()=>{const q=await sb.from('platform_module_state').select('payload,updated_at').eq('school_id',schoolId).eq('owner_key','school').eq('module_key','school_information').eq('state_key',structureKey).is('deleted_at',null).limit(1).maybeSingle();if(q.error)throw q.error;if(q.data?.payload)return q.data.payload;const recovered=await deriveStructureFromStudents();if((recovered.stages||[]).length&&canWrite)return await writeStructure(recovered,'recovery');return recovered};
  const ensureStructureScope=async(scope:any)=>{const current=await structureGet();const merged=mergeScopeIntoStructure(current,scope);if(merged.changed&&canWrite)return await writeStructure(merged.structure,'student_write');return merged.structure};
  const listScope=async(s:any)=>{let q=sb.from('students').select('*').eq('school_id',schoolId).eq('academic_year',year).neq('student_status','محذوف');q=applyScope(q,s);const r=await q.order('student_name',{ascending:true}).limit(5000);if(r.error)throw r.error;return r.data||[]};
  if(action==='health')return json({ok:true,service:'school-information-structure',version:'4.0.0-independent-school-persistence-refresh',schoolId,accessMode,requestId});
  if(action==='structure-get')return json({structure:await structureGet(),schoolId,accessMode,requestId});
  if(action==='structure-save'){
   if(!canWrite)return json({error:'STRUCTURE_WRITE_ROLE_DENIED',requestId},403);
   const structure=body.structure&&typeof body.structure==='object'?body.structure:{academicYear:year,stages:[]};const savedStructure=await writeStructure(structure,'manager');
   return json({ok:true,structure:savedStructure,schoolId,accessMode,requestId});
  }
  if(action==='students-list-scope'){
   const s=scopeOf(body.scope||{});return json({students:await listScope(s),scope:s,schoolId,accessMode,requestId});
  }
  if(['students-import-scope','student-add-scope','student-transfer-section','student-delete-scope'].includes(action)&&!canWrite)return json({error:'WRITE_ROLE_DENIED',requestId},403);
  if(action==='students-import-scope'){
   const mode=text(body.mode||'replace_scope'),s=scopeOf(body.scope||{}),rows=Array.isArray(body.students)?body.students:[];
   if(!s.stage||!s.grade||!s.section_name)return json({error:'STUDENT_SCOPE_REQUIRED',requestId},400);if(rows.length>5000)return json({error:'IMPORT_TOO_LARGE',requestId},413);
   let eq=sb.from('students').select('*').eq('school_id',schoolId).eq('academic_year',year);eq=applyScope(eq,s);const er=await eq.limit(5000);if(er.error)throw er.error;const existingScope:any[]=er.data||[];
   const schoolRowsQ=await sb.from('students').select('*').eq('school_id',schoolId).eq('academic_year',year).limit(10000);if(schoolRowsQ.error)throw schoolRowsQ.error;const schoolRows:any[]=schoolRowsQ.data||[];
   const byNid=new Map<string,any>(),byNum=new Map<string,any>(),byName=new Map<string,any[]>();
   for(const r of schoolRows){const nid=text(r.national_id),num=text(r.student_number),nm=norm(r.student_name);if(nid&&!byNid.has(nid))byNid.set(nid,r);if(num&&!byNum.has(num))byNum.set(num,r);if(nm){const a=byName.get(nm)||[];a.push(r);byName.set(nm,a)}}
   const incomingIds=new Set<string>();let saved=0,updated=0,restored=0,moved=0,skippedPreview=0;const seen=new Set<string>();
   for(const rawRow of rows){
    const row:any={school_id:schoolId,student_name:text(rawRow.student_name),student_number:text(rawRow.student_number)||null,stage:s.stage,grade:s.grade,track_name:s.track_name,noor_section_code:text(rawRow.noor_section_code),section_name:s.section_name,national_id:text(rawRow.national_id)||null,student_status:'نشط',academic_year:year};
    if(!row.student_name)continue;const k=studentKey(row);if(seen.has(k)){skippedPreview++;continue}seen.add(k);
    let old:any=null;if(row.national_id)old=byNid.get(row.national_id)||null;if(!old&&row.student_number)old=byNum.get(row.student_number)||null;if(!old){const sameName=byName.get(norm(row.student_name))||[];if(sameName.length===1)old=sameName[0]}
    if(old?.id){incomingIds.add(String(old.id));const wasDeleted=text(old.student_status)==='محذوف';const wasMoved=text(old.stage)!==s.stage||text(old.grade)!==s.grade||text(old.track_name)!==s.track_name||text(old.section_name)!==s.section_name;const q=await sb.from('students').update(row).eq('id',old.id).eq('school_id',schoolId);if(q.error)throw q.error;updated++;if(wasDeleted)restored++;if(wasMoved)moved++;}
    else{const q=await sb.from('students').insert(row).select('id').single();if(q.error)throw q.error;saved++;incomingIds.add(String(q.data.id));}
   }
   let archived=0;
   if(mode==='replace_scope'){
    for(const old of existingScope){if(incomingIds.has(String(old.id))||text(old.student_status)==='محذوف')continue;const q=await sb.from('students').update({student_status:'محذوف'}).eq('id',old.id).eq('school_id',schoolId);if(q.error)throw q.error;archived++;}
   }
   await ensureStructureScope(s);const students=await listScope(s);const totalQ=await sb.from('students').select('id',{count:'exact',head:true}).eq('school_id',schoolId).eq('academic_year',year).neq('student_status','محذوف');if(totalQ.error)throw totalQ.error;
   return json({ok:true,saved,updated,restored,moved,archived,skippedPreview,students,totalActive:Number(totalQ.count||0),scope:s,schoolId,accessMode,requestId});
  }
  if(action==='student-add-scope'){
   const s=scopeOf(body.scope||{}),student=body.student||{};if(!s.stage||!s.grade||!s.section_name||!text(student.student_name))return json({error:'STUDENT_SCOPE_REQUIRED',requestId},400);
   const row={school_id:schoolId,student_name:text(student.student_name),national_id:text(student.national_id)||null,student_number:text(student.student_number)||null,stage:s.stage,grade:s.grade,track_name:s.track_name,section_name:s.section_name,noor_section_code:text(student.noor_section_code),student_status:'نشط',academic_year:year};
   const q=await sb.from('students').insert(row).select('*').single();if(q.error)throw q.error;await ensureStructureScope(s);return json({ok:true,student:q.data,students:await listScope(s),schoolId,scope:s,requestId});
  }
  if(action==='student-transfer-section'){
   const id=text(body.id),s=scopeOf(body.scope||{}),target=text(body.targetSection);if(!id||!target)return json({error:'STUDENT_TRANSFER_REQUIRED',requestId},400);
   let check=sb.from('students').select('id,school_id,academic_year,stage,grade,track_name,section_name').eq('id',id).eq('school_id',schoolId).eq('academic_year',year).limit(1).maybeSingle();const cr=await check;if(cr.error)throw cr.error;if(!cr.data)return json({error:'STUDENT_NOT_FOUND',requestId},404);
   if(s.stage&&text(cr.data.stage)!==s.stage||s.grade&&text(cr.data.grade)!==s.grade||s.track_name&&text(cr.data.track_name)!==s.track_name)return json({error:'STUDENT_SCOPE_MISMATCH',requestId},409);
   const q=await sb.from('students').update({section_name:target,student_status:'نشط'}).eq('id',id).eq('school_id',schoolId).select('*').single();if(q.error)throw q.error;const targetScope={...s,section_name:target};await ensureStructureScope(targetScope);return json({ok:true,student:q.data,students:await listScope(targetScope),schoolId,requestId});
  }
  if(action==='student-delete-scope'){
   const id=text(body.id),s=scopeOf(body.scope||{});if(!id)return json({error:'STUDENT_ID_REQUIRED',requestId},400);
   let check=sb.from('students').select('*').eq('id',id).eq('school_id',schoolId).eq('academic_year',year).limit(1).maybeSingle();const cr=await check;if(cr.error)throw cr.error;if(!cr.data)return json({error:'STUDENT_NOT_FOUND',requestId},404);
   if(s.stage&&text(cr.data.stage)!==s.stage||s.grade&&text(cr.data.grade)!==s.grade||s.section_name&&text(cr.data.section_name)!==s.section_name)return json({error:'STUDENT_SCOPE_MISMATCH',requestId},409);
   // حذف منطقي فقط لضمان عدم فقدان بيانات المدرسة السابقة أو المراجع التاريخية.
   const q=await sb.from('students').update({student_status:'محذوف'}).eq('id',id).eq('school_id',schoolId);if(q.error)throw q.error;return json({ok:true,softDeleted:true,id,students:await listScope(s),schoolId,requestId});
  }
  return json({error:'ACTION_UNSUPPORTED',requestId},400);
 }catch(e){console.error('[school-information-structure]',requestId,e);return json({error:e instanceof Error?e.message:String(e),requestId},500)}
});
