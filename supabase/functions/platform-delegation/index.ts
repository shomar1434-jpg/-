import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session, x-client-version','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
const ownerRoles=new Set(['manager','owner','school_manager','principal','agent','deputy','deputy_admin','deputy_academic','deputy_students','مدير','مديرة','وكيل']);
const allowedRoles=new Set(['student_advisor','activity_leader','health_advisor','kindergarten_teacher','admin_employee']);
const delegatedRoleOf=(task:any)=>String(task?.metadata?.delegatedRole||task?.metadata?.delegatedRoleCode||task?.record_id||task?.record_key||'').trim().toLowerCase();
const isFullSectionDelegation=(task:any)=>{
 const modern=String(task?.metadata?.accessMode||'')==='full_section';
 const legacy=String(task?.module_key||'')==='delegated_roles'&&String(task?.assignment_type||'')==='additional_role'&&String(task?.record_type||'')==='full_role_portal';
 return (modern||legacy)&&allowedRoles.has(delegatedRoleOf(task));
};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)return json({error:'إعدادات خدمة التفويض غير مكتملة'},500);
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const raw=req.headers.get('x-platform-session')||'';if(!raw)return json({error:'جلسة المنصة مفقودة'},401);
  const hash=await sha256(raw),now=new Date().toISOString();
  const {data:s,error:se}=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();if(se)throw se;if(!s)return json({error:'انتهت جلسة المنصة'},401);
  const action=new URL(req.url).searchParams.get('action')||'',body=await req.json().catch(()=>({}));
  const email=String(s.user_email||'').trim().toLowerCase();
  if(action==='my-access'){
   const {data,error}=await sb.from('central_tasks').select('id,title,status,start_date,due_date,metadata,module_key,record_type,record_id,record_key,assignment_type').eq('school_id',s.school_id).is('deleted_at',null).in('status',['active','in_progress','transferred','returned']).or(`assigned_to.eq.${s.user_id}${email?`,assignee_email.eq.${email}`:''}`).order('updated_at',{ascending:false});if(error)throw error;
   const nowMs=Date.now();
   const access=(data||[]).filter((t:any)=>isFullSectionDelegation(t)&&(!t.start_date||Date.parse(String(t.start_date))<=nowMs)).map((t:any)=>({taskId:t.id,title:t.title,status:t.status,delegatedRole:delegatedRoleOf(t),delegatedRoleLabel:String(t.metadata?.delegatedRoleLabel||''),startDate:t.start_date||null,dueDate:t.due_date||null}));
   return json({access});
  }
  if(String(action).startsWith('semester-plan-')){
   const taskId=String(body.delegatedTaskId||'');
   const {data:task,error:te}=await sb.from('central_tasks').select('id,status,start_date,assigned_to,assignee_email,metadata,module_key,record_type,record_id,record_key,assignment_type').eq('id',taskId).eq('school_id',s.school_id).is('deleted_at',null).maybeSingle();if(te)throw te;
   const mine=task&&(String(task.assigned_to||'')===String(s.user_id)||String(task.assignee_email||'').toLowerCase()===email);
   const delegatedRole=delegatedRoleOf(task);
   const started=!task?.start_date||Date.parse(String(task.start_date))<=Date.now();
   if(!task||!mine||!started||!['active','in_progress','transferred','returned'].includes(String(task.status||''))||!isFullSectionDelegation(task))return json({error:'لا يوجد تفويض نشط يسمح بتنفيذ هذه العملية'},403);
   const typeMap:Record<string,string>={student_advisor:'التوجيه الطلابي',activity_leader:'النشاط الطلابي',kindergarten_teacher:'رياض الأطفال',health_advisor:'التوجيه الصحي'};
   const planType=typeMap[delegatedRole]||'';if(!planType)return json({error:'القسم المفوض لا يستخدم الخطة الفصلية'},403);
   const academicYear=String(body.academicYear||'1448 هـ'),semester=String(body.semester||'الفصل الدراسي الأول');
   if(action==='semester-plan-list'){
    const {data,error}=await sb.from('semester_plan_weeks').select('*').eq('school_id',s.school_id).eq('academic_year',academicYear).eq('semester',semester).eq('plan_type',planType).eq('owner_user_id',s.user_id).order('week_order');if(error)throw error;return json({rows:data||[],planType,isManager:false,delegated:true});
   }
   if(action==='semester-plan-save-week'){
    const w:any=body.week||{},weekKey=String(w.weekKey||w.id||'').trim();if(!weekKey)return json({error:'معرف الأسبوع مفقود'},400);
    const existing=await sb.from('semester_plan_weeks').select('id,plan_status').eq('school_id',s.school_id).eq('plan_type',planType).eq('academic_year',academicYear).eq('semester',semester).eq('week_key',weekKey).eq('owner_user_id',s.user_id).maybeSingle();if(existing.error)throw existing.error;if(existing.data&&!['draft','returned'].includes(String(existing.data.plan_status||'')))return json({error:'لا يمكن تعديل أسبوع بعد إرساله أو اعتماده إلا إذا أعاده المدير للتعديل'},409);
    const row:any={school_id:s.school_id,owner_user_id:s.user_id,owner_role:delegatedRole,plan_type:planType,academic_year:academicYear,semester,week_key:weekKey,week_order:Number(w.weekOrder||0),title:String(w.title||''),dates:String(w.dates||''),behavior:String(w.behavior||''),event_name:w.event||null,is_vacation:!!w.isVacation,programs:Array.isArray(w.programs)?w.programs:[],notes:String(w.notes||''),plan_status:existing.data?.plan_status||'draft',updated_at:now};
    const {data,error}=await sb.from('semester_plan_weeks').upsert(row,{onConflict:'school_id,plan_type,academic_year,semester,week_key'}).select('*').single();if(error)throw error;return json({row,delegated:true});
   }
   if(action==='semester-plan-submit-week'){
    const id=String(body.id||'');const {data,error}=await sb.from('semester_plan_weeks').update({plan_status:'pending_manager',plan_submitted_at:now,manager_note:null,updated_at:now}).eq('id',id).eq('school_id',s.school_id).eq('owner_user_id',s.user_id).eq('plan_type',planType).in('plan_status',['draft','returned']).select('*').maybeSingle();if(error)throw error;if(!data)return json({error:'تعذر إرسال الأسبوع للاعتماد'},409);return json({row:data,delegated:true});
   }
   if(action==='semester-plan-submit-evidence'){
    const id=String(body.id||''),fileId=String(body.fileId||'');if(!fileId)return json({error:'ملف الشاهد مفقود'},400);
    const {data,error}=await sb.from('semester_plan_weeks').update({evidence_file_id:fileId,evidence_name:String(body.fileName||''),evidence_submitted_at:now,execution_status:'pending_manager',updated_at:now}).eq('id',id).eq('school_id',s.school_id).eq('owner_user_id',s.user_id).eq('plan_type',planType).eq('plan_status','approved').select('*').maybeSingle();if(error)throw error;if(!data)return json({error:'يجب اعتماد خطة الأسبوع قبل رفع شاهد التنفيذ'},409);return json({row:data,delegated:true});
   }
   return json({error:'عملية الخطة الفصلية غير مدعومة بالتفويض'},400);
  }
  if(action==='create'){
   const sessionRole=String(s.role||'').toLowerCase();if(!ownerRoles.has(sessionRole)&&!ownerRoles.has(String(s.role||'')))return json({error:'إنشاء التفويض متاح للمدير والوكيل فقط'},403);
   const delegatedRole=String(body.metadata?.delegatedRole||'');if(String(body.metadata?.accessMode||'')!=='full_section'||!allowedRoles.has(delegatedRole))return json({error:'الدور المحدد غير مسموح بتفويض واجهته كاملة'},403);
   const assignedTo=isUuid(body.assignedTo)?String(body.assignedTo):null,assigneeEmail=String(body.assigneeEmail||'').trim().toLowerCase()||null;if(!assignedTo&&!assigneeEmail)return json({error:'المستخدم المكلف مطلوب'},400);
   let membership:any=null;if(assignedTo){const {data,error}=await sb.from('school_members').select('user_id,email,role,status').eq('school_id',s.school_id).eq('user_id',assignedTo).maybeSingle();if(error)throw error;membership=data}
   if(!membership&&assigneeEmail){const {data,error}=await sb.from('school_members').select('user_id,email,role,status').eq('school_id',s.school_id).eq('email',assigneeEmail).maybeSingle();if(error)throw error;membership=data}
   if(!membership||String(membership.status||'').toLowerCase()!=='active')return json({error:'المستخدم يجب أن يكون عضواً مفعلاً في المدرسة الحالية قبل منحه تفويض دخول كامل'},409);
   const metadata={...(body.metadata||{}),accessMode:'full_section',delegatedRole,delegationEngine:'section-delegation-v1',created_via:'platform-delegation'};
   const row={school_id:s.school_id,module_key:'delegated_section',record_type:null,record_id:null,title:String(body.title||'تكليف دور إضافي').trim().slice(0,300),description:String(body.description||'').trim()||null,assignment_type:'additional_role',source_owner:'delegated_section',record_key:delegatedRole,created_by:s.user_id,owner_role:s.role,owner_label:body.ownerLabel||null,assigned_to:assignedTo||membership.user_id||null,assignee_email:assigneeEmail||String(membership.email||'').toLowerCase()||null,assignee_name:body.assigneeName||null,assignee_role:body.assigneeRole||membership.role||null,priority:['low','normal','high','urgent'].includes(body.priority)?body.priority:'normal',status:'active',start_date:body.startDate||null,due_date:body.dueDate||null,requires_approval:body.requiresApproval!==false,metadata};
   const {data:t,error}=await sb.from('central_tasks').insert(row).select('*').single();if(error)throw error;
   await sb.from('central_task_assignments').insert({school_id:s.school_id,task_id:t.id,assigned_to:row.assigned_to,assignee_email:row.assignee_email,assignee_name:row.assignee_name,assignee_role:row.assignee_role,assigned_by:s.user_id,assignment_reason:'تفويض دخول كامل لقسم',is_current:true});
   await sb.from('task_access_grants').insert({school_id:s.school_id,task_id:t.id,user_id:row.assigned_to,user_email:row.assignee_email,module_key:'section_'+delegatedRole,record_type:'section_access',record_id:null,permission_scope:'section',can_view:true,can_create:true,can_update:true,can_upload:true,can_submit:true,can_approve:false,can_delete:false,starts_at:body.startDate||now,expires_at:null,status:'active',granted_by:s.user_id});
   await sb.from('central_task_events').insert({school_id:s.school_id,task_id:t.id,actor_id:s.user_id,event_type:'created',event_note:'تم إنشاء تفويض دخول كامل للقسم',new_values:{delegatedRole,accessMode:'full_section'}});
   await sb.from('central_task_notifications').insert({school_id:s.school_id,task_id:t.id,recipient_user_id:row.assigned_to,recipient_email:row.assignee_email,notification_type:'assigned',title:'تكليف بدور كامل',message:`تم منحك صلاحية الدخول إلى قسم ${String(metadata.delegatedRoleLabel||delegatedRole)} بموجب التكليف: ${t.title}`});
   return json({task:t},201);
  }
  return json({error:'عملية غير مدعومة'},400);
 }catch(e){console.error('[platform-delegation]',e);return json({error:e instanceof Error?e.message:String(e)},500)}
});
