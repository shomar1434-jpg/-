(function(){
  'use strict';
  if(window.__PLATFORM_PERSISTENCE_GUARD__) return;
  window.__PLATFORM_PERSISTENCE_GUARD__=true;

  const nativeSet=Storage.prototype.setItem;
  const nativeRemove=Storage.prototype.removeItem;
  const nativeGet=Storage.prototype.getItem;
  const PAGE=(location.pathname.split('/').pop()||'index.html').replace(/\.html?$/i,'').replace(/[^a-zA-Z0-9_-]/g,'_')||'page';
  const explicit=window.CLOUD_STATE_CONFIG||null;
  const moduleKey=String(explicit?.moduleKey||PAGE).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'page';
  const exact=new Set((explicit?.keys||[]).map(String));
  const prefixes=(explicit?.prefixes||[]).map(String);
  const explicitMode=!!explicit;
  const targetOwnerUserId=String(explicit?.ownerUserId||'').trim();
  let applying=false,hydrated=false,booted=false;
  const queues={user:new Map(),school:new Map()};
  let flushTimer=0;

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
    /^schoolInformationTeachers:/i,/^deputyWeeklyFollowup(Weeks|Archive|ActiveWeek|Teachers):/i,
    /^deputyWednesdayAlerts:/i,/^advisorTeacherCollectionInboxV1$/i,/^advisorAnalysisBaseStudentsV1$/i,
    /^(manager_name|school_manager_name|smart_school_manager|smart_school_education_department)$/
  ];
  const ephemeralPatterns=[/_active$/i,/^activeOperationalStage$/i,/^followup_current_class_id_/i,/^smartSchool\.lastSync$/i];

  function track(k){
    k=String(k||'');
    if(!k||hardExclude.some(r=>r.test(k))||ephemeralPatterns.some(r=>r.test(k))) return false;
    if(explicitMode) return exact.has(k)||prefixes.some(p=>k.startsWith(p));
    return true;
  }
  function scopeFor(k){
    if(explicitMode) return String(explicit.scope||'user')==='school'?'school':'user';
    return schoolPatterns.some(r=>r.test(String(k||'')))?'school':'user';
  }
  function queue(k,value,deleted){
    if(applying||!track(k)) return;
    const scope=scopeFor(k),q=queues[scope];
    q.set(String(k),{key:String(k),value:deleted?'':String(value??''),deleted:!!deleted});
    scheduleFlush();
  }
  function scheduleFlush(){clearTimeout(flushTimer);flushTimer=setTimeout(()=>void flush(),550)}
  async function flush(keepalive=false){
    clearTimeout(flushTimer);flushTimer=0;
    if(!window.PlatformStateEngine) return;
    for(const scope of ['school','user']){
      const q=queues[scope]; if(!q.size) continue;
      const items=[...q.values()]; q.clear();
      for(let i=0;i<items.length;i+=200){
        const batch=items.slice(i,i+200);
        try{
          if(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.managerUpsertUser==='function') await PlatformStateEngine.managerUpsertUser(moduleKey,targetOwnerUserId,batch,{keepalive});
          else await PlatformStateEngine.bulkUpsert(moduleKey,scope,batch,{keepalive});
        }
        catch(e){batch.forEach(x=>q.set(x.key,x)); console.warn('[PersistenceGuard] flush failed',moduleKey,scope,e?.message||e); break;}
      }
    }
  }

  Storage.prototype.setItem=function(k,v){
    const r=nativeSet.call(this,k,v);
    if(this===localStorage) queue(k,v,false);
    return r;
  };
  Storage.prototype.removeItem=function(k){
    const r=nativeRemove.call(this,k);
    if(this===localStorage) queue(k,'',true);
    return r;
  };

  async function hydrateScope(scope){
    if(!window.PlatformStateEngine) return false;
    const wanted=explicitMode?[...exact]:undefined;
    const result=(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.pullUser==='function')?await PlatformStateEngine.pullUser(moduleKey,targetOwnerUserId,wanted):await PlatformStateEngine.pull(moduleKey,scope,wanted);
    const rows=result.items||[];
    const cloud=new Map(rows.map(r=>[String(r.state_key),r]));
    let changed=false;
    applying=true;
    try{
      for(const [k,r] of cloud){
        if(!track(k)||scopeFor(k)!==scope) continue;
        if(r.deleted_at){if(nativeGet.call(localStorage,k)!==null){nativeRemove.call(localStorage,k);changed=true;}continue;}
        const val=r.payload&&Object.prototype.hasOwnProperty.call(r.payload,'value')?String(r.payload.value):null;
        if(val!==null&&nativeGet.call(localStorage,k)!==val){nativeSet.call(localStorage,k,val);changed=true;}
      }
      const migration=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i); if(!track(k)||scopeFor(k)!==scope||cloud.has(k)) continue;
        const v=nativeGet.call(localStorage,k); if(v!==null) migration.push({key:k,value:v,deleted:false});
      }
      applying=false;
      for(let i=0;i<migration.length;i+=150){try{if(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.managerUpsertUser==='function')await PlatformStateEngine.managerUpsertUser(moduleKey,targetOwnerUserId,migration.slice(i,i+150));else await PlatformStateEngine.bulkUpsert(moduleKey,scope,migration.slice(i,i+150));}catch(e){console.warn('[PersistenceGuard] migration failed',e?.message||e);break;}}
    }finally{applying=false;}
    return changed;
  }

  async function boot(){
    if(booted) return; booted=true;
    let tries=0;
    while(tries++<60&&!window.PlatformStateEngine) await new Promise(r=>setTimeout(r,100));
    if(!window.PlatformStateEngine) return;
    try{
      const changedSchool=await hydrateScope('school');
      const changedUser=await hydrateScope('user');
      hydrated=true;
      window.dispatchEvent(new CustomEvent('platform-persistence-ready',{detail:{moduleKey,changed:changedSchool||changedUser}}));
      const schoolId=nativeGet.call(localStorage,'active_school_id')||nativeGet.call(localStorage,'current_school_id')||'';
      const reloadKey=`platform_persistence_hydrated:${moduleKey}:${schoolId}`;
      if((changedSchool||changedUser)&&!sessionStorage.getItem(reloadKey)){
        sessionStorage.setItem(reloadKey,'1'); location.reload();
      }
    }catch(e){console.warn('[PersistenceGuard] hydrate skipped',moduleKey,e?.message||e);}
  }
  window.addEventListener('pagehide',()=>void flush(true));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flush(true)});
  window.PlatformPersistenceGuard={moduleKey,track,scopeFor,flush,boot,get hydrated(){return hydrated;}};
  setTimeout(boot,0);
})();
