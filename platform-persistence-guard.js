(function(){
  'use strict';
  if(window.__PLATFORM_PERSISTENCE_GUARD__) return;
  window.__PLATFORM_PERSISTENCE_GUARD__=true;

  const VERSION='2.0.0-independent-school-verified';
  const nativeSet=Storage.prototype.setItem;
  const nativeRemove=Storage.prototype.removeItem;
  const nativeGet=Storage.prototype.getItem;
  const PAGE=(location.pathname.split('/').pop()||'index.html').replace(/\.html?$/i,'').replace(/[^a-zA-Z0-9_-]/g,'_')||'page';
  const explicit=window.CLOUD_STATE_CONFIG||null;
  const defaultModuleKey=String(explicit?.moduleKey||PAGE).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'page';
  const exact=new Set((explicit?.keys||[]).map(String));
  const prefixes=(explicit?.prefixes||[]).map(String);
  const explicitMode=!!explicit;
  const targetOwnerUserId=String(explicit?.ownerUserId||'').trim();
  let applying=false,hydrated=false,booted=false,flushTimer=0,lastError=null;
  const queues=new Map();

  const hardExclude=[
    /^OPENAI_/i,/openai.*key/i,/supabase/i,/platform_file_session_token/i,
    /(^|_)session($|_)/i,/token/i,/password/i,/secret/i,/activation/i,
    /^current(User|Role|School)/i,/^current_(user|school)/i,/^active_school/i,
    /^smartSchool\.currentSchool$/i,/^smart_school_current_session$/i,
    /^smart_school_(users|schools|login_contract_)/i,/^offline_users_backup$/i,
    /^admin_verified$/i,/^is_admin_session$/i,/device_id/i,/stable_device/i,
    /^app_theme/i,/^theme/i,/^cached_manager_uid$/i,/^current_manager_uid$/i,
    /^manager_uid$/i,/^school_code$/i,/^school_id$/i,/^school_name$/i,
    /^smart_school_id$/i,/^smart_school_name$/i,/^current_school_name$/i,
    /^activeSchool(Id)?$/i,/^activeSchool$/i,/^active_school$/i,/^active_school_code$/i,
    /^active_school_name$/i,/^currentSchoolId$/i,/^currentUserId$/i,/^currentUserEmail$/i,
    /^currentUserName$/i,/^follow_context$/i,/^smartSchoolUnifiedOpsV2_follow_context$/i,
    /^tmp$/i,/lastExport$/i,/Preview:/i,/last_selected_/i,/^academicYear$/i,/^currentAcademicYear$/i
  ];
  const ephemeralPatterns=[/_active$/i,/^activeOperationalStage$/i,/^followup_current_class_id_/i,/^smartSchool\.lastSync$/i];

  // مفاتيح مشتركة بين أكثر من واجهة يجب أن تستخدم moduleKey موحداً حتى تظهر
  // في المدرسة نفسها من أي جهاز أو دور، ولا تنقسم حسب اسم الصفحة التي قامت بالحفظ.
  const sharedRoutes=[
    {re:/^(school_reports|reports_archive|enhancedReportsArchive)$/i,moduleKey:'school_reports',scope:'school'},
    {re:/^(administrative_employee_|adminEmployeeEvalProfiles$|adminEvalSchoolYear$|admin_employee_plans$)/i,moduleKey:'administrative_employee_work',scope:'school'},
    {re:/^(category_goals|archive_folder_goals|enhancedReportsArchive)$/i,moduleKey:'school_reports',scope:'school'},
    {re:/^ss_meeting_template_(draft|html|title)$/i,moduleKey:'meeting_templates',scope:'school'},
    {re:/^(setting_(region|school|sig|stamp|academic_year)|def_[mp]|persist_(region|school|sig_data|stamp_data)|smart_education_office)$/i,moduleKey:'school_base_settings',scope:'school'},
    {re:/^(smartSchoolAcademicYearsV1|smartSchoolActiveAcademicYear|platformAcademicYear)$/i,moduleKey:'academic_year_management',scope:'school'},
    {re:/^followup_(classes_v3|current_class_id_v3|global_v3)$/i,moduleKey:'teacher_followup',scope:'school'},
    {re:/^(school_info|school_actual_reality|school_committees|school_operational_plan|school_operational_execution_v1|school_indicators_data|self_evaluation_archive_v1|manager_self_evaluation_archive_v1)$/i,moduleKey:'self_evaluation',scope:'school'},
    {re:/^(self_evaluation_|school_self_evaluation_)/i,moduleKey:'self_evaluation',scope:'school'},
    {re:/^(school_manager_records_archive_v1|manager_records_archive_v1|manager_records_archive|school_manager_archive_v1)$/i,moduleKey:'manager_records',scope:'school'},
    {re:/^examsSystemMOE(?::|__school__|$)/i,moduleKey:'exam_management',scope:'school'},
    {re:/^deputyWeeklyFollowup(Weeks|Archive|ActiveWeek|Teachers|TeachersVisible):/i,moduleKey:'weekly_teacher_work',scope:'school'},
    {re:/^deputyWeeklyTeacherManualProfiles:/i,moduleKey:'weekly_teacher_work',scope:'school'},
    {re:/^teacherWeeklyTasksPreview:/i,moduleKey:'weekly_teacher_work',scope:'school'},
    {re:/^deputyWednesdayAlerts:/i,moduleKey:'weekly_teacher_work',scope:'school'},
    {re:/^schoolInformationCenter:/i,moduleKey:'school_information',scope:'school'},
    {re:/^school_information_center:/i,moduleKey:'school_information',scope:'school'},
    {re:/^schoolInformationTeachers:/i,moduleKey:'school_information',scope:'school'},
    {re:/^school_information_center_students$/i,moduleKey:'school_information',scope:'school'},
    {re:/^sic_students:/i,moduleKey:'school_information',scope:'school'},
    {re:/^sh_/i,moduleKey:'school_health',scope:'school'},
    {re:/^shared_staff_deductions:/i,moduleKey:'staff_discipline',scope:'school'},
    {re:/^school_attendance_ui_v1$/i,moduleKey:'staff_discipline',scope:'school'}
  ];

  const schoolPatterns=[
    /^school_actual_reality$/,/^school_committees$/,/^school_operational_plan$/,/^school_indicators_data$/,
    /^self_evaluation_archive_/i,/^school_info$/,/^school_reports$/,/^schoolImpactAssessments$/,
    /^sh_/i,/^activity_leader_records_archive_/i,/^reports_archive$/,/^category_goals$/,
    /^archive_folder_goals$/,/^managerRecordsFooterSettings$/,/^activityLeaderFooterSettings$/,
    /^setting_(region|school|sig|stamp)$/,/^def_[mp]$/,/^persist_(region|school|sig_data|stamp_data)$/,
    /^smart_education_office$/,/^smart_school_teacher_extra_roles_map$/,/^school_academic_year$/,
    /^school_info_academic_year$/,/^(education_department|edu_dept)$/,
    /^examsSystemMOE(?::|__school__|$)/i,
    /^schoolInformationCenter:/i,/^school_information_center:/i,/^sic_students:/i,/^school_information_center_students$/i,
    /^schoolInformationTeachers:/i,/^deputyWeeklyFollowup(Weeks|Archive|ActiveWeek|Teachers|TeachersVisible):/i,/^deputyWeeklyTeacherManualProfiles:/i,
    /^deputyWednesdayAlerts:/i,/^advisorTeacherCollectionInboxV1$/i,/^advisorAnalysisBaseStudentsV1$/i,
    /^(manager_name|school_manager_name|smart_school_manager|smart_school_education_department)$/,
    /^shared_staff_deductions:/i,/^school_attendance_ui_v1$/i
  ];

  const pageSharedModules={
    manager:['school_reports','self_evaluation','manager_records','administrative_employee_work','meeting_templates','school_base_settings'],
    agent:['school_reports','meeting_templates','school_base_settings'],teacher:['school_reports','meeting_templates','school_base_settings'],student_advisor:['school_reports','meeting_templates','school_base_settings'],activity_leader:['school_reports','meeting_templates','school_base_settings'],health_advisor:['school_reports','meeting_templates','school_base_settings'],kindergarten_teacher:['school_reports','meeting_templates','school_base_settings','teacher_followup'],student_advisor_analysis_tool:['school_reports','meeting_templates','school_base_settings'],
    self_evaluation_records:['self_evaluation'],
    administrative_employee_portal:['administrative_employee_work'],administrative_employee_plan:['administrative_employee_work'],administrative_employee_execution:['administrative_employee_work'],administrative_employee_evaluation:['administrative_employee_work'],administrative_employee_improvement:['administrative_employee_work'],administrative_employee_library:['administrative_employee_work'],admin_employee_management:['administrative_employee_work'],
    meeting_minutes_template:['meeting_templates'],teacher_comprehensive_record:['teacher_followup'],kindergarten_teacher_comprehensive_record:['teacher_followup'],
    deputy_weekly_teacher_followup:['weekly_teacher_work'],teacher_weekly_tasks:['weekly_teacher_work'],health_advisor_weekly_tasks:['weekly_teacher_work'],kindergarten_teacher_weekly_tasks:['weekly_teacher_work'],
    manager_exams_management:['exam_management'],agent_exams_management:['exam_management'],
    school_information_center:['school_information'],
    staff_discipline:['staff_discipline'],wakil_staff_discipline:['staff_discipline']
  };

  function routeFor(k){
    k=String(k||'');
    if(explicitMode) return {moduleKey:defaultModuleKey,scope:String(explicit?.scope||'user')==='school'?'school':'user'};
    return sharedRoutes.find(x=>x.re.test(k))||null;
  }
  function moduleFor(k){return routeFor(k)?.moduleKey||defaultModuleKey;}
  function track(k){
    k=String(k||'');
    if(!k||hardExclude.some(r=>r.test(k))||ephemeralPatterns.some(r=>r.test(k))) return false;
    if(explicitMode) return exact.has(k)||prefixes.some(p=>k.startsWith(p));
    return true;
  }
  function scopeFor(k){
    if(explicitMode) return String(explicit.scope||'user')==='school'?'school':'user';
    const route=routeFor(k); if(route) return route.scope;
    return schoolPatterns.some(r=>r.test(String(k||'')))?'school':'user';
  }
  function bucket(moduleKey,scope){
    const id=moduleKey+'|'+scope;
    if(!queues.has(id)) queues.set(id,{moduleKey,scope,items:new Map()});
    return queues.get(id);
  }
  function queue(k,value,deleted){
    if(applying||!track(k)) return;
    const moduleKey=moduleFor(k),scope=scopeFor(k);
    bucket(moduleKey,scope).items.set(String(k),{key:String(k),value:deleted?'':String(value??''),deleted:!!deleted});
    scheduleFlush();
  }
  function scheduleFlush(){clearTimeout(flushTimer);flushTimer=setTimeout(()=>void flush(),550);}
  function pendingCount(){let n=0;for(const b of queues.values())n+=b.items.size;return n;}

  async function writeBatch(moduleKey,scope,batch,keepalive){
    if(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.managerUpsertUser==='function'&&moduleKey===defaultModuleKey){
      return PlatformStateEngine.managerUpsertUser(moduleKey,targetOwnerUserId,batch,{keepalive});
    }
    return PlatformStateEngine.bulkUpsert(moduleKey,scope,batch,{keepalive});
  }
  async function flush(keepalive=false){
    clearTimeout(flushTimer);flushTimer=0;lastError=null;
    if(!window.PlatformStateEngine) return {ok:false,pending:pendingCount(),error:'محرك الاستمرارية السحابية غير متاح'};
    for(const b of [...queues.values()]){
      if(!b.items.size) continue;
      const items=[...b.items.values()]; b.items.clear();
      for(let i=0;i<items.length;i+=200){
        const batch=items.slice(i,i+200);
        try{await writeBatch(b.moduleKey,b.scope,batch,keepalive);}
        catch(e){
          batch.forEach(x=>b.items.set(x.key,x));
          lastError=e instanceof Error?e:new Error(String(e));
          console.warn('[PersistenceGuard] flush failed',b.moduleKey,b.scope,lastError.message);
          break;
        }
      }
    }
    return {ok:pendingCount()===0,pending:pendingCount(),error:lastError?.message||''};
  }

  async function pullModule(moduleKey,scope,keys){
    if(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.pullUser==='function'&&moduleKey===defaultModuleKey){
      return PlatformStateEngine.pullUser(moduleKey,targetOwnerUserId,keys);
    }
    return PlatformStateEngine.pull(moduleKey,scope,keys);
  }
  async function verify(keys){
    const wanted=(Array.isArray(keys)?keys:[keys]).filter(Boolean).map(String).filter(track);
    const groups=new Map();
    wanted.forEach(k=>{const mod=moduleFor(k),sc=scopeFor(k),id=mod+'|'+sc;if(!groups.has(id))groups.set(id,{moduleKey:mod,scope:sc,keys:[]});groups.get(id).keys.push(k);});
    for(const g of groups.values()){
      const result=await pullModule(g.moduleKey,g.scope,g.keys);
      const rows=new Map((result.items||[]).map(r=>[String(r.state_key),r]));
      for(const k of g.keys){
        const local=nativeGet.call(localStorage,k),row=rows.get(k);
        if(local===null){if(row&&!row.deleted_at)throw new Error('فشل التحقق السحابي لحذف '+k);continue;}
        const remote=row&&!row.deleted_at&&row.payload&&Object.prototype.hasOwnProperty.call(row.payload,'value')?String(row.payload.value):null;
        if(remote!==String(local))throw new Error('فشل التحقق السحابي للمفتاح '+k);
      }
    }
    return {ok:true,keys:wanted};
  }
  async function commit(keys){
    const r=await flush(false);
    if(!r.ok) throw new Error(r.error||'تعذر إكمال الحفظ السحابي');
    if(keys&&((Array.isArray(keys)&&keys.length)||(!Array.isArray(keys)))) await verify(keys);
    return {ok:true,verified:!!keys};
  }

  Storage.prototype.setItem=function(k,v){const r=nativeSet.call(this,k,v);if(this===localStorage)queue(k,v,false);return r;};
  Storage.prototype.removeItem=function(k){const r=nativeRemove.call(this,k);if(this===localStorage)queue(k,'',true);return r;};

  function moduleRelevant(moduleKey,k,scope){return moduleFor(k)===moduleKey&&scopeFor(k)===scope;}
  async function hydrateModule(moduleKey,scope,wantedKeys){
    if(!window.PlatformStateEngine) return false;
    const result=await pullModule(moduleKey,scope,wantedKeys);
    const rows=result.items||[],cloud=new Map(rows.map(r=>[String(r.state_key),r]));
    let changed=false;applying=true;
    try{
      for(const [k,r] of cloud){
        if(!track(k)||!moduleRelevant(moduleKey,k,scope)) continue;
        if(r.deleted_at){if(nativeGet.call(localStorage,k)!==null){nativeRemove.call(localStorage,k);changed=true;}continue;}
        const val=r.payload&&Object.prototype.hasOwnProperty.call(r.payload,'value')?String(r.payload.value):null;
        if(val!==null&&nativeGet.call(localStorage,k)!==val){nativeSet.call(localStorage,k,val);changed=true;}
      }
      const migration=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);if(!track(k)||!moduleRelevant(moduleKey,k,scope)||cloud.has(k))continue;
        const v=nativeGet.call(localStorage,k);if(v!==null)migration.push({key:k,value:v,deleted:false});
      }
      applying=false;
      for(let i=0;i<migration.length;i+=150){
        try{await writeBatch(moduleKey,scope,migration.slice(i,i+150),false);}
        catch(e){console.warn('[PersistenceGuard] migration failed',moduleKey,e?.message||e);break;}
      }
    }finally{applying=false;}
    return changed;
  }
  function hydrationTargets(){
    const out=new Map();
    const add=(moduleKey,scope,keys)=>{const id=moduleKey+'|'+scope;if(!out.has(id))out.set(id,{moduleKey,scope,keys});};
    if(explicitMode){add(defaultModuleKey,String(explicit.scope||'user')==='school'?'school':'user',[...exact]);return [...out.values()];}
    add(defaultModuleKey,'school',undefined);add(defaultModuleKey,'user',undefined);
    (pageSharedModules[PAGE]||[]).forEach(m=>add(m,'school',undefined));
    return [...out.values()];
  }
  async function boot(){
    if(booted)return;booted=true;let tries=0;
    while(tries++<60&&!window.PlatformStateEngine)await new Promise(r=>setTimeout(r,100));
    if(!window.PlatformStateEngine)return;
    try{
      let changed=false;
      for(const t of hydrationTargets())changed=(await hydrateModule(t.moduleKey,t.scope,t.keys))||changed;
      hydrated=true;
      window.dispatchEvent(new CustomEvent('platform-persistence-ready',{detail:{moduleKey:defaultModuleKey,version:VERSION,changed}}));
      const schoolId=nativeGet.call(localStorage,'active_school_id')||nativeGet.call(localStorage,'current_school_id')||'';
      const reloadKey=`platform_persistence_hydrated_v2:${PAGE}:${schoolId}`;
      if(changed&&!sessionStorage.getItem(reloadKey)){sessionStorage.setItem(reloadKey,'1');location.reload();}
    }catch(e){console.warn('[PersistenceGuard] hydrate skipped',defaultModuleKey,e?.message||e);}
  }

  window.addEventListener('pagehide',()=>void flush(true));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flush(true)});
  window.PlatformPersistenceGuard={VERSION,moduleKey:defaultModuleKey,moduleFor,track,scopeFor,flush,commit,verify,boot,get hydrated(){return hydrated;},get pending(){return pendingCount();},get lastError(){return lastError;}};
  setTimeout(boot,0);
})();
