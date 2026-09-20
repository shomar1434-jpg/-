import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session, x-client-version',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const safeKey=(v:unknown,max=120)=>String(v||'').trim().replace(/[^\p{L}\p{N}._:@/\-]+/gu,'_').slice(0,max);
const managers=new Set(['manager','owner','school_manager','principal','مدير','مديرة']);
const agents=new Set(['agent','agency','wakil','vice','deputy','وكيل','وكيلة']);
const schoolAggregateModules=new Set(['teacher_comprehensive','admin_performance','admin_employee_records','weekly_teacher_work']);
const MAX_ITEMS=250;
const MAX_TOTAL_CHARS=6_500_000;
const PRIVATE_PERFORMANCE_MODULES=new Set(['manager','teacher','agent','student_advisor','student_advisor_analysis_tool','health_advisor','activity_leader','kindergarten_teacher','administrative_employee_portal','administrative_employee_library','admin_employee_management','admin_performance']);
const isPrivatePerformanceState=(moduleKey:string,stateKey:string)=>{
  const mk=String(moduleKey||'').toLowerCase(), sk=String(stateKey||'').toLowerCase();
  if(!PRIVATE_PERFORMANCE_MODULES.has(mk))return false;
  return /(^|_)perf_index_v1$/.test(sk)||/(^|_)perf_report_v1_/.test(sk)||/_performance_deleted_v1$/.test(sk)||/^performance_reports_archive_v2/.test(sk)||sk==='reports_archive'||sk==='school_reports'||/performance_reports_clean_v[123]$/.test(sk)||/^ss_performance_profile/.test(sk)||/^school_performance_module_v1:/.test(sk);
};
const performanceModulesForRole=(role:unknown)=>{
  const r=String(role||'').toLowerCase();
  if(['manager','principal','school_manager','owner','مدير','مديرة'].includes(r))return ['manager'];
  if(['agent','deputy','vice','wakil','agency','وكيل','وكيلة'].includes(r))return ['agent'];
  if(['teacher','performance','معلم','معلمة'].includes(r))return ['teacher'];
  if(['student_advisor','advisor','counselor'].includes(r))return ['student_advisor','student_advisor_analysis_tool'];
  if(['health_advisor','health-advisor'].includes(r))return ['health_advisor'];
  if(['activity_leader','activity-leader','activity'].includes(r))return ['activity_leader'];
  if(['kindergarten_teacher','kindergarten-teacher'].includes(r))return ['kindergarten_teacher'];
  if(['administrative_employee','admin_employee','employee_admin'].includes(r))return ['administrative_employee_portal','administrative_employee_library','admin_employee_management','admin_performance'];
  return [];
};

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const supabaseUrl=Deno.env.get('SUPABASE_URL');
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!supabaseUrl||!serviceRole) return json({error:'إعدادات محرك الاستمرارية غير مكتملة',code:'STATE_ENV_MISSING'},500);
  const sb=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
  const requestId=crypto.randomUUID();
  try{
    const raw=req.headers.get('x-platform-session')||'';
    if(!raw) return json({error:'جلسة المنصة مفقودة',code:'STATE_SESSION_MISSING',requestId},401);
    const hash=await sha256(raw), now=new Date().toISOString();
    const sessionLookup=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();
    if(sessionLookup.error) return json({error:'تعذر التحقق من جلسة المنصة',code:'STATE_SESSION_LOOKUP_FAILED',requestId},500);
    const s=sessionLookup.data;
    if(!s) return json({error:'انتهت جلسة المنصة',code:'STATE_SESSION_EXPIRED',requestId},401);
    await sb.from('platform_sessions').update({last_seen_at:now}).eq('id',s.id);

    const action=new URL(req.url).searchParams.get('action')||'';
    const body=req.method==='GET'?{}:await req.json().catch(()=>({}));
    const expectedSchoolId=String(body.expectedSchoolId||'').trim();
    if(expectedSchoolId && expectedSchoolId!==String(s.school_id||'')){
      return json({error:'جلسة السحابة لا تطابق المدرسة المفتوحة',code:'STATE_SCHOOL_CONTEXT_MISMATCH',requestId,sessionSchoolId:s.school_id,expectedSchoolId},409);
    }
    const sessionRole=String(s.role||'').toLowerCase();
    const isManager=managers.has(sessionRole)||managers.has(String(s.role||''));
    const isAgent=agents.has(sessionRole)||agents.has(String(s.role||''));
    const supervisorKey=isAgent?'agent':isManager?'manager':'';
    const isAdministrativeSupervisor=!!supervisorKey;
    const supervisorOwnsMembership=async(m:any)=>{
      if(!m||!isAdministrativeSupervisor)return false;
      const exact=String(m.supervisor_user_id||'').trim();
      if(exact)return exact===String(s.user_id||'');
      const mm=String(m.role_label||'').match(/^ADMIN_EMPLOYEE_SUPERVISOR:(manager|agent)$/i);
      const legacyRole=(mm?mm[1]:'manager').toLowerCase();
      if(legacyRole!==supervisorKey)return false;
      const sq=await sb.from('school_members').select('user_id').eq('school_id',s.school_id).eq('role',legacyRole).eq('status','active');
      if(sq.error)throw sq.error;
      const ids=[...new Set((sq.data||[]).map((x:any)=>String(x.user_id||'')).filter(Boolean))];
      if(ids.length!==1||ids[0]!==String(s.user_id||''))return false;
      if(m.id){const up=await sb.from('school_members').update({supervisor_user_id:s.user_id,updated_at:now}).eq('id',m.id).is('supervisor_user_id',null);if(up.error)throw up.error;}
      return true;
    };
    const moduleKey=safeKey(body.moduleKey||new URL(req.url).searchParams.get('moduleKey')||'',100);
    const scope=String(body.scope||'user')==='school'?'school':'user';
    const requestedOwnerKey=scope==='school'?'school':String(s.user_id||'');
    const ownerKey=requestedOwnerKey;
    if(!moduleKey&&action!=='health') return json({error:'moduleKey مطلوب',code:'STATE_MODULE_REQUIRED',requestId},400);

    if(action==='health') return json({ok:true,version:'1.10.0-RL183-manager-performance-follow',schoolId:s.school_id,userId:s.user_id,role:s.role});

    if(action==='pull'){
      const keys=Array.isArray(body.keys)&&body.keys.length?body.keys.slice(0,500).map((x:unknown)=>safeKey(x,220)).filter(Boolean):[];
      let q=sb.from('platform_module_state').select('module_key,state_key,payload,deleted_at,updated_at,owner_key,updated_by').eq('school_id',s.school_id).eq('module_key',moduleKey).in('owner_key',[requestedOwnerKey,String(s.user_id||'')]).order('updated_at',{ascending:true}).limit(4000);
      if(keys.length)q=q.in('state_key',keys);
      const {data,error}=await q;if(error)throw error;
      const accepted:any[]=[];const legacy:any[]=[];
      for(const row of data||[]){
        const priv=isPrivatePerformanceState(moduleKey,String(row.state_key||''));
        if(priv){
          if(String(row.owner_key)===String(s.user_id))accepted.push(row);
          else if(String(row.owner_key)==='school'&&String(row.updated_by||'')===String(s.user_id)){accepted.push({...row,owner_key:String(s.user_id)});legacy.push(row);}
        }else if(String(row.owner_key)===requestedOwnerKey)accepted.push(row);
      }
      // Safe legacy recovery: a school-scoped personal state is migrated only when updated_by proves the same current user.
      for(const row of legacy){
        const up={school_id:s.school_id,owner_key:String(s.user_id),module_key:moduleKey,state_key:row.state_key,payload:row.payload,updated_by:s.user_id,updated_at:row.updated_at||now,deleted_at:row.deleted_at||null};
        const r=await sb.from('platform_module_state').upsert(up,{onConflict:'school_id,owner_key,module_key,state_key'});if(r.error)console.warn('[platform-state][legacy-private-recovery]',r.error);
      }
      return json({items:accepted.map(({updated_by,...x}:any)=>x),scope,ownerKey:requestedOwnerKey,privateRecovered:legacy.length});
    }

    if(action==='pull-performance-archive'){
      const requestedTarget=String(body.ownerUserId||body.userId||'').trim();
      let archiveOwner=String(s.user_id||'');
      let archiveRole=String(s.role||'');
      let managerFollow=false;
      if(requestedTarget&&requestedTarget!==archiveOwner){
        if(!isManager)return json({error:'قراءة أرشيف مستخدم آخر تتطلب صلاحية مدير المدرسة',code:'STATE_PERFORMANCE_MANAGER_REQUIRED',requestId},403);
        const membership=await sb.from('school_members').select('user_id,role,status').eq('school_id',s.school_id).eq('user_id',requestedTarget).in('role',['teacher','performance']).eq('status','active').maybeSingle();
        if(membership.error)throw membership.error;
        if(!membership.data)return json({error:'المعلمة المحددة ليست عضوًا نشطًا في المدرسة الحالية',code:'STATE_PERFORMANCE_TARGET_NOT_IN_SCHOOL',requestId},403);
        archiveOwner=requestedTarget;
        archiveRole=String(membership.data.role||'teacher');
        managerFollow=true;
      }
      const modules=performanceModulesForRole(archiveRole);
      if(!modules.length)return json({items:[],scope:managerFollow?'manager-follow-performance':'user-performance',ownerKey:archiveOwner,role:archiveRole});
      const keys=Array.isArray(body.keys)&&body.keys.length?body.keys.slice(0,500).map((x:unknown)=>safeKey(x,220)).filter(Boolean):[];
      let query=sb.from('platform_module_state').select('module_key,state_key,payload,deleted_at,updated_at,owner_key,updated_by').eq('school_id',s.school_id).in('module_key',modules).in('owner_key',[archiveOwner,'school']).is('deleted_at',null).order('updated_at',{ascending:false}).limit(5000);
      if(keys.length)query=query.in('state_key',keys);
      const q=await query;
      if(q.error)throw q.error;
      const accepted:any[]=[];const legacy:any[]=[];
      for(const row of q.data||[]){
        if(!isPrivatePerformanceState(String(row.module_key||''),String(row.state_key||'')))continue;
        if(String(row.owner_key)===archiveOwner)accepted.push(row);
        else if(String(row.owner_key)==='school'&&String(row.updated_by||'')===archiveOwner){accepted.push({...row,owner_key:archiveOwner});legacy.push(row);}
      }
      for(const row of legacy){
        const up={school_id:s.school_id,owner_key:archiveOwner,module_key:row.module_key,state_key:row.state_key,payload:row.payload,updated_by:archiveOwner,updated_at:row.updated_at||now,deleted_at:null};
        const r=await sb.from('platform_module_state').upsert(up,{onConflict:'school_id,owner_key,module_key,state_key'});if(r.error)console.warn('[platform-state][performance-recovery]',r.error);
      }
      return json({items:accepted.map(({updated_by,...x}:any)=>x),scope:managerFollow?'manager-follow-performance':'user-performance',ownerKey:archiveOwner,role:archiveRole,modules,recovered:legacy.length,readOnly:managerFollow});
    }

    if(action==='pull-school-users'){
      if(!isManager && !(['admin_performance','admin_employee_records'].includes(moduleKey)&&isAgent) && !(moduleKey==='weekly_teacher_work'&&isAgent)) return json({error:'هذه القراءة تتطلب صلاحية المسؤول المباشر',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(!schoolAggregateModules.has(moduleKey)) return json({error:'هذا المصدر غير متاح للتجميع المدرسي',code:'STATE_AGGREGATE_MODULE_FORBIDDEN',requestId},403);
      const keys=Array.isArray(body.keys)?body.keys.slice(0,50).map((x:unknown)=>safeKey(x,220)).filter(Boolean):[];
      let allowedOwners:string[]|null=null;
      if(['admin_performance','admin_employee_records'].includes(moduleKey)&&isAdministrativeSupervisor){
        const {data:members,error:memberError}=await sb.from('school_members').select('id,user_id,role_label,status,supervisor_user_id').eq('school_id',s.school_id).in('role',['administrative_employee','admin_employee']).neq('status','deleted');if(memberError)throw memberError;
        const owned:any[]=[];for(const m of members||[])if(await supervisorOwnsMembership(m))owned.push(m);
        allowedOwners=owned.map((m:any)=>String(m.user_id||'')).filter(Boolean);
        if(!allowedOwners.length)return json({items:[],scope:'school-users',schoolId:s.school_id,supervisor:supervisorKey});
      }
      let q=sb.from('platform_module_state').select('module_key,state_key,payload,deleted_at,updated_at,owner_key').eq('school_id',s.school_id).eq('module_key',moduleKey).neq('owner_key','school').order('updated_at',{ascending:true}).limit(5000);
      if(allowedOwners)q=q.in('owner_key',allowedOwners);if(keys.length)q=q.in('state_key',keys);
      const {data,error}=await q;if(error)throw error;
      let result:any[]=data||[];
      if(moduleKey==='weekly_teacher_work'){
        result=result.filter((row:any)=>{
          try{
            const payload=JSON.parse(String(row?.payload?.value||'{}'));
            const rid=String(payload?.reviewer_id||'').trim();
            if(rid)return rid===String(s.user_id||'');
            return false;
          }catch(_){return false;}
        });
      }
      return json({items:result,scope:'school-users',schoolId:s.school_id,supervisor:['admin_performance','admin_employee_records'].includes(moduleKey)?supervisorKey:undefined});
    }


    if(action==='publish-weekly-plan'){
      if(!isManager&&!isAgent)return json({error:'هذه العملية تتطلب صلاحية المدير أو الوكيل',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(moduleKey!=='weekly_teacher_work')return json({error:'مصدر خطة الأسبوع غير صحيح',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
      const targetUserId=String(body.ownerUserId||'').trim();
      if(!targetUserId)return json({error:'معرف المعلم مطلوب',code:'STATE_TARGET_USER_REQUIRED',requestId},400);
      const membership=await sb.from('school_members').select('id,user_id,role,status').eq('school_id',s.school_id).eq('user_id',targetUserId).neq('status','deleted').maybeSingle();
      if(membership.error)throw membership.error;
      if(!membership.data)return json({error:'المعلم غير مرتبط بالمدرسة الحالية',code:'STATE_TARGET_NOT_SCHOOL_MEMBER',requestId},403);
      const role=String(membership.data.role||'').toLowerCase();
      if(!['teacher','performance','معلم','معلمة'].includes(role))return json({error:'المستخدم المستهدف ليس معلمًا',code:'STATE_TARGET_NOT_TEACHER',requestId},403);
      const payload=body.payload&&typeof body.payload==='object'?body.payload:{};
      if(!payload.week_id||!payload.execution_confirmed_at)return json({error:'لا يمكن نشر أسبوع غير مؤكد للتنفيذ',code:'STATE_WEEK_NOT_CONFIRMED',requestId},400);
      payload.school_id=s.school_id;payload.teacher_id=targetUserId;payload.reviewer_id=String(s.user_id||'');payload.reviewer_role=isAgent?'agent':'manager';payload.published_at=now;
      const value=JSON.stringify(payload);if(value.length>MAX_TOTAL_CHARS)return json({error:'حجم خطة الأسبوع كبير جدًا',code:'STATE_PAYLOAD_TOO_LARGE',requestId},413);
      const up=await sb.from('platform_module_state').upsert({school_id:s.school_id,owner_key:targetUserId,module_key:'weekly_teacher_work',state_key:'weekly_active_plan_v1',payload:{value},updated_by:s.user_id,updated_at:now,deleted_at:null},{onConflict:'school_id,owner_key,module_key,state_key'});
      if(up.error)throw up.error;
      return json({ok:true,ownerKey:targetUserId,stateKey:'weekly_active_plan_v1',weekId:payload.week_id,reviewerId:String(s.user_id||'')});
    }


    if(action==='close-weekly-plan'){
      if(!isManager&&!isAgent)return json({error:'هذه العملية تتطلب صلاحية المدير أو الوكيل',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(moduleKey!=='weekly_teacher_work')return json({error:'مصدر خطة الأسبوع غير صحيح',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
      const targetUserId=String(body.ownerUserId||'').trim(),weekId=String(body.weekId||'').trim();
      if(!targetUserId||!weekId)return json({error:'معرف المعلم والأسبوع مطلوبان',code:'STATE_WEEK_CLOSE_INPUT_REQUIRED',requestId},400);
      const existing=await sb.from('platform_module_state').select('payload,deleted_at').eq('school_id',s.school_id).eq('owner_key',targetUserId).eq('module_key','weekly_teacher_work').eq('state_key','weekly_active_plan_v1').maybeSingle();
      if(existing.error)throw existing.error;
      if(!existing.data||existing.data.deleted_at)return json({error:'لا توجد خطة أسبوع منشورة لهذا المعلم',code:'STATE_WEEK_PLAN_NOT_FOUND',requestId},404);
      let payload:any={};try{payload=JSON.parse(String(existing.data.payload?.value||'{}'))}catch(_){return json({error:'بيانات خطة الأسبوع تالفة',code:'STATE_WEEK_PLAN_INVALID',requestId},409)}
      if(String(payload.week_id||'')!==weekId)return json({error:'الخطة المنشورة الحالية تخص أسبوعًا آخر',code:'STATE_WEEK_PLAN_MISMATCH',requestId},409);
      if(String(payload.reviewer_id||'')!==String(s.user_id||''))return json({error:'لا يمكن إغلاق أسبوع يتبع مسؤولاً آخر',code:'STATE_WEEK_REVIEWER_MISMATCH',requestId},403);
      payload.status='مغلق';payload.execution_state='closed';payload.closed_at=payload.closed_at||now;payload.updated_at=now;
      const up=await sb.from('platform_module_state').upsert({school_id:s.school_id,owner_key:targetUserId,module_key:'weekly_teacher_work',state_key:'weekly_active_plan_v1',payload:{value:JSON.stringify(payload)},updated_by:s.user_id,updated_at:now,deleted_at:null},{onConflict:'school_id,owner_key,module_key,state_key'});
      if(up.error)throw up.error;
      return json({ok:true,ownerKey:targetUserId,weekId,closedAt:payload.closed_at});
    }

    if(action==='save-weekly-evidence-draft'){
      if(moduleKey!=='weekly_teacher_work')return json({error:'مصدر الشاهد غير صحيح',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
      const teacherId=String(s.user_id||'').trim(),incoming=body.payload&&typeof body.payload==='object'?body.payload:{},weekId=String(incoming.week_id||'').trim(),itemKey=safeKey(incoming.item_key,180);
      if(!teacherId||!weekId||!itemKey)return json({error:'بيانات ربط الشاهد غير مكتملة',code:'STATE_WEEKLY_EVIDENCE_INPUT_REQUIRED',requestId},400);
      const planRow=await sb.from('platform_module_state').select('payload,deleted_at').eq('school_id',s.school_id).eq('owner_key',teacherId).eq('module_key','weekly_teacher_work').eq('state_key','weekly_active_plan_v1').maybeSingle();
      if(planRow.error)throw planRow.error;
      if(!planRow.data||planRow.data.deleted_at)return json({error:'لا توجد خطة أسبوع مؤكدة ومنشورة لك',code:'STATE_WEEK_PLAN_NOT_FOUND',requestId},409);
      let plan:any={};try{plan=JSON.parse(String(planRow.data.payload?.value||'{}'))}catch(_){return json({error:'بيانات خطة الأسبوع تالفة',code:'STATE_WEEK_PLAN_INVALID',requestId},409)}
      if(String(plan.week_id||'')!==weekId)return json({error:'الشاهد لا يطابق الأسبوع المؤكد حاليًا',code:'STATE_WEEK_EVIDENCE_WEEK_MISMATCH',requestId},409);
      if(String(plan.execution_state||'')!=='in_progress'||['مغلق','مؤرشف','إجازة'].includes(String(plan.status||'')))return json({error:'تم إغلاق هذا الأسبوع ولا يمكن رفع شاهد جديد',code:'STATE_WEEK_CLOSED',requestId},409);
      const ids=[...new Set((Array.isArray(incoming.cloud_file_ids)?incoming.cloud_file_ids:[]).map((x:unknown)=>String(x||'').trim()).filter(Boolean))].slice(0,10);
      if(!ids.length)return json({error:'معرف الملف السحابي مطلوب',code:'STATE_WEEKLY_EVIDENCE_FILE_REQUIRED',requestId},400);
      const files=await sb.from('platform_files').select('id,display_name,original_name,mime_type,file_size,owner_user_id,uploaded_by,ownership_scope').eq('school_id',s.school_id).in('id',ids).eq('status','active').is('deleted_at',null);
      if(files.error)throw files.error;
      const ownedFiles=(files.data||[]).filter((x:any)=>String(x.owner_user_id||x.uploaded_by||'')===teacherId);
      if(ownedFiles.length!==ids.length)return json({error:'تعذر التحقق من ملكية الشاهد',code:'STATE_WEEKLY_EVIDENCE_VERIFICATION_FAILED',requestId},403);
      const stateKey='weekly_evidence_draft_v1:'+weekId+':'+teacherId;
      const existing=await sb.from('platform_module_state').select('payload,deleted_at').eq('school_id',s.school_id).eq('owner_key',teacherId).eq('module_key','weekly_teacher_work').eq('state_key',stateKey).maybeSingle();
      if(existing.error)throw existing.error;
      let draft:any={week_id:weekId,teacher_id:teacherId,items:{}};if(existing.data&&!existing.data.deleted_at){try{draft=JSON.parse(String(existing.data.payload?.value||'{}'))||draft}catch(_){}}
      const previous=draft.items&&typeof draft.items==='object'?draft.items[itemKey]:null;
      if(previous&&Array.isArray(previous.cloud_file_ids)&&previous.cloud_file_ids.length){
        const submissionKey='weekly_submission_v1:'+weekId+':'+teacherId;
        const submissionRow=await sb.from('platform_module_state').select('payload,deleted_at').eq('school_id',s.school_id).eq('owner_key',teacherId).eq('module_key','weekly_teacher_work').eq('state_key',submissionKey).maybeSingle();
        if(submissionRow.error)throw submissionRow.error;
        let reviewStatus='',reviewedAt='';if(submissionRow.data&&!submissionRow.data.deleted_at){try{const submission=JSON.parse(String(submissionRow.data.payload?.value||'{}'));reviewStatus=String(submission.items?.[itemKey]?.review_status||'');reviewedAt=String(submission.items?.[itemKey]?.reviewed_at||'')}catch(_){}}
        const previousSavedAt=String(previous.cloud_synced_at||previous.updated_at||'');
        if(!['returned','rejected'].includes(reviewStatus)||(reviewedAt&&previousSavedAt&&previousSavedAt>reviewedAt))return json({error:'يوجد شاهد محفوظ لهذه المهمة؛ لا يسمح برفع بديل إلا بعد إعادته أو رفضه من المسؤول',code:'STATE_WEEKLY_EVIDENCE_ALREADY_LOCKED',requestId},409);
      }
      draft.items=draft.items&&typeof draft.items==='object'?draft.items:{};const primary:any=ownedFiles[0]||{};
      draft.items[itemKey]={...(draft.items[itemKey]||{}),cloud_file_ids:ids,file_name:String(incoming.file_name||primary.display_name||primary.original_name||''),file_type:String(incoming.file_type||primary.mime_type||''),file_size:Number(incoming.file_size||primary.file_size||0),cloud_synced_at:now,review_status:'',review_reason:'',updated_at:now};draft.week_id=weekId;draft.teacher_id=teacherId;draft.updated_at=now;
      const value=JSON.stringify(draft);if(value.length>MAX_TOTAL_CHARS)return json({error:'حجم مسودة الشواهد كبير جدًا',code:'STATE_PAYLOAD_TOO_LARGE',requestId},413);
      const up=await sb.from('platform_module_state').upsert({school_id:s.school_id,owner_key:teacherId,module_key:'weekly_teacher_work',state_key:stateKey,payload:{value},updated_by:teacherId,updated_at:now,deleted_at:null},{onConflict:'school_id,owner_key,module_key,state_key'});if(up.error)throw up.error;
      return json({ok:true,stateKey,weekId,itemKey,cloud_file_ids:ids});
    }

    if(action==='submit-weekly-submission'){
      if(moduleKey!=='weekly_teacher_work')return json({error:'مصدر التسليم غير صحيح',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
      const payload=body.payload&&typeof body.payload==='object'?body.payload:{};
      const teacherId=String(s.user_id||'').trim(),weekId=String(payload.week_id||'').trim();
      if(!teacherId||!weekId)return json({error:'تعذر تحديد المعلم أو الأسبوع',code:'STATE_WEEKLY_SUBMISSION_INPUT_REQUIRED',requestId},400);
      const planRow=await sb.from('platform_module_state').select('payload,deleted_at').eq('school_id',s.school_id).eq('owner_key',teacherId).eq('module_key','weekly_teacher_work').eq('state_key','weekly_active_plan_v1').maybeSingle();
      if(planRow.error)throw planRow.error;
      if(!planRow.data||planRow.data.deleted_at)return json({error:'لا توجد خطة أسبوع مؤكدة ومنشورة لك',code:'STATE_WEEK_PLAN_NOT_FOUND',requestId},409);
      let plan:any={};try{plan=JSON.parse(String(planRow.data.payload?.value||'{}'))}catch(_){return json({error:'بيانات خطة الأسبوع تالفة',code:'STATE_WEEK_PLAN_INVALID',requestId},409)}
      if(String(plan.week_id||'')!==weekId)return json({error:'التنفيذ المرسل لا يطابق الأسبوع المؤكد حاليًا',code:'STATE_WEEK_SUBMISSION_WEEK_MISMATCH',requestId},409);
      if(String(plan.execution_state||'')!=='in_progress'||['مغلق','مؤرشف','إجازة'].includes(String(plan.status||'')))return json({error:'تم إغلاق هذا الأسبوع ولا يمكن رفع أو إرسال شواهد جديدة له',code:'STATE_WEEK_CLOSED',requestId},409);
      const reviewerId=String(plan.reviewer_id||'').trim();
      if(!reviewerId)return json({error:'لم يتم تحديد مسؤول مراجعة الأسبوع',code:'STATE_WEEK_REVIEWER_REQUIRED',requestId},409);
      payload.school_id=s.school_id;payload.teacher_id=teacherId;payload.reviewer_id=reviewerId;payload.reviewer_email=String(plan.reviewer_email||payload.reviewer_email||'');payload.reviewer_role=String(plan.reviewer_role||payload.reviewer_role||'agent');payload.reviewer_name=String(plan.reviewer_name||payload.reviewer_name||'');payload.delivery_status='delivered';payload.delivered_at=payload.delivered_at||now;payload.updated_at=now;
      const submissionItems=payload.items&&typeof payload.items==='object'?payload.items:{};
      const allEvidenceIds:string[]=[];const missingRequired:string[]=[];
      for(const [itemKey,itemValue] of Object.entries(submissionItems)){
       const item:any=itemValue&&typeof itemValue==='object'?itemValue:{};const ids=[...new Set((Array.isArray(item.cloud_file_ids)?item.cloud_file_ids:[]).map((x:unknown)=>String(x||'').trim()).filter(Boolean))].slice(0,10);item.cloud_file_ids=ids;allEvidenceIds.push(...ids);
       const completed=['تم التنفيذ','مكتمل','مكلف وتم التنفيذ'].includes(String(item.status||''));const hasText=!!String(item.evidence_value||'').trim();if(item.evidence_required===true&&completed&&!ids.length&&!hasText)missingRequired.push(String(item.title||itemKey));
      }
      if(missingRequired.length)return json({error:'الشاهد المطلوب غير مرفق لـ: '+missingRequired.join('، '),code:'STATE_WEEKLY_REQUIRED_EVIDENCE_MISSING',requestId},409);
      const uniqueEvidenceIds=[...new Set(allEvidenceIds)];
      if(uniqueEvidenceIds.length){const evidenceRows=await sb.from('platform_files').select('id,owner_user_id,uploaded_by').eq('school_id',s.school_id).in('id',uniqueEvidenceIds).eq('status','active').is('deleted_at',null);if(evidenceRows.error)throw evidenceRows.error;const verified=new Set((evidenceRows.data||[]).filter((x:any)=>String(x.owner_user_id||x.uploaded_by||'')===teacherId).map((x:any)=>String(x.id)));if(verified.size!==uniqueEvidenceIds.length)return json({error:'تعذر التحقق من ملكية أحد الشواهد قبل التسليم',code:'STATE_WEEKLY_EVIDENCE_VERIFICATION_FAILED',requestId},403)}
      payload.items=submissionItems;payload.evidence_count=uniqueEvidenceIds.length;payload.evidence_verified_at=now;
      const stateKey='weekly_submission_v1:'+weekId+':'+teacherId;
      const value=JSON.stringify(payload);if(value.length>MAX_TOTAL_CHARS)return json({error:'حجم التسليم كبير جدًا',code:'STATE_PAYLOAD_TOO_LARGE',requestId},413);
      const up=await sb.from('platform_module_state').upsert({school_id:s.school_id,owner_key:teacherId,module_key:'weekly_teacher_work',state_key:stateKey,payload:{value},updated_by:teacherId,updated_at:now,deleted_at:null},{onConflict:'school_id,owner_key,module_key,state_key'});
      if(up.error)throw up.error;
      return json({ok:true,teacher_id:teacherId,stateKey,weekId,reviewerId});
    }

    if(action==='review-weekly-submission'){
      if(!isManager&&!isAgent)return json({error:'هذه العملية تتطلب صلاحية المسؤول المباشر',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(moduleKey!=='weekly_teacher_work')return json({error:'مصدر التسليم غير صحيح',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
      const targetUserId=String(body.ownerUserId||'').trim(),stateKey=safeKey(body.stateKey,220),itemKey=String(body.itemKey||'').trim(),decision=String(body.decision||'').trim(),reason=String(body.reason||'').trim();
      if(!targetUserId||!stateKey||!itemKey)return json({error:'بيانات قرار المراجعة غير مكتملة',code:'STATE_REVIEW_INPUT_REQUIRED',requestId},400);
      if(!['approved','returned','rejected'].includes(decision))return json({error:'قرار المراجعة غير مدعوم',code:'STATE_REVIEW_DECISION_INVALID',requestId},400);
      if((decision==='returned'||decision==='rejected')&&!reason)return json({error:'سبب الإعادة أو عدم الاعتماد إلزامي',code:'STATE_REVIEW_REASON_REQUIRED',requestId},400);
      const existing=await sb.from('platform_module_state').select('payload,deleted_at,owner_key').eq('school_id',s.school_id).eq('owner_key',targetUserId).eq('module_key','weekly_teacher_work').eq('state_key',stateKey).maybeSingle();
      if(existing.error)throw existing.error;
      if(!existing.data||existing.data.deleted_at)return json({error:'تعذر العثور على تسليم المعلم',code:'STATE_WEEKLY_SUBMISSION_NOT_FOUND',requestId},404);
      let payload:any={};try{payload=JSON.parse(String(existing.data.payload?.value||'{}'))}catch(_){return json({error:'بيانات التسليم تالفة',code:'STATE_WEEKLY_SUBMISSION_INVALID',requestId},409)}
      const rid=String(payload.reviewer_id||'').trim();
      if(!rid||rid!==String(s.user_id||''))return json({error:'هذا التسليم مرتبط بمسؤول آخر',code:'STATE_WEEKLY_REVIEWER_MISMATCH',requestId},403);
      const items=payload.items&&typeof payload.items==='object'?payload.items:{};const item=items[itemKey];
      if(!item)return json({error:'المهمة غير موجودة داخل التسليم',code:'STATE_WEEKLY_ITEM_NOT_FOUND',requestId},404);
      const evidencePatch=body.evidencePatch&&typeof body.evidencePatch==='object'?body.evidencePatch:null;
      if(evidencePatch&&Array.isArray(evidencePatch.cloud_file_ids)&&evidencePatch.cloud_file_ids.length){
       const requestedIds=[...new Set(evidencePatch.cloud_file_ids.map((x:unknown)=>String(x||'').trim()).filter(Boolean))].slice(0,10);
       const files=await sb.from('platform_files').select('id,school_id,owner_user_id,uploaded_by,ownership_scope,status,deleted_at,display_name,original_name,mime_type,file_size').eq('school_id',s.school_id).in('id',requestedIds).eq('status','active').is('deleted_at',null);
       if(files.error)throw files.error;
       const owned=(files.data||[]).filter((x:any)=>String(x.owner_user_id||x.uploaded_by||'')===targetUserId);const valid=owned.map((x:any)=>String(x.id));
       if(valid.length!==requestedIds.length)return json({error:'تعذر التحقق من ملكية أحد الشواهد المرفقة',code:'STATE_WEEKLY_EVIDENCE_OWNERSHIP_MISMATCH',requestId},403);
       const primary:any=owned[0]||{};
       item.cloud_file_ids=requestedIds;item.file_name=String(evidencePatch.file_name||primary.display_name||primary.original_name||item.file_name||'');item.file_type=String(evidencePatch.file_type||primary.mime_type||item.file_type||'');item.file_size=Number(evidencePatch.file_size||primary.file_size||item.file_size||0);item.cloud_synced_at=item.cloud_synced_at||now;
      }
      item.review_status=decision;item.reviewed_at=now;item.reviewed_by=String(s.user_id||'');item.review_reason=reason;
      if(decision==='approved')item.status='مكتمل';else if(decision==='returned')item.status='ناقص';else item.status='غير منفذ';
      const reviewedItems=Object.values(items);const approvedCount=reviewedItems.filter((x:any)=>x&&x.review_status==='approved').length;
      payload.items=items;payload.approved_count=approvedCount;payload.approved_executive_score=Math.round(approvedCount*100/(reviewedItems.length||1));payload.updated_at=now;payload.last_review_at=now;payload.last_review_by=String(s.user_id||'');
      const up=await sb.from('platform_module_state').upsert({school_id:s.school_id,owner_key:targetUserId,module_key:'weekly_teacher_work',state_key:stateKey,payload:{value:JSON.stringify(payload)},updated_by:s.user_id,updated_at:now,deleted_at:null},{onConflict:'school_id,owner_key,module_key,state_key'});
      if(up.error)throw up.error;
      return json({ok:true,payload,ownerKey:targetUserId,stateKey});
    }

    if(action==='pull-user'){
      if(!isAdministrativeSupervisor) return json({error:'هذه القراءة تتطلب صلاحية المسؤول المباشر',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(!['admin_performance','admin_employee_records'].includes(moduleKey)) return json({error:'هذه القراءة مخصصة لأداء الموظف الإداري',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
      const targetUserId=String(body.ownerUserId||body.userId||'').trim();
      if(!targetUserId) return json({error:'معرف الموظف الإداري مطلوب',code:'STATE_TARGET_USER_REQUIRED',requestId},400);
      const membership=await sb.from('school_members').select('id,user_id,role,status,role_label,supervisor_user_id').eq('school_id',s.school_id).eq('user_id',targetUserId).in('role',['administrative_employee','admin_employee']).neq('status','deleted').maybeSingle();
      if(membership.error) throw membership.error;
      if(!membership.data) return json({error:'المستخدم ليس موظفًا إداريًا في المدرسة الحالية',code:'STATE_TARGET_NOT_ADMIN_EMPLOYEE',requestId},403);
      if(!(await supervisorOwnsMembership(membership.data)))return json({error:'هذا الموظف يتبع مسؤولاً مباشرًا آخر',code:'STATE_TARGET_SUPERVISOR_MISMATCH',requestId},403);
      const keys=Array.isArray(body.keys)?body.keys.slice(0,100).map((x:unknown)=>safeKey(x,220)).filter(Boolean):[];
      let q=sb.from('platform_module_state').select('module_key,state_key,payload,deleted_at,updated_at,owner_key').eq('school_id',s.school_id).eq('module_key',moduleKey).eq('owner_key',targetUserId).order('updated_at',{ascending:true}).limit(2000);
      if(keys.length) q=q.in('state_key',keys);
      const {data,error}=await q;if(error) throw error;
      return json({items:data||[],scope:'target-user',ownerKey:targetUserId});
    }

    if(action==='manager-upsert-user'){
      if(!isAdministrativeSupervisor) return json({error:'هذه العملية تتطلب صلاحية المسؤول المباشر',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(!['admin_performance','admin_employee_records'].includes(moduleKey)) return json({error:'هذه العملية مخصصة لأداء الموظف الإداري',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
      const targetUserId=String(body.ownerUserId||body.userId||'').trim();
      if(!targetUserId) return json({error:'معرف الموظف الإداري مطلوب',code:'STATE_TARGET_USER_REQUIRED',requestId},400);
      const membership=await sb.from('school_members').select('id,user_id,role,status,role_label,supervisor_user_id').eq('school_id',s.school_id).eq('user_id',targetUserId).in('role',['administrative_employee','admin_employee']).neq('status','deleted').maybeSingle();
      if(membership.error) throw membership.error;
      if(!membership.data) return json({error:'المستخدم ليس موظفًا إداريًا في المدرسة الحالية',code:'STATE_TARGET_NOT_ADMIN_EMPLOYEE',requestId},403);
      if(!(await supervisorOwnsMembership(membership.data)))return json({error:'هذا الموظف يتبع مسؤولاً مباشرًا آخر',code:'STATE_TARGET_SUPERVISOR_MISMATCH',requestId},403);
      const items=Array.isArray(body.items)?body.items:[];
      if(items.length>MAX_ITEMS) return json({error:`الحد الأعلى ${MAX_ITEMS} عنصرًا في الدفعة`,code:'STATE_BATCH_TOO_LARGE',requestId},413);
      const rows:any[]=[];let totalChars=0;
      for(const item of items){const stateKey=safeKey(item?.key,220);if(!stateKey)continue;const deleted=!!item?.deleted;const value=deleted?null:String(item?.value??'');totalChars+=value?.length||0;rows.push({school_id:s.school_id,owner_key:targetUserId,module_key:moduleKey,state_key:stateKey,payload:deleted?null:{value},updated_by:s.user_id,updated_at:now,deleted_at:deleted?now:null});}
      // Keep each teacher performance report and its archive index in the same database upsert.
      // This repairs the failure mode where the report write succeeds but the following index request is aborted.
      if(moduleKey==='teacher'&&!rows.some((r:any)=>r.state_key==='teacher_perf_index_v1')){
        const reportRows=rows.filter((r:any)=>!r.deleted_at&&String(r.state_key||'').startsWith('teacher_perf_report_v1_')&&r.payload?.value);
        if(reportRows.length){
          const iq=await sb.from('platform_module_state').select('payload').eq('school_id',s.school_id).eq('owner_key',String(s.user_id)).eq('module_key','teacher').eq('state_key','teacher_perf_index_v1').is('deleted_at',null).maybeSingle();
          if(iq.error)throw iq.error;
          let index:any[]=[];
          try{const parsed=JSON.parse(String(iq.data?.payload?.value||'[]'));if(Array.isArray(parsed))index=parsed;}catch(_){index=[];}
          for(const rr of reportRows){
            let full:any=null;try{full=JSON.parse(String(rr.payload?.value||''));}catch(_){full=null;}
            if(!full||typeof full!=='object')continue;
            const id=String(full.id||'').trim(),cat=String(full.category||full.archiveFolderId||'').trim();
            if(!id||!cat)continue;
            const sk=String(rr.state_key||'');
            const meta={id,programName:String(full.programName||full.title||'تقرير'),title:String(full.title||full.programName||'تقرير'),category:cat,categoryName:String(full.categoryName||full.archiveFolderName||''),archiveFolderId:cat,archiveFolderName:String(full.archiveFolderName||full.categoryName||''),archiveRole:'teacher',archiveType:'performanceReport',createdAt:String(full.createdAt||''),updatedAt:String(full.updatedAt||''),stateKey:sk,storageEngine:'PerformanceArchiveCleanV5',__archiveSource:'clean',readOnly:false};
            const pos=index.findIndex((x:any)=>String(x?.id||'')===id||String(x?.stateKey||'')===sk);
            if(pos>=0)index[pos]={...index[pos],...meta};else index.push(meta);
          }
          const indexValue=JSON.stringify(index);
          totalChars+=indexValue.length;
          rows.push({school_id:s.school_id,owner_key:String(s.user_id),module_key:'teacher',state_key:'teacher_perf_index_v1',payload:{value:indexValue},updated_by:s.user_id,updated_at:now,deleted_at:null});
        }
      }
      if(totalChars>MAX_TOTAL_CHARS) return json({error:'حجم بيانات المزامنة في الدفعة كبير جدًا',code:'STATE_PAYLOAD_TOO_LARGE',requestId},413);
      if(rows.length){const {error}=await sb.from('platform_module_state').upsert(rows,{onConflict:'school_id,owner_key,module_key,state_key'});if(error)throw error;}
      return json({ok:true,upserted:rows.length,scope:'target-user',ownerKey:targetUserId});
    }


    if(action==='admin-employee-status'){
      if(!isAdministrativeSupervisor) return json({error:'هذه العملية تتطلب صلاحية المسؤول المباشر',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(moduleKey!=='admin_performance') return json({error:'هذه العملية مخصصة للموظف الإداري',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
      const targetUserId=String(body.ownerUserId||body.userId||'').trim();
      const status=String(body.status||'').trim().toLowerCase();
      if(!targetUserId||!['pending','active','disabled'].includes(status)) return json({error:'بيانات حالة الموظف الإداري غير مكتملة',code:'STATE_ADMIN_STATUS_INVALID',requestId},400);
      const membership=await sb.from('school_members').select('id,user_id,role,status,role_label,supervisor_user_id').eq('school_id',s.school_id).eq('user_id',targetUserId).in('role',['administrative_employee','admin_employee']).neq('status','deleted').maybeSingle();
      if(membership.error) throw membership.error;
      if(!membership.data) return json({error:'المستخدم ليس موظفًا إداريًا في المدرسة الحالية',code:'STATE_TARGET_NOT_ADMIN_EMPLOYEE',requestId},403);
      if(!(await supervisorOwnsMembership(membership.data))) return json({error:'هذا الموظف يتبع مسؤولاً مباشرًا آخر',code:'STATE_TARGET_SUPERVISOR_MISMATCH',requestId},403);
      const mu=await sb.from('school_members').update({status,updated_at:now}).eq('id',membership.data.id);if(mu.error)throw mu.error;
      if(status==='active'){
        const uu=await sb.from('users').update({status:'active',active:true}).eq('id',targetUserId);if(uu.error)throw uu.error;
      }else if(status==='disabled'){
        const other=await sb.from('school_members').select('id,status').eq('user_id',targetUserId).neq('school_id',s.school_id).eq('status','active').limit(1);
        if(other.error)throw other.error;
        if(!(other.data||[]).length){const uu=await sb.from('users').update({status:'disabled',active:false}).eq('id',targetUserId);if(uu.error)throw uu.error;}
      }
      return json({ok:true,userId:targetUserId,status,supervisor:supervisorKey});
    }

    if(action==='admin-employee-delete'){
      if(!isAdministrativeSupervisor) return json({error:'هذه العملية تتطلب صلاحية المسؤول المباشر',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(moduleKey!=='admin_performance') return json({error:'هذه العملية مخصصة للموظف الإداري',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
      const targetUserId=String(body.ownerUserId||body.userId||'').trim();
      if(!targetUserId) return json({error:'معرف الموظف الإداري مطلوب',code:'STATE_TARGET_USER_REQUIRED',requestId},400);
      const membership=await sb.from('school_members').select('id,user_id,role,status,role_label,supervisor_user_id').eq('school_id',s.school_id).eq('user_id',targetUserId).in('role',['administrative_employee','admin_employee']).neq('status','deleted').maybeSingle();
      if(membership.error) throw membership.error;
      if(!membership.data) return json({error:'المستخدم ليس موظفًا إداريًا في المدرسة الحالية',code:'STATE_TARGET_NOT_ADMIN_EMPLOYEE',requestId},403);
      if(!(await supervisorOwnsMembership(membership.data))) return json({error:'هذا الموظف يتبع مسؤولاً مباشرًا آخر',code:'STATE_TARGET_SUPERVISOR_MISMATCH',requestId},403);
      const md=await sb.from('school_members').delete().eq('id',membership.data.id);if(md.error)throw md.error;
      const remaining=await sb.from('school_members').select('school_id,role,status').eq('user_id',targetUserId).neq('status','deleted').order('updated_at',{ascending:false}).limit(1);if(remaining.error)throw remaining.error;
      if((remaining.data||[]).length){const r=(remaining.data||[])[0];const uu=await sb.from('users').update({school_id:r.school_id,role:r.role,status:r.status==='active'?'active':'pending',active:r.status==='active'}).eq('id',targetUserId);if(uu.error)throw uu.error;}
      else{const ud=await sb.from('users').delete().eq('id',targetUserId);if(ud.error)throw ud.error;}
      await sb.from('platform_module_state').delete().eq('school_id',s.school_id).eq('owner_key',targetUserId).eq('module_key','admin_performance');
      return json({ok:true,userId:targetUserId,supervisor:supervisorKey});
    }

    if(action==='bulk-upsert'){
      const items=Array.isArray(body.items)?body.items:[];
      if(!items.length) return json({ok:true,upserted:0});
      if(items.length>MAX_ITEMS) return json({error:`الحد الأعلى ${MAX_ITEMS} عنصرًا في الدفعة`,code:'STATE_BATCH_TOO_LARGE',requestId},413);
      let totalChars=0;
      const rows:any[]=[];
      for(const item of items){
        const stateKey=safeKey(item?.key,220); if(!stateKey) continue;
        const deleted=!!item?.deleted;
        const value=deleted?null:String(item?.value??'');
        totalChars+=value?.length||0;
        rows.push({
          school_id:s.school_id,
          owner_key:isPrivatePerformanceState(moduleKey,stateKey)?String(s.user_id):requestedOwnerKey,
          module_key:moduleKey,
          state_key:stateKey,
          payload:deleted?null:{value},
          updated_by:s.user_id,
          updated_at:now,
          deleted_at:deleted?now:null
        });
      }
      if(totalChars>MAX_TOTAL_CHARS) return json({error:'حجم بيانات المزامنة في الدفعة كبير جدًا',code:'STATE_PAYLOAD_TOO_LARGE',requestId},413);
      if(!rows.length) return json({ok:true,upserted:0});
      const {error}=await sb.from('platform_module_state').upsert(rows,{onConflict:'school_id,owner_key,module_key,state_key'});
      if(error) throw error;
      return json({ok:true,upserted:rows.length,scope,ownerKey:requestedOwnerKey,privateUserIsolation:true});
    }

    if(action==='purge-module'){
      if(!isManager) return json({error:'هذه العملية تتطلب صلاحية المدير'},403);
      const targetScope=String(body.scope||'school')==='school'?'school':'user';
      const targetOwner=targetScope==='school'?'school':String(body.ownerUserId||s.user_id||'');
      const {error}=await sb.from('platform_module_state').delete().eq('school_id',s.school_id).eq('module_key',moduleKey).eq('owner_key',targetOwner);
      if(error) throw error;
      return json({ok:true});
    }

    return json({error:'عملية غير مدعومة',code:'STATE_ACTION_UNSUPPORTED',requestId},400);
  }catch(e){
    console.error('[platform-state]',requestId,e);
    return json({error:e instanceof Error?e.message:String(e),code:'STATE_FATAL_ERROR',requestId},500);
  }
});
