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
const schoolAggregateModules=new Set(['teacher_comprehensive','admin_performance']);
const MAX_ITEMS=250;
const MAX_TOTAL_CHARS=6_500_000;
const PRIVATE_PERFORMANCE_MODULES=new Set(['manager','teacher','agent','student_advisor','student_advisor_analysis_tool','health_advisor','activity_leader','kindergarten_teacher','administrative_employee_portal','administrative_employee_library','admin_employee_management','admin_performance']);
const isPrivatePerformanceState=(moduleKey:string,stateKey:string)=>{
  const mk=String(moduleKey||'').toLowerCase(), sk=String(stateKey||'').toLowerCase();
  if(!PRIVATE_PERFORMANCE_MODULES.has(mk))return false;
  return /(^|_)perf_index_v1$/.test(sk)||/(^|_)perf_report_v1_/.test(sk)||/^performance_reports_archive_v2/.test(sk)||sk==='reports_archive'||sk==='school_reports'||/performance_reports_clean_v[123]$/.test(sk)||/^ss_performance_profile/.test(sk)||/^school_performance_module_v1:/.test(sk);
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

    if(action==='health') return json({ok:true,version:'1.5.0-RL33-private-user-state-isolation',schoolId:s.school_id,userId:s.user_id,role:s.role});

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
      const modules=performanceModulesForRole(s.role);
      if(!modules.length)return json({items:[],scope:'user-performance',ownerKey:String(s.user_id),role:s.role});
      const q=await sb.from('platform_module_state').select('module_key,state_key,payload,deleted_at,updated_at,owner_key,updated_by').eq('school_id',s.school_id).in('module_key',modules).in('owner_key',[String(s.user_id),'school']).is('deleted_at',null).order('updated_at',{ascending:false}).limit(5000);
      if(q.error)throw q.error;
      const accepted:any[]=[];const legacy:any[]=[];
      for(const row of q.data||[]){
        if(!isPrivatePerformanceState(String(row.module_key||''),String(row.state_key||'')))continue;
        if(String(row.owner_key)===String(s.user_id))accepted.push(row);
        else if(String(row.owner_key)==='school'&&String(row.updated_by||'')===String(s.user_id)){accepted.push({...row,owner_key:String(s.user_id)});legacy.push(row);}
      }
      for(const row of legacy){
        const up={school_id:s.school_id,owner_key:String(s.user_id),module_key:row.module_key,state_key:row.state_key,payload:row.payload,updated_by:s.user_id,updated_at:row.updated_at||now,deleted_at:null};
        const r=await sb.from('platform_module_state').upsert(up,{onConflict:'school_id,owner_key,module_key,state_key'});if(r.error)console.warn('[platform-state][performance-recovery]',r.error);
      }
      return json({items:accepted.map(({updated_by,...x}:any)=>x),scope:'user-performance',ownerKey:String(s.user_id),role:s.role,modules,recovered:legacy.length});
    }

    if(action==='pull-school-users'){
      if(!isManager && !(moduleKey==='admin_performance'&&isAgent)) return json({error:'هذه القراءة تتطلب صلاحية المسؤول المباشر',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(!schoolAggregateModules.has(moduleKey)) return json({error:'هذا المصدر غير متاح للتجميع المدرسي',code:'STATE_AGGREGATE_MODULE_FORBIDDEN',requestId},403);
      const keys=Array.isArray(body.keys)?body.keys.slice(0,50).map((x:unknown)=>safeKey(x,220)).filter(Boolean):[];
      let allowedOwners:string[]|null=null;
      if(moduleKey==='admin_performance'&&isAdministrativeSupervisor){
        const {data:members,error:memberError}=await sb.from('school_members').select('id,user_id,role_label,status,supervisor_user_id').eq('school_id',s.school_id).in('role',['administrative_employee','admin_employee']).neq('status','deleted');if(memberError)throw memberError;
        const owned:any[]=[];for(const m of members||[])if(await supervisorOwnsMembership(m))owned.push(m);
        allowedOwners=owned.map((m:any)=>String(m.user_id||'')).filter(Boolean);
        if(!allowedOwners.length)return json({items:[],scope:'school-users',schoolId:s.school_id,supervisor:supervisorKey});
      }
      let q=sb.from('platform_module_state').select('module_key,state_key,payload,deleted_at,updated_at,owner_key').eq('school_id',s.school_id).eq('module_key',moduleKey).neq('owner_key','school').order('updated_at',{ascending:true}).limit(5000);
      if(allowedOwners)q=q.in('owner_key',allowedOwners);if(keys.length)q=q.in('state_key',keys);
      const {data,error}=await q;if(error)throw error;
      return json({items:data||[],scope:'school-users',schoolId:s.school_id,supervisor:moduleKey==='admin_performance'?supervisorKey:undefined});
    }

    if(action==='pull-user'){
      if(!isAdministrativeSupervisor) return json({error:'هذه القراءة تتطلب صلاحية المسؤول المباشر',code:'STATE_SUPERVISOR_REQUIRED',requestId},403);
      if(moduleKey!=='admin_performance') return json({error:'هذه القراءة مخصصة لأداء الموظف الإداري',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
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
      if(moduleKey!=='admin_performance') return json({error:'هذه العملية مخصصة لأداء الموظف الإداري',code:'STATE_TARGET_MODULE_FORBIDDEN',requestId},403);
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
