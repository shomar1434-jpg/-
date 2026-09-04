import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const text=(v:unknown)=>String(v??'').trim();
const norm=(v:unknown)=>text(v).toLowerCase();
const managerRoles=new Set(['manager','school_manager','principal','مدير','مديرة']);

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'طريقة الطلب غير مدعومة',code:'METHOD_NOT_ALLOWED'},405);
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!service||!anon) return json({error:'إعدادات الخدمة غير مكتملة',code:'ENV_MISSING'},500);
  const sb=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const requestId=crypto.randomUUID();
  try{
    const body:any=await req.json().catch(()=>({}));
    const action=text(body.action||'bootstrap');
    const year=text(body.academicYear||'1448');
    const now=new Date().toISOString();
    let schoolId='', userId='', role='', accessMode:'school_manager'|'system_admin'='school_manager', canWrite=false;

    const rawPlatform=text(req.headers.get('x-platform-session'));
    if(rawPlatform){
      const hash=await sha256(rawPlatform);
      const sq=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).limit(1).maybeSingle();
      if(sq.error) throw sq.error;
      const session:any=sq.data;
      if(!session?.school_id||!session?.user_id) return json({error:'الجلسة غير صالحة أو غير مرتبطة بمدرسة',code:'SESSION_SCHOOL_REQUIRED',requestId},401);
      schoolId=String(session.school_id);userId=String(session.user_id);role=text(session.role);canWrite=managerRoles.has(norm(role))||managerRoles.has(role);
      await sb.from('platform_sessions').update({last_seen_at:now}).eq('id',session.id);
      // SECURITY: schoolId sent by a school user is never authoritative.
    }else{
      const bearer=text(req.headers.get('authorization')).replace(/^Bearer\s+/i,'');
      if(!bearer) return json({error:'جلسة الوصول مفقودة',code:'SESSION_MISSING',requestId},401);
      const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
      const ur=await auth.auth.getUser(bearer);const authUser=ur.data?.user;
      if(ur.error||!authUser) return json({error:'جلسة مدير النظام غير صالحة',code:'SYSTEM_ADMIN_SESSION_INVALID',requestId},401);
      const aq=await sb.from('system_admins').select('user_id,email,is_active').eq('user_id',authUser.id).eq('is_active',true).limit(1).maybeSingle();
      if(aq.error||!aq.data) return json({error:'ليس لديك صلاحية مدير النظام',code:'SYSTEM_ADMIN_DENIED',requestId},403);
      const requested=text(body.schoolId);
      if(!requested) return json({error:'يجب تحديد المدرسة من واجهة مدير النظام',code:'SYSTEM_ADMIN_SCHOOL_REQUIRED',requestId},400);
      const schoolCheck=await sb.from('schools').select('id,status').eq('id',requested).limit(1).maybeSingle();
      if(schoolCheck.error) throw schoolCheck.error;
      if(!schoolCheck.data) return json({error:'المدرسة غير موجودة',code:'SCHOOL_NOT_FOUND',requestId},404);
      schoolId=requested;userId=authUser.id;role='system_admin';accessMode='system_admin';canWrite=true;
    }

    const schoolQ=async()=>{
      const q=await sb.from('schools').select('id,school_name,school_code,status').eq('id',schoolId).limit(1).maybeSingle();
      if(q.error) throw q.error;if(!q.data) throw new Error('SCHOOL_NOT_FOUND');return q.data;
    };
    const currentStructure=async()=>{
      const key='academic_structure:'+year;
      const q=await sb.from('platform_module_state').select('payload').eq('school_id',schoolId).eq('owner_key','school').eq('module_key','school_information').eq('state_key',key).is('deleted_at',null).limit(1).maybeSingle();
      if(q.error)throw q.error;
      const payload:any=q.data?.payload||null;
      return payload&&Array.isArray(payload.stages)?payload:null;
    };
    const listStudents=async()=>{
      // RL21: الهيكل السحابي الحالي هو المصدر الوحيد المصرح له بإدخال طالب إلى التشغيل.
      // لا نجلب سجلات العام القديمة العامة ثم نفلترها؛ نستعلم فقط عن الصفوف/الفصول المعرفة في الهيكل الحالي.
      const structure:any=await currentStructure();
      if(!structure)return [];
      const byId=new Map<string,any>();
      for(const st of structure.stages||[]){
        const stage=text(st?.name);if(!stage)continue;
        for(const gr of (Array.isArray(st?.grades)?st.grades:[])){
          const grade=text(gr?.name);if(!grade)continue;
          const sections=(Array.isArray(gr?.sections)?gr.sections:[]).map((x:any)=>text(x?.name)).filter(Boolean);
          if(!sections.length)continue;
          const tracks=(Array.isArray(gr?.tracks)?gr.tracks:[]).map((x:any)=>text(x)).filter(Boolean);
          for(const section of sections){
            if(stage==='ثانوية'&&tracks.length){
              for(const track of tracks){
                const q=await sb.from('students').select('*').eq('school_id',schoolId).eq('academic_year',year).neq('student_status','محذوف').eq('stage',stage).eq('grade',grade).eq('track_name',track).eq('section_name',section).order('student_name',{ascending:true}).limit(5000);
                if(q.error)throw q.error;for(const r of q.data||[])byId.set(String(r.id),r);
              }
            }else{
              const q=await sb.from('students').select('*').eq('school_id',schoolId).eq('academic_year',year).neq('student_status','محذوف').eq('stage',stage).eq('grade',grade).eq('section_name',section).order('student_name',{ascending:true}).limit(5000);
              if(q.error)throw q.error;for(const r of q.data||[])byId.set(String(r.id),r);
            }
          }
        }
      }
      return [...byId.values()].sort((a:any,b:any)=>text(a.stage).localeCompare(text(b.stage),'ar')||text(a.grade).localeCompare(text(b.grade),'ar')||text(a.track_name).localeCompare(text(b.track_name),'ar')||text(a.section_name).localeCompare(text(b.section_name),'ar')||text(a.student_name).localeCompare(text(b.student_name),'ar'));
    };
    const listStaff=async()=>{
      const mq=await sb.from('school_members').select('*').eq('school_id',schoolId).neq('status','deleted').limit(5000);if(mq.error)throw mq.error;
      const members:any[]=mq.data||[],ids=[...new Set(members.map((m:any)=>text(m.user_id)).filter(Boolean))],identities:any[]=[];
      for(let i=0;i<ids.length;i+=200){const uq=await sb.from('users').select('*').in('id',ids.slice(i,i+200)).limit(500);if(!uq.error)identities.push(...(uq.data||[]));}
      const by=new Map(identities.map((u:any)=>[String(u.id),u]));
      return members.map((m:any)=>{const u:any=by.get(String(m.user_id))||{};return {...u,id:m.user_id||u.id,user_id:m.user_id||u.id,email:m.email||u.email||'',school_id:schoolId,role:m.role||u.role||'',role_label:m.role_label||u.role_label||'',status:m.status||u.status||'active'};});
    };

    if(action==='health') return json({ok:true,service:'school-information',version:'2.1.0-RL21-authoritative-structure-only',schoolId,userId,role,accessMode,requestId});
    if(action==='bootstrap') return json({school:await schoolQ(),students:await listStudents(),staff:await listStaff(),schoolId,accessMode,requestId});
    if(action==='school') return json({school:await schoolQ(),schoolId,accessMode,requestId});
    if(action==='students-list') return json({students:await listStudents(),schoolId,accessMode,requestId});
    if(action==='staff-list') return json({staff:await listStaff(),schoolId,accessMode,requestId});
    if(!canWrite) return json({error:'التعديل على مركز المعلومات متاح لمدير المدرسة أو مدير النظام فقط',code:'WRITE_ROLE_DENIED',requestId},403);

    if(action==='students-import'){
      const mode=text(body.mode||'append'),rows=Array.isArray(body.students)?body.students:[];
      if(rows.length>10000)return json({error:'عدد الطلاب في الدفعة أكبر من الحد المسموح',code:'IMPORT_TOO_LARGE',requestId},413);
      if(mode==='replace'){const del=await sb.from('students').delete().eq('school_id',schoolId).eq('academic_year',year);if(del.error)throw del.error;}
      let existing:any[]=[];
      if(mode!=='replace'){const eq=await sb.from('students').select('id,student_name,student_number,national_id,stage,grade,track_name,section_name,academic_year').eq('school_id',schoolId).eq('academic_year',year).neq('student_status','محذوف').limit(10000);if(eq.error)throw eq.error;existing=eq.data||[];}
      const keyOf=(r:any)=>[text(r.student_number),text(r.national_id),text(r.student_name),text(r.stage),text(r.grade),text(r.track_name),text(r.section_name)].join('|').toLowerCase();
      const existingKeys=new Set(existing.map(keyOf)),seen=new Set<string>(),insertRows:any[]=[];let skippedExisting=0,skippedPreview=0;
      for(const rawRow of rows){const row={school_id:schoolId,student_name:text(rawRow.student_name),student_number:text(rawRow.student_number)||null,stage:text(rawRow.stage)||'غير محدد',grade:text(rawRow.grade)||'غير محدد',track_name:text(rawRow.track_name),noor_section_code:text(rawRow.noor_section_code),section_name:text(rawRow.section_name)||'غير محدد',national_id:text(rawRow.national_id)||null,student_status:'نشط',academic_year:year};if(!row.student_name)continue;const k=keyOf(row);if(seen.has(k)){skippedPreview++;continue}seen.add(k);if(mode!=='replace'&&existingKeys.has(k)){skippedExisting++;continue}insertRows.push(row);}
      let saved=0;for(let i=0;i<insertRows.length;i+=500){const chunk=insertRows.slice(i,i+500),iq=await sb.from('students').insert(chunk);if(iq.error)throw iq.error;saved+=chunk.length;}
      return json({ok:true,saved,skippedExisting,skippedPreview,schoolId,accessMode,requestId});
    }
    if(action==='students-clear-year'){const del=await sb.from('students').delete().eq('school_id',schoolId).eq('academic_year',year);if(del.error)throw del.error;return json({ok:true,schoolId,accessMode,requestId});}
    if(action==='student-update'){
      const id=text(body.id);if(!id)return json({error:'معرف الطالب مفقود',code:'STUDENT_ID_REQUIRED',requestId},400);const p:any=body.student||{};
      const patch={student_name:text(p.student_name),student_number:text(p.student_number)||null,stage:text(p.stage)||'غير محدد',grade:text(p.grade)||'غير محدد',track_name:text(p.track_name),section_name:text(p.section_name)||'غير محدد',noor_section_code:text(p.noor_section_code),national_id:text(p.national_id)||null};
      const q=await sb.from('students').update(patch).eq('id',id).eq('school_id',schoolId).select('id').maybeSingle();if(q.error)throw q.error;if(!q.data)return json({error:'الطالب غير موجود في المدرسة الحالية',code:'STUDENT_SCOPE_DENIED',requestId},404);return json({ok:true,id,schoolId,accessMode,requestId});
    }
    if(action==='student-delete'){const id=text(body.id);if(!id)return json({error:'معرف الطالب مفقود',code:'STUDENT_ID_REQUIRED',requestId},400);const q=await sb.from('students').update({student_status:'محذوف'}).eq('id',id).eq('school_id',schoolId).select('id').maybeSingle();if(q.error)throw q.error;if(!q.data)return json({error:'الطالب غير موجود في المدرسة الحالية',code:'STUDENT_SCOPE_DENIED',requestId},404);return json({ok:true,id,schoolId,accessMode,requestId});}
    if(action==='teacher-profiles-list'){const q=await sb.from('school_teacher_profiles').select('*').eq('school_id',schoolId).limit(2000);if(q.error)throw q.error;return json({profiles:q.data||[],schoolId,accessMode,requestId});}
    if(action==='teacher-profile-upsert'){const p:any=body.profile||{},uid=text(p.user_id);if(!uid)return json({error:'معرف المعلم مفقود',code:'TEACHER_ID_REQUIRED',requestId},400);const row={school_id:schoolId,user_id:uid,teacher_name:text(p.teacher_name||p.name),email:text(p.email),subject:text(p.subject),weekly_lessons:Number(p.weekly_lessons||0),assignments:Array.isArray(p.assignments)?p.assignments:[],extra_roles:Array.isArray(p.extra_roles)?p.extra_roles:[],updated_at:now};const q=await sb.from('school_teacher_profiles').upsert(row,{onConflict:'school_id,user_id'});if(q.error)throw q.error;return json({ok:true,schoolId,accessMode,requestId});}
    if(action==='deputy-teacher-source-upsert'){const p:any=body.payload||{},row={school_id:schoolId,school_name:text(p.school_name),teachers:Array.isArray(p.teachers)?p.teachers:[],updated_at:text(p.updated_at)||now};const q=await sb.from('deputy_weekly_teacher_source').upsert(row,{onConflict:'school_id'});if(q.error)throw q.error;return json({ok:true,schoolId,accessMode,requestId});}
    return json({error:'عملية غير مدعومة',code:'ACTION_UNSUPPORTED',requestId},400);
  }catch(e){console.error('[school-information]',requestId,e);return json({error:e instanceof Error?e.message:String(e),code:'SCHOOL_INFORMATION_FATAL',requestId},500);}
});
