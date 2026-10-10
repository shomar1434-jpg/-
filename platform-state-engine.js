(function(){
  'use strict';
  if(window.PlatformStateEngine) return;
  const VERSION='1.11.0-RL186-weekly-reset-generation';
  const cfg={
    base:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'')+'/functions/v1/platform-state',
    anon:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM',
    token:()=>window.PlatformCloudSession?.token?.()||sessionStorage.getItem('platform_tab_session_token_v1')||localStorage.getItem('platform_file_session_token')||''
  };
  async function ensureSession(){
    if(window.PlatformCloudSession&&typeof window.PlatformCloudSession.ensure==='function'){
      try{await window.PlatformCloudSession.ensure();}catch(_){ }
      if(cfg.token()) return cfg.token();
    }
    if(cfg.token()) return cfg.token();
    return '';
  }
  function expectedSchoolId(){
    return String(
      localStorage.getItem('active_school_id') ||
      localStorage.getItem('current_school_id') ||
      localStorage.getItem('school_id') ||
      localStorage.getItem('smart_school_id') ||
      window.PlatformCloudSession?.schoolId?.() || ''
    ).trim();
  }
  async function request(action,body={},opts={}){
    const token=await ensureSession();
    if(!token) throw new Error('الجلسة السحابية غير متاحة');
    const expectedSchool=expectedSchoolId();
    const tokenSchool=String(window.PlatformCloudSession?.schoolId?.()||'').trim();
    if(!expectedSchool) throw new Error('تعذر تحديد المدرسة الحالية قبل المزامنة السحابية');
    if(!tokenSchool || tokenSchool!==expectedSchool){
      if(window.PlatformCloudSession?.recover) await window.PlatformCloudSession.recover();
      const repaired=String(window.PlatformCloudSession?.schoolId?.()||'').trim();
      if(repaired!==expectedSchool) throw new Error('جلسة السحابة لا تطابق المدرسة الحالية');
    }
    body={...body,expectedSchoolId:expectedSchool};
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),opts.timeout||30000);
    try{
      const send=async()=>{
        const r=await fetch(`${cfg.base()}?action=${encodeURIComponent(action)}`,{
          method:'POST',
          headers:{apikey:cfg.anon(),'x-platform-session':cfg.token(),'x-client-version':VERSION,'content-type':'application/json'},
          body:JSON.stringify(body),
          signal:controller.signal,
          keepalive:!!opts.keepalive
        });
        const j=await r.json().catch(()=>({}));
        return {r,j};
      };
      let res=await send();
      if(res.r.status===401&&window.PlatformCloudSession?.recover){await window.PlatformCloudSession.recover();res=await send();}
      if(!res.r.ok) throw new Error(res.j.error||`فشلت مزامنة الحالة (${res.r.status})`);
      return res.j;
    }catch(error){
      if(error&&error.name==='AbortError')throw new Error('انتهت مهلة الحفظ السحابي قبل اكتمال رفع التقرير. احتفظ النظام بالمسودة؛ أعد المحاولة بعد استقرار الاتصال.');
      throw error;
    }finally{clearTimeout(timer)}
  }
  // RL238: متابعة المدير أو الوكيل لصفحة مستخدم آخر = قراءة فقط، ومن أرشيف ذلك المستخدم لا أرشيف المدير.
  // كان كل دور غير المعلمة (الموجه، الوكيل، رائد النشاط، الموجه الصحي، معلمة رياض الأطفال) يعرض بيانات المدير
  // ويحفظ/يحذف في حساب المدير. نفس شرط ManagerFollowAccessBridge، والخادم يتحقق أن القارئ مدير نفس المدرسة.
  const FOLLOW=(function(){
    try{
      const p=new URLSearchParams(location.search||''),mode=String(p.get('mode')||'').toLowerCase();
      const viewer=String(p.get('viewerRole')||p.get('viewer')||p.get('returnRole')||'').toLowerCase();
      const active=(p.get('managerFollow')==='1'||p.get('supervisorFollow')==='1'||viewer==='manager'||viewer==='agent')&&(p.get('follow')==='1'||p.get('readonly')==='1'||mode.indexOf('supervisor')>=0);
      return active?{targetUserId:String(p.get('targetUser')||p.get('followUserId')||p.get('owner_uid')||p.get('userId')||p.get('uid')||'').trim()}:null;
    }catch(_){return null;}
  })();
  const FOLLOW_RO_ERROR='وضع المتابعة للقراءة فقط: لا يمكن الحفظ أو الحذف في حساب المستخدم المتابَع';
  const PRIVATE_PERFORMANCE_MODULES=new Set(['manager','teacher','agent','student_advisor','student_advisor_analysis_tool','health_advisor','activity_leader','kindergarten_teacher','administrative_employee_portal','administrative_employee_library','admin_employee_management','admin_performance']);
  // نفس تعريف الخادم (isPrivatePerformanceState): مفاتيح أرشيف الأداء الخاصة بكل مستخدم.
  const isPrivatePerformanceKey=(k)=>{const sk=String(k||'').toLowerCase();return /(^|_)perf_index_v1$/.test(sk)||/(^|_)perf_report_v1_/.test(sk)||/_performance_deleted_v1$/.test(sk)||/^performance_reports_archive_v2/.test(sk)||sk==='reports_archive'||sk==='school_reports'||/performance_reports_clean_v[123]$/.test(sk)||/^ss_performance_profile/.test(sk)||/^school_performance_module_v1:/.test(sk);};
  async function pull(moduleKey,scope='user',keys){
    if(FOLLOW&&FOLLOW.targetUserId&&PRIVATE_PERFORMANCE_MODULES.has(String(moduleKey||''))){
      const list=Array.isArray(keys)?keys:[];
      const archive=async(k)=>{const r=await request('pull-performance-archive',{moduleKey,ownerUserId:FOLLOW.targetUserId,keys:k});return (r?.items||[]).filter(x=>String(x.module_key||moduleKey)===String(moduleKey));};
      if(scope!=='school') return {items:await archive(list),readOnly:true};
      // بعض الصفحات (مثل الوكيل) تقرأ فهرس أرشيفها عبر نطاق المدرسة؛ الخادم يعيد عندها نسخة القارئ الخاصة.
      // في المتابعة: مفاتيح الأرشيف الخاصة من المستخدم المتابَع، وبقية مفاتيح المدرسة كما هي.
      const privKeys=list.filter(isPrivatePerformanceKey),otherKeys=list.filter(k=>!isPrivatePerformanceKey(k));
      let rest=[];
      if(!list.length||otherKeys.length){const r=await request('pull',{moduleKey,scope,keys:list.length?otherKeys:keys});rest=(r?.items||[]).filter(x=>!isPrivatePerformanceKey(x.state_key));}
      const priv=(!list.length||privKeys.length)?await archive(list.length?privKeys:[]):[];
      return {items:[...rest,...priv],readOnly:true};
    }
    return request('pull',{moduleKey,scope,keys});
  }
  const pullUser=(moduleKey,ownerUserId,keys)=>request('pull-user',{moduleKey,ownerUserId,keys});
  const pullSchoolUsers=(moduleKey,keys)=>request('pull-school-users',{moduleKey,keys});
  const bulkUpsert=(moduleKey,scope='user',items,opts)=>FOLLOW?Promise.reject(new Error(FOLLOW_RO_ERROR)):request('bulk-upsert',{moduleKey,scope,items},opts);
  const managerUpsertUser=(moduleKey,ownerUserId,items,opts)=>FOLLOW?Promise.reject(new Error(FOLLOW_RO_ERROR)):request('manager-upsert-user',{moduleKey,ownerUserId,items},opts);
  const publishWeeklyPlan=(ownerUserId,payload)=>request('publish-weekly-plan',{moduleKey:'weekly_teacher_work',ownerUserId,payload});
  const closeWeeklyPlan=(ownerUserId,weekId)=>request('close-weekly-plan',{moduleKey:'weekly_teacher_work',ownerUserId,weekId});
  const submitWeeklySubmission=(payload)=>request('submit-weekly-submission',{moduleKey:'weekly_teacher_work',payload});
  const saveWeeklyEvidenceDraft=(payload)=>request('save-weekly-evidence-draft',{moduleKey:'weekly_teacher_work',payload});
  const reviewWeeklySubmission=(ownerUserId,stateKey,itemKey,decision,reason,evidencePatch)=>request('review-weekly-submission',{moduleKey:'weekly_teacher_work',ownerUserId,stateKey,itemKey,decision,reason,evidencePatch:evidencePatch||null});
  const resetWeeklyContext=(mode='teacher',weekId='')=>request('reset-weekly-context',{moduleKey:'weekly_teacher_work',mode,weekId});
  const updateAdministrativeEmployeeStatus=(ownerUserId,status)=>request('admin-employee-status',{moduleKey:'admin_performance',ownerUserId,status});
  const removeAdministrativeEmployee=(ownerUserId)=>request('admin-employee-delete',{moduleKey:'admin_performance',ownerUserId});
  const health=()=>request('health',{});
  window.PlatformStateEngine={VERSION,request,pull,pullUser,pullSchoolUsers,bulkUpsert,managerUpsertUser,publishWeeklyPlan,closeWeeklyPlan,submitWeeklySubmission,saveWeeklyEvidenceDraft,reviewWeeklySubmission,resetWeeklyContext,updateAdministrativeEmployeeStatus,removeAdministrativeEmployee,health};
})();
