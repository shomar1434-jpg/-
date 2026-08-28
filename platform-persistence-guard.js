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
  const legacyModuleKeys=(explicit?.legacyModules||[]).map(x=>String(x||'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)).filter(Boolean).filter(x=>x!==moduleKey);
  let applying=false,hydrated=false,booted=false;
  const queues={user:new Map(),school:new Map()};
  let flushTimer=0;
  let readyResolve;
  const readyPromise=new Promise(function(resolve){readyResolve=resolve;});

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
    /^self_evaluation_archive_/i,/^self_evaluation_archive_v1$/,/^manager_self_evaluation_archive_v1$/,/^school_info$/,/^school_manager_records_archive_v1$/,/^manager_records_.*_archive$/i,/^wakil_records_pdf_archive_v3$/,/^wakil_archive_v5_/i,/^wakil_form_v3_/i,/^school_operational_execution_v1$/,/^schoolImpactAssessments$/,
    /^category_goals$/,
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


  // ARCHIVE_DOMAIN_ISOLATION_2026_08_28
  // تمنع الصفحة العامة من التقاط مفاتيح أرشيف تخص وحدة أخرى من localStorage.
  // هذا هو الحاجز الجذري ضد تلوث module_key بين المدير/الوكيل/المعلم وبقية الأقسام.
  const archiveDomainOwners=[
    {re:/^self_evaluation_archive(?:_v1)?$|^manager_self_evaluation_archive_v1$/i,modules:new Set(['self_evaluation'])},
    {re:/^school_manager_records_archive_v1$|^managerSchoolRecord_/i,modules:new Set(['manager'])},
    {re:/^wakil_records_pdf_archive_v3$|^wakil_archive_v5_|^wakil_form_v3_/i,modules:new Set(['agent'])},
    {re:/^activity_leader_records_archive_v2$|^activityLeaderRecord_/i,modules:new Set(['activity_leader'])},
    {re:/^advisor_records_archive_v1$|^moajeh_/i,modules:new Set(['student_advisor'])},
    {re:/^(school_reports|reports_archive)$/i,modules:new Set(['manager','agent','teacher','activity_leader','kindergarten_teacher','student_advisor','health_advisor','student_advisor_analysis_tool'])}
  ];
  function moduleOwnsReservedKey(k){
    const key=String(k||'');
    const rule=archiveDomainOwners.find(x=>x.re.test(key));
    return !rule || rule.modules.has(moduleKey);
  }

  function track(k){
    k=String(k||'');
    if(!k||hardExclude.some(r=>r.test(k))||ephemeralPatterns.some(r=>r.test(k))) return false;
    if(explicitMode) return exact.has(k)||prefixes.some(p=>k.startsWith(p));
    if(!moduleOwnsReservedKey(k)) return false;
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
  const LARGE_VALUE_THRESHOLD=220000;
  const COMPRESSED_PREFIX='__PG_GZIP_B64_V1__:';
  async function encodeCloudValue(value){
    const text=String(value??'');
    if(text.length<LARGE_VALUE_THRESHOLD||typeof CompressionStream==='undefined') return text;
    try{
      const bytes=new TextEncoder().encode(text);
      const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf=await new Response(stream).arrayBuffer();
      const arr=new Uint8Array(buf);let bin='';
      for(let i=0;i<arr.length;i+=0x8000) bin+=String.fromCharCode(...arr.subarray(i,i+0x8000));
      const packed=COMPRESSED_PREFIX+btoa(bin);
      return packed.length<text.length?packed:text;
    }catch(e){console.warn('[PersistenceGuard] compression skipped',e?.message||e);return text;}
  }
  async function decodeCloudValue(value){
    const text=String(value??'');
    if(!text.startsWith(COMPRESSED_PREFIX)) return text;
    if(typeof DecompressionStream==='undefined') throw new Error('المتصفح لا يدعم فك بيانات الأرشيف السحابية المضغوطة');
    const bin=atob(text.slice(COMPRESSED_PREFIX.length));const arr=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
    const stream=new Blob([arr]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  async function flush(keepalive=false){
    clearTimeout(flushTimer);flushTimer=0;
    if(!window.PlatformStateEngine) return;
    for(const scope of ['school','user']){
      const q=queues[scope]; if(!q.size) continue;
      const items=[...q.values()]; q.clear();
      for(let i=0;i<items.length;i+=200){
        const batch=items.slice(i,i+200);
        try{
          const cloudBatch=[];
          for(const x of batch) cloudBatch.push(x.deleted?x:{...x,value:await encodeCloudValue(x.value)});
          if(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.managerUpsertUser==='function') await PlatformStateEngine.managerUpsertUser(moduleKey,targetOwnerUserId,cloudBatch,{keepalive});
          else await PlatformStateEngine.bulkUpsert(moduleKey,scope,cloudBatch,{keepalive});
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
    const wanted=(explicitMode&&!prefixes.length)?[...exact]:undefined;
    const result=(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.pullUser==='function')?await PlatformStateEngine.pullUser(moduleKey,targetOwnerUserId,wanted):await PlatformStateEngine.pull(moduleKey,scope,wanted);
    const rows=[...(result.items||[])];
    const canonicalKeys=new Set(rows.map(r=>String(r.state_key||r.key||'')));
    if(explicitMode&&legacyModuleKeys.length){
      for(const legacyModule of legacyModuleKeys){
        try{
          const legacyResult=(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.pullUser==='function')?await PlatformStateEngine.pullUser(legacyModule,targetOwnerUserId,wanted):await PlatformStateEngine.pull(legacyModule,scope,wanted);
          for(const row of (legacyResult.items||[])){
            const lk=String(row.state_key||row.key||'');
            if(lk&&track(lk)&&scopeFor(lk)===scope&&!canonicalKeys.has(lk)&&!rows.some(x=>String(x.state_key||x.key||'')===lk)) rows.push(row);
          }
        }catch(e){console.warn('[PersistenceGuard] legacy hydrate skipped',legacyModule,e?.message||e);}
      }
    }
    const cloud=new Map(rows.map(r=>[String(r.state_key),r]));
    let changed=false;
    applying=true;
    try{
      const changedKeys=[];
      for(const [k,r] of cloud){
        if(!track(k)||scopeFor(k)!==scope) continue;
        const before=nativeGet.call(localStorage,k);
        if(r.deleted_at){
          if(before!==null){nativeRemove.call(localStorage,k);changed=true;changedKeys.push({key:k,oldValue:before,newValue:null});}
          continue;
        }
        const cloudVal=r.payload&&Object.prototype.hasOwnProperty.call(r.payload,'value')?String(r.payload.value):null;
        const val=cloudVal===null?null:await decodeCloudValue(cloudVal);
        if(val!==null&&before!==val){nativeSet.call(localStorage,k,val);changed=true;changedKeys.push({key:k,oldValue:before,newValue:val});}
      }
      if(changedKeys.length){
        queueMicrotask(()=>changedKeys.forEach(x=>{
          try{window.dispatchEvent(new StorageEvent('storage',{key:x.key,oldValue:x.oldValue,newValue:x.newValue,storageArea:localStorage,url:location.href}));}catch(_){ }
        }));
      }
      const migration=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i); if(!track(k)||scopeFor(k)!==scope||canonicalKeys.has(k)) continue;
        const v=nativeGet.call(localStorage,k); if(v!==null) migration.push({key:k,value:v,deleted:false});
      }
      applying=false;
      for(let i=0;i<migration.length;i+=150){try{const source=migration.slice(i,i+150),cloudMigration=[];for(const x of source)cloudMigration.push(x.deleted?x:{...x,value:await encodeCloudValue(x.value)});if(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.managerUpsertUser==='function')await PlatformStateEngine.managerUpsertUser(moduleKey,targetOwnerUserId,cloudMigration);else await PlatformStateEngine.bulkUpsert(moduleKey,scope,cloudMigration);}catch(e){console.warn('[PersistenceGuard] migration failed',e?.message||e);break;}}
    }finally{applying=false;}
    return changed;
  }


  async function commit(keys){
    // PERFORMANCE_ARCHIVE_EXACT_DOMAIN_2026_08_28
    // قد يضغط المستخدم حفظ قبل اكتمال تهيئة المحرك السحابي؛ انتظر بدلاً من
    // اعتبار ذلك فشلاً فورياً. لا يتم إرجاع نجاح إلا بعد القراءة من السحابة.
    let engineWait=0;
    while(!window.PlatformStateEngine && engineWait++<80){
      await new Promise(r=>setTimeout(r,100));
    }
    if(!window.PlatformStateEngine) return {ok:false,error:'محرك الحالة السحابية غير متاح'};
    const wanted=[...new Set((Array.isArray(keys)?keys:[keys]).map(String).filter(Boolean))].filter(track);
    if(!wanted.length) return {ok:true,verified:0};

    // ضع القيم الحالية في قوائم الكتابة فورًا، بدل انتظار المؤقت.
    wanted.forEach(function(k){
      const v=nativeGet.call(localStorage,k);
      queue(k,v===null?'':v,v===null);
    });
    await flush(false);

    // إذا بقيت عناصر في قائمة الانتظار فهناك فشل كتابة.
    for(const scope of ['school','user']){
      if([...queues[scope].keys()].some(k=>wanted.includes(k))){
        return {ok:false,error:'تعذر إكمال الكتابة السحابية لبعض البيانات'};
      }
    }

    // تحقق بالقراءة من المصدر السحابي نفسه.
    for(const scope of ['school','user']){
      const scoped=wanted.filter(k=>scopeFor(k)===scope);
      if(!scoped.length) continue;
      try{
        let result,rows,map,verifyTry=0;
        // بعض عمليات upsert تحتاج زمناً قصيراً قبل أن تظهر في قراءة التحقق.
        // نعيد القراءة فقط؛ لا نعتبر البيانات المحلية دليلاً على النجاح.
        while(verifyTry++<4){
          if(scope==='user'&&targetOwnerUserId&&typeof PlatformStateEngine.pullUser==='function'){
            result=await PlatformStateEngine.pullUser(moduleKey,targetOwnerUserId,scoped);
          }else{
            result=await PlatformStateEngine.pull(moduleKey,scope,scoped);
          }
          rows=Array.isArray(result)?result:(result?.items||result?.rows||[]);
          map=new Map(rows.map(r=>[String(r.state_key||r.key||''),r]));
          let complete=true;
          for(const k of scoped){
            const local=nativeGet.call(localStorage,k), row=map.get(k);
            if(local!==null && (!row || row.deleted_at || row.deleted===true)){complete=false;break;}
          }
          if(complete) break;
          await new Promise(r=>setTimeout(r,180*verifyTry));
        }
        for(const k of scoped){
          const local=nativeGet.call(localStorage,k);
          const row=map.get(k);
          if(local===null){
            if(row && !row.deleted_at && !(row.deleted===true)) return {ok:false,error:'تعذر التحقق من حذف '+k};
          }else{
            if(!row || row.deleted_at || row.deleted===true) return {ok:false,error:'تعذر التحقق من حفظ '+k};
            const cloudRaw=row.payload&&Object.prototype.hasOwnProperty.call(row.payload,'value')?String(row.payload.value):
                        Object.prototype.hasOwnProperty.call(row,'value')?String(row.value):null;
            const cloud=cloudRaw===null?null:await decodeCloudValue(cloudRaw);
            if(cloud!==String(local)) return {ok:false,error:'القيمة السحابية لا تطابق البيانات المحلية للمفتاح '+k};
          }
        }
      }catch(e){
        return {ok:false,error:e?.message||String(e)};
      }
    }
    return {ok:true,verified:wanted.length};
  }


  async function readExact(options){
    options=options||{};
    const exactModule=String(options.moduleKey||moduleKey).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||moduleKey;
    const exactScope=String(options.scope||'user')==='school'?'school':'user';
    const ownerUserId=String(options.ownerUserId||'').trim();
    const keys=[...new Set((Array.isArray(options.keys)?options.keys:[options.keys]).map(String).filter(Boolean))];
    if(!keys.length) return {ok:true,found:0,moduleKey:exactModule,scope:exactScope};
    let tries=0;
    while(!window.PlatformStateEngine && tries++<80) await new Promise(r=>setTimeout(r,100));
    if(!window.PlatformStateEngine) return {ok:false,error:'محرك الحالة السحابية غير متاح'};
    try{
      let result;
      if(exactScope==='user'&&ownerUserId&&typeof PlatformStateEngine.pullUser==='function') result=await PlatformStateEngine.pullUser(exactModule,ownerUserId,keys);
      else result=await PlatformStateEngine.pull(exactModule,exactScope,keys);
      const rows=Array.isArray(result)?result:(result?.items||result?.rows||[]);
      const map=new Map(rows.map(r=>[String(r.state_key||r.key||''),r]));
      const changed=[];
      applying=true;
      try{
        for(const k of keys){
          const row=map.get(k), before=nativeGet.call(localStorage,k);
          if(!row || row.deleted_at || row.deleted===true){
            if(options.removeMissing===true && before!==null){nativeRemove.call(localStorage,k);changed.push({key:k,oldValue:before,newValue:null});}
            continue;
          }
          const raw=row.payload&&Object.prototype.hasOwnProperty.call(row.payload,'value')?String(row.payload.value):Object.prototype.hasOwnProperty.call(row,'value')?String(row.value):null;
          if(raw===null) continue;
          const val=await decodeCloudValue(raw);
          if(before!==val){nativeSet.call(localStorage,k,val);changed.push({key:k,oldValue:before,newValue:val});}
        }
      }finally{applying=false;}
      changed.forEach(x=>{try{window.dispatchEvent(new StorageEvent('storage',{key:x.key,oldValue:x.oldValue,newValue:x.newValue,storageArea:localStorage,url:location.href}));}catch(_){}});
      return {ok:true,found:map.size,changed:changed.length,moduleKey:exactModule,scope:exactScope};
    }catch(e){return {ok:false,error:e?.message||String(e),moduleKey:exactModule,scope:exactScope};}
  }

  function whenReady(){return hydrated?Promise.resolve({moduleKey,hydrated:true}):readyPromise;}


  async function commitExact(options){
    options=options||{};
    const exactModule=String(options.moduleKey||moduleKey).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||moduleKey;
    const exactScope=String(options.scope||'user')==='school'?'school':'user';
    const ownerUserId=String(options.ownerUserId||'').trim();
    const keys=[...new Set((Array.isArray(options.keys)?options.keys:[options.keys]).map(String).filter(Boolean))];
    if(!keys.length) return {ok:true,verified:0,moduleKey:exactModule,scope:exactScope};
    let tries=0;
    while(!window.PlatformStateEngine && tries++<80) await new Promise(r=>setTimeout(r,100));
    if(!window.PlatformStateEngine) return {ok:false,error:'محرك الحالة السحابية غير متاح'};

    const items=keys.map(k=>{const v=nativeGet.call(localStorage,k);return {key:k,value:v===null?'':String(v),deleted:v===null};});
    const cloudItems=[];for(const x of items)cloudItems.push(x.deleted?x:{...x,value:await encodeCloudValue(x.value)});
    try{
      if(exactScope==='user'&&ownerUserId&&typeof PlatformStateEngine.managerUpsertUser==='function'){
        await PlatformStateEngine.managerUpsertUser(exactModule,ownerUserId,cloudItems);
      }else{
        await PlatformStateEngine.bulkUpsert(exactModule,exactScope,cloudItems);
      }
    }catch(e){return {ok:false,error:e?.message||String(e)};}

    let result,rows=[],map=new Map();
    for(let attempt=1;attempt<=5;attempt++){
      try{
        if(exactScope==='user'&&ownerUserId&&typeof PlatformStateEngine.pullUser==='function') result=await PlatformStateEngine.pullUser(exactModule,ownerUserId,keys);
        else result=await PlatformStateEngine.pull(exactModule,exactScope,keys);
        rows=Array.isArray(result)?result:(result?.items||result?.rows||[]);
        map=new Map(rows.map(r=>[String(r.state_key||r.key||''),r]));
        let complete=true;
        for(const it of items){
          const row=map.get(it.key);
          if(it.deleted){if(row&&!row.deleted_at&&row.deleted!==true){complete=false;break;}}
          else if(!row||row.deleted_at||row.deleted===true){complete=false;break;}
          else{
            const cloudRaw=row.payload&&Object.prototype.hasOwnProperty.call(row.payload,'value')?String(row.payload.value):Object.prototype.hasOwnProperty.call(row,'value')?String(row.value):null;
            const cloud=cloudRaw===null?null:await decodeCloudValue(cloudRaw);
            if(cloud!==it.value){complete=false;break;}
          }
        }
        if(complete) return {ok:true,verified:keys.length,moduleKey:exactModule,scope:exactScope};
      }catch(e){if(attempt===5)return {ok:false,error:e?.message||String(e)};}
      await new Promise(r=>setTimeout(r,180*attempt));
    }
    return {ok:false,error:'تعذر التحقق من تطابق الأرشيف السحابي مع البيانات المحلية',moduleKey:exactModule,scope:exactScope};
  }

  async function boot(){
    if(booted) return; booted=true;
    let tries=0;
    while(tries++<60&&!window.PlatformStateEngine) await new Promise(r=>setTimeout(r,100));
    if(!window.PlatformStateEngine){hydrated=true;try{readyResolve({moduleKey,hydrated:false,error:'engine_unavailable'});}catch(_){} return;}
    try{
      const changedSchool=await hydrateScope('school');
      const changedUser=await hydrateScope('user');
      hydrated=true;
      window.dispatchEvent(new CustomEvent('platform-persistence-ready',{detail:{moduleKey,changed:changedSchool||changedUser}}));
      try{readyResolve({moduleKey,hydrated:true,changed:changedSchool||changedUser});}catch(_){}
      // لا نعيد تحميل الصفحة بعد Hydration. إعادة التحميل كانت تسبب الومضة
      // والعودة المؤقتة إلى واجهة الترحيب في كل قسم مستقل. بدلاً من ذلك
      // نُبقي الصفحة الحالية ونعلن جاهزية البيانات، وتصل تغييرات المفاتيح عبر StorageEvent.
    }catch(e){console.warn('[PersistenceGuard] hydrate skipped',moduleKey,e?.message||e);hydrated=true;try{readyResolve({moduleKey,hydrated:false,error:e?.message||String(e)});}catch(_){}}
  }
  window.addEventListener('pagehide',()=>void flush(true));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flush(true)});
  window.PlatformPersistenceGuard={VERSION:'2026.08.28-archive-domain-v4',moduleKey,track,scopeFor,flush,commit,commitExact,readExact,whenReady,boot,get hydrated(){return hydrated;}};
  setTimeout(boot,0);
})();
