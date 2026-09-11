(function(){
 'use strict';
 async function emitCoreEvent(task,eventType,data={}){try{if(window.PlatformCore)await PlatformCore.emitRecordEvent({moduleKey:'central_tasks',recordType:'central_task',recordId:task.task_id||task.id,taskId:task.task_id||task.id,eventType,data})}catch(e){console.warn('تعذر إرسال حدث Platform Core:',e)}}

 let cloudUsersCache=[];
 function normalizeCloudRole(r){r=String(r||'').trim().toLowerCase();if(['administrative_employee','admin_employee','administrative'].includes(r))return'admin_employee';if(['manager','leadership','principal'].includes(r))return'manager';if(['agent','agency','wakil','deputy'].includes(r))return'agent';if(['teacher','performance'].includes(r))return'teacher';if(['student_advisor','counselor'].includes(r))return'student_advisor';if(['activity_leader','activity'].includes(r))return'activity_leader';return r||'user'}
 async function refreshAssignableUsers(){
  try{
   const r=await CloudTaskEngine.listUsers();
   cloudUsersCache=(r.users||[]).map(u=>({id:u.id,name:u.full_name||u.name||u.email||'مستخدم',email:u.email||'',role:normalizeCloudRole(u.role),status:u.status||'active',role_label:u.role_label||''})).filter(u=>u.id&&u.status!=='deleted'&&(!(u.role==='admin_employee')||u.status==='active'));
   window.__centralTaskCloudUsers=cloudUsersCache.slice();
   window.collectUsers=function(){return cloudUsersCache.length?cloudUsersCache.slice():[]};
   window.populateUsers=function(){const el=document.getElementById('assigneeId');if(!el)return;const ordinary=cloudUsersCache.filter(u=>u.role!=='admin_employee');const admins=cloudUsersCache.filter(u=>u.role==='admin_employee');let html='';if(ordinary.length)html+='<optgroup label="مستخدمو المدرسة">'+ordinary.map(u=>`<option value="${esc(u.id)}" data-role="${esc(u.role)}" data-email="${esc(u.email)}">${esc(u.name)} — ${esc(roleLabel(u.role))}</option>`).join('')+'</optgroup>';if(admins.length)html+='<optgroup label="──────── الموظفون الإداريون ────────">'+admins.map(u=>`<option value="${esc(u.id)}" data-role="admin_employee" data-email="${esc(u.email)}">${esc(u.name)} — موظف/موظفة إدارية</option>`).join('')+'</optgroup>';el.innerHTML=html||'<option value="">لا يوجد مستخدمون مفعّلون</option>';};
   window.populateUsers();
  }catch(e){console.warn('تعذر تحميل قائمة المكلفين السحابية',e)}
 }
 function toast(msg,ok=true){let x=document.getElementById('cloudTaskToast');if(!x){x=document.createElement('div');x.id='cloudTaskToast';x.style.cssText='position:fixed;left:24px;bottom:24px;z-index:99999;padding:12px 18px;border-radius:16px;color:white;font-weight:900;font-size:13px;box-shadow:0 16px 40px #0003;transition:.25s';document.body.appendChild(x)}x.textContent=msg;x.style.background=ok?'#0f766e':'#b91c1c';x.style.opacity='1';setTimeout(()=>x.style.opacity='0',3500)}
 async function refresh(options={}){if(!window.CloudTaskEngine)return;try{const r=await CloudTaskEngine.list();const pending=window.__centralTaskPendingDeletes instanceof Set?window.__centralTaskPendingDeletes:new Set();const mapped=(r.tasks||[]).map(CloudTaskEngine.mapTask).filter(t=>!pending.has(String(t.task_id||t.id||'')));if(options.preserveOnEmpty&&mapped.length===0&&tasks().length>0){console.warn('أعاد الخادم قائمة فارغة بعد الحفظ؛ تم الاحتفاظ بالعرض الحالي مؤقتًا.');return;}try{saveTasks(mapped);}catch(cacheError){if(cacheError&&(cacheError.name==='QuotaExceededError'||cacheError.code===22)){console.warn('[central-task-cache-quota] تعذر تحديث الكاش المحلي، وسيستمر العرض من بيانات السحابة.',cacheError);toast('تم تحميل التكليفات سحابيًا، ويجري إصلاح مساحة التخزين المحلية.',false);}else throw cacheError;}renderAll();window.dispatchEvent(new CustomEvent('central-tasks:cloud-loaded',{detail:{count:mapped.length}}));}catch(e){console.warn('تعذر تحميل التكليفات السحابية، تم الإبقاء على النسخة المحلية المؤقتة:',e);toast(e.message||'تعذر تحميل التكليفات السحابية',false)}}
 document.addEventListener('DOMContentLoaded',async()=>{
  if(!window.CloudTaskEngine)return;
  await refreshAssignableUsers();
  const oldCreate=window.createTask;
  window.createTask=async function(e){
   e?.preventDefault?.();
   const form=document.getElementById('taskForm');
   if(form && !form.reportValidity()) return;
   const submit=form?.querySelector('button[type="submit"]');
   if(submit?.dataset.saving==='1') return;
   if(submit){submit.dataset.saving='1';submit.disabled=true;submit.dataset.originalText=submit.textContent||'';submit.textContent='جارٍ الحفظ سحابيًا...'}
   try{
    const users=(window.collectUsers?window.collectUsers():collectUsers()),sel=document.getElementById('assigneeId'),u=users.find(x=>String(x.id)===String(sel.value))||{};
    if(!u.id && !u.email) throw new Error('تعذر تحديد حساب المستخدم المكلف. حدّث الصفحة واختر المستخدم مرة أخرى.');
    const assignmentType=document.getElementById('taskType').value;
    const libraryPreset=assignmentType==='library_record'?(window.libraryDelegationPreset?.()||null):null;
    const owner=assignmentType==='additional_role'?'delegated_roles':(assignmentType==='library_record'?(libraryPreset?.owner||'library'):document.getElementById('sourceOwner').value);
    const section=document.getElementById('ownerSection')?.value||'';
    const group=document.getElementById('recordGroup')?.value||'';
    let delegationScope=document.getElementById('delegationScope')?.value||'record_type';
    let recordDef=null, delegatedRecords=[];
    if(assignmentType==='library_record'){
      if(!libraryPreset?.fileId)throw new Error('لم يتم تحديد سجل من مكتبة القسم. افتح التكليف من زر «تكليف بالعمل» داخل المكتبة.');
      if(!window.CloudFileEngine)throw new Error('محرك الملفات السحابي غير متاح.');
      const usage=await CloudFileEngine.usage(String(libraryPreset.fileId));const file=usage?.file;
      if(!file)throw new Error('السجل السحابي المحدد غير موجود أو لم يعد متاحًا.');
      const currentId=String(localStorage.getItem('currentUserId')||localStorage.getItem('current_user_id')||'');
      if(String(file.ownership_scope||'')!=='user'||String(file.owner_user_id||'')!==currentId)throw new Error('لا يمكن تكليف مستخدم بسجل من مكتبة مستخدم آخر.');
      const allowedModule=libraryPreset.owner==='manager'?'manager_records_archive':'section_library_agent';
      if(String(file.module_key||'')!==allowedModule)throw new Error('السجل لا يتبع مكتبة المدير/الوكيل الحالية.');
      const extension=String(file.extension||'').toLowerCase();if(!['docx','xlsx','pptx'].includes(extension))throw new Error('التكليف بالعمل متاح لسجلات DOCX/XLSX/PPTX القابلة للتحرير السحابي.');
      recordDef={label:libraryPreset.fileName||file.display_name||'سجل من مكتبة القسم',moduleKey:'section_library_delegation',recordType:'delegated_library_file',recordId:String(file.id),routeUrl:'central_task_center.html',owner:owner,ownerSection:'section_library',ownerSectionLabel:'مكتبة القسم',recordGroupKey:'external_library_records',recordGroupName:'سجلات خارجية من مكتبة القسم',supportsFiles:true};
      delegatedRecords=[recordDef];delegationScope='record';
    }else if(assignmentType==='additional_role'){
      const roleCode=document.getElementById('additionalRoleCode')?.value||'';
      const rd=window.fullRoleDefinition?.(roleCode);
      if(!rd)throw new Error('اختر الدور الكامل المراد تكليفه.');
      delegatedRecords=(window.roleDelegatedRecords?.(roleCode)||[]).filter(r=>r?.moduleKey&&r?.recordType);
      recordDef={label:rd.label,moduleKey:'delegated_roles',recordType:'full_role_portal',recordId:roleCode,routeUrl:rd.portal,owner:'delegated_roles',ownerSection:'delegated_roles',ownerSectionLabel:'الأدوار المكلف بها',recordGroupKey:'full_roles',recordGroupName:'الأدوار الكاملة',supportsFiles:true};
      delegationScope='record';
    }else{
      const selectedValue=document.getElementById('recordKey').value;
      recordDef=delegationScope==='record_group'
        ? window.PlatformRecordCatalog?.groupDefinition(owner,section,group)
        : (window.PlatformRecordCatalog?.fromOption(selectedValue)||window.PlatformRecordCatalog?.resolve(selectedValue,owner)||null);
      if(!recordDef) throw new Error('تعذر التعرف على نطاق التفويض المحدد. حدّث الصفحة واختر القسم والمجموعة مرة أخرى.');
      delegatedRecords=(delegationScope==='record_group'?(recordDef.records||[]):[recordDef]).filter(r=>r?.moduleKey&&r?.recordType);
    }
    const roleCode=assignmentType==='additional_role'?(document.getElementById('additionalRoleCode')?.value||''):'';
    const responsibleId=String(localStorage.getItem('currentUserId')||localStorage.getItem('current_user_id')||'').trim();
    const responsibleEmail=String(localStorage.getItem('currentUserEmail')||'').trim().toLowerCase();
    const responsibleRole=normalizeCloudRole(typeof role==='function'?role():'');
    const responsibleName=typeof currentOwnerLabel==='function'?currentOwnerLabel():'صاحب الصلاحية';
    if(!responsibleId) throw new Error('تعذر تحديد معرف المسؤول الفعلي من جلسة المستخدم. أعد تسجيل الدخول ثم حاول مرة أخرى.');
    const roleDef=assignmentType==='additional_role'?window.fullRoleDefinition?.(roleCode):null;
    const payload={title:document.getElementById('taskTitle').value,description:document.getElementById('taskDesc').value,assignmentType,sourceOwner:owner,recordKey:recordDef.label,moduleKey:recordDef.moduleKey,recordType:recordDef.recordType||null,recordId:recordDef.recordId||null,ownerLabel:currentOwnerLabel(),assignedTo:u.id,assigneeEmail:u.email,assigneeName:u.name,assigneeRole:u.role,priority:document.getElementById('priority').value,startDate:document.getElementById('startDate').value,dueDate:document.getElementById('dueDate').value,metadata:{responsible_user_id:responsibleId,responsible_email:responsibleEmail,responsible_role:responsibleRole,responsible_name:responsibleName,reviewer_id:responsibleId,reviewer_email:responsibleEmail,reviewer_role:responsibleRole,reviewer_name:responsibleName,recordLabel:recordDef.label,routeUrl:recordDef.routeUrl,catalogVersion:window.PlatformRecordCatalog?.version||'unknown',ownerSection:recordDef.ownerSection||section,ownerSectionLabel:recordDef.ownerSectionLabel||'',recordGroupKey:recordDef.recordGroupKey||group,recordGroupName:recordDef.recordGroupName||recordDef.label,delegationScope,delegatedRoleCode:roleCode||null,delegatedRoleLabel:roleDef?.label||null,rolePortalUrl:roleDef?.portal||null,roleAgencyType:roleDef?.agency||null,delegatedRecords:delegatedRecords.map(r=>({moduleKey:r.moduleKey,recordType:r.recordType,recordId:r.recordId||null,label:r.label,routeUrl:r.routeUrl})),libraryFileId:libraryPreset?.fileId||null,libraryFileName:libraryPreset?.fileName||null,libraryOwner:libraryPreset?.owner||null,libraryModule:libraryPreset?.moduleKey||null,libraryFolder:libraryPreset?.folder||null},grant:{moduleKey:recordDef.moduleKey,recordType:recordDef.recordType||null,recordId:recordDef.recordId||null,permissionScope:delegationScope,recordGroupKey:recordDef.recordGroupKey||group,canCreate:true,canUpdate:true,canUpload:recordDef.supportsFiles!==false,canSubmit:true,canApprove:false}};
    const r=await CloudTaskEngine.create(payload);
    if(!r||!r.task||!r.task.id) throw new Error('لم يُرجع الخادم معرفًا صحيحًا للتكليف المحفوظ.');
    if(assignmentType==='library_record'){
      try{
        await CloudFileEngine.link({fileId:String(libraryPreset.fileId),moduleKey:'central_tasks',recordType:'delegated_library_file',recordId:String(r.task.id),relationType:'delegated_work_file',isPrimary:true});
      }catch(linkError){
        try{await CloudTaskEngine.transition(String(r.task.id),'withdrawn','تعذر ربط سجل مكتبة القسم بالتكليف؛ تم سحب التكليف آليًا لحماية الخصوصية.')}catch(_){}
        throw new Error('تم منع التكليف لأن ربط السجل السحابي لم يكتمل: '+(linkError?.message||linkError));
      }
    }
    const t=CloudTaskEngine.mapTask(r.task);
    let a=tasks();
    if(!Array.isArray(a))a=[];
    a=a.filter(x=>String(x?.task_id||'')!==String(t.task_id));
    a.unshift(t);
    saveTasks(a);
    // عمليات التوافق المحلية مساندة فقط؛ لا يجوز أن تحول نجاح الحفظ السحابي إلى فشل مرئي.
    try{routeTaskToAssignee(t)}catch(syncError){console.warn('[central-task-local-route]',syncError)}
    resetForm();switchView('active');renderAll();
    await emitCoreEvent(t,'task_created',{status:t.status,progress_percent:t.progress_percent,assignee_id:t.assignee_id,assignee_role:t.assignee_role});
    toast('تم إنشاء التكليف سحابيًا وإرساله للمكلف');
    await refresh({preserveOnEmpty:true});
   }catch(err){console.error('[central-task-create]',err);toast(err.message||'تعذر إنشاء التكليف السحابي',false)}
   finally{if(submit){submit.dataset.saving='0';submit.disabled=false;submit.textContent=submit.dataset.originalText||'حفظ التكليف'}}
  };
  // ضمان أن النموذج يستدعي المعالج السحابي حتى لو تم ربط المعالج المحلي قبله.
  const taskForm=document.getElementById('taskForm');
  if(taskForm){taskForm.onsubmit=window.createTask}
  const oldSet=window.setTask;
  window.setTask=function(next){const previous=getTask(next.task_id);oldSet(next);if(!next._cloud)return;setTimeout(async()=>{try{if(previous&&String(previous.assignee_id)!==String(next.assignee_id)){await CloudTaskEngine.reassign({taskId:next.task_id,assignedTo:next.assignee_id,assigneeEmail:next.assignee_email,assigneeName:next.assignee_name,assigneeRole:next.assignee_role,reason:'نقل من مركز التكليفات'});await emitCoreEvent(next,'task_reassigned',{status:next.status,progress_percent:next.progress_percent,assignee_id:next.assignee_id,assignee_role:next.assignee_role});toast('تم نقل التكليف سحابيًا');return}if(previous&&previous.status!==next.status){const map={in_progress:'in_progress',pending_approval:'pending_approval',approved:'approved',returned:'returned',rejected:'rejected',withdrawn:'withdrawn',archived:'archived'};if(map[next.status]){await CloudTaskEngine.transition(next.task_id,map[next.status],next.history?.[0]?.note||'');await emitCoreEvent(next,'task_status_changed',{status:next.status,progress_percent:next.progress_percent});toast('تم تحديث حالة التكليف سحابيًا')}}}catch(err){console.error(err);toast('تم الحفظ محليًا مؤقتًا، لكن تعذرت المزامنة السحابية: '+(err.message||err),false)}},0)};
  const oldSaveUpdate=window.saveUpdate;
  window.saveUpdate=async function(e,id){e.preventDefault();const t=getTask(id);if(!t)return;try{const file=document.getElementById('updFile').files[0];const title=document.getElementById('updTitle').value,notes=document.getElementById('updDesc').value,link=document.getElementById('updLink').value;const ur=await CloudTaskEngine.addUpdate({taskId:id,updateType:'execution',title,notes,linkUrl:link,status:'draft'});if(file){if(!window.CloudFileEngine)throw new Error('محرك الملفات غير متاح');const fr=await CloudFileEngine.upload({file,ownershipScope:'school',moduleKey:'central_tasks',recordType:'central_task',recordId:id,relationType:'evidence',metadata:{taskId:id,updateId:ur.update.id,responsible_user_id:t.responsible_user_id||t.reviewer_id||t.owner_id||'',responsible_email:t.responsible_email||t.reviewer_email||t.owner_email||'',responsible_role:t.responsible_role||t.reviewer_role||t.owner_role||'',responsible_name:t.responsible_name||t.reviewer_name||t.owner_label||'',reviewer_id:t.reviewer_id||t.responsible_user_id||t.owner_id||'',reviewer_email:t.reviewer_email||t.responsible_email||t.owner_email||'',reviewer_role:t.reviewer_role||t.responsible_role||t.owner_role||'',reviewer_name:t.reviewer_name||t.responsible_name||t.owner_label||''}});await CloudTaskEngine.attachEvidence({taskId:id,updateId:ur.update.id,platformFileId:fr.file.id,evidenceType:'execution'})}await emitCoreEvent(t,'record_updated',{status:t.status,progress_percent:t.progress_percent,title,notes,evidence:!!file});await refresh();closeModal();toast('تم حفظ التنفيذ والشاهد سحابيًا');}catch(err){console.error(err);toast(err.message||'تعذر حفظ التنفيذ السحابي',false)}};
  await refresh();
  await refreshAssignableUsers();
  setInterval(refresh,60000);
  window.addEventListener('focus',refresh);
 });
 window.CentralTaskCloudAdapter={refresh};
})();
