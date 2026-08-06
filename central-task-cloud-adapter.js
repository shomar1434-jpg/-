(function(){
 'use strict';
 async function emitCoreEvent(task,eventType,data={}){try{if(window.PlatformCore)await PlatformCore.emitRecordEvent({moduleKey:'central_tasks',recordType:'central_task',recordId:task.task_id||task.id,taskId:task.task_id||task.id,eventType,data})}catch(e){console.warn('تعذر إرسال حدث Platform Core:',e)}}
 function toast(msg,ok=true){let x=document.getElementById('cloudTaskToast');if(!x){x=document.createElement('div');x.id='cloudTaskToast';x.style.cssText='position:fixed;left:24px;bottom:24px;z-index:99999;padding:12px 18px;border-radius:16px;color:white;font-weight:900;font-size:13px;box-shadow:0 16px 40px #0003;transition:.25s';document.body.appendChild(x)}x.textContent=msg;x.style.background=ok?'#0f766e':'#b91c1c';x.style.opacity='1';setTimeout(()=>x.style.opacity='0',3500)}
 async function refresh(options={}){if(!window.CloudTaskEngine)return;try{const r=await CloudTaskEngine.list();const mapped=(r.tasks||[]).map(CloudTaskEngine.mapTask);if(options.preserveOnEmpty&&mapped.length===0&&tasks().length>0){console.warn('أعاد الخادم قائمة فارغة بعد الحفظ؛ تم الاحتفاظ بالعرض الحالي مؤقتًا.');return;}saveTasks(mapped);renderAll();window.dispatchEvent(new CustomEvent('central-tasks:cloud-loaded',{detail:{count:mapped.length}}));}catch(e){console.warn('تعذر تحميل التكليفات السحابية، تم الإبقاء على النسخة المحلية المؤقتة:',e);toast(e.message||'تعذر تحميل التكليفات السحابية',false)}}
 document.addEventListener('DOMContentLoaded',async()=>{
  if(!window.CloudTaskEngine)return;
  const oldCreate=window.createTask;
  window.createTask=async function(e){
   e?.preventDefault?.();
   const form=document.getElementById('taskForm');
   if(form && !form.reportValidity()) return;
   const submit=form?.querySelector('button[type="submit"]');
   if(submit?.dataset.saving==='1') return;
   if(submit){submit.dataset.saving='1';submit.disabled=true;submit.dataset.originalText=submit.textContent||'';submit.textContent='جارٍ الحفظ سحابيًا...'}
   try{
    const users=collectUsers(),sel=document.getElementById('assigneeId'),u=users.find(x=>String(x.id)===String(sel.value))||{};
    if(!u.id && !u.email) throw new Error('تعذر تحديد حساب المستخدم المكلف. حدّث الصفحة واختر المستخدم مرة أخرى.');
    const owner=document.getElementById('sourceOwner').value;
    const section=document.getElementById('ownerSection')?.value||'';
    const group=document.getElementById('recordGroup')?.value||'';
    const delegationScope=document.getElementById('delegationScope')?.value||'record_type';
    const selectedValue=document.getElementById('recordKey').value;
    const recordDef=delegationScope==='record_group'
      ? window.PlatformRecordCatalog?.groupDefinition(owner,section,group)
      : (window.PlatformRecordCatalog?.fromOption(selectedValue)||window.PlatformRecordCatalog?.resolve(selectedValue,owner)||null);
    if(!recordDef) throw new Error('تعذر التعرف على نطاق التفويض المحدد. حدّث الصفحة واختر القسم والمجموعة مرة أخرى.');
    const assignmentType=document.getElementById('taskType').value;
    const payload={title:document.getElementById('taskTitle').value,description:document.getElementById('taskDesc').value,assignmentType,sourceOwner:owner,recordKey:recordDef.label,moduleKey:recordDef.moduleKey,recordType:delegationScope==='record_group'?null:recordDef.recordType,recordId:null,ownerLabel:currentOwnerLabel(),assignedTo:u.id,assigneeEmail:u.email,assigneeName:u.name,assigneeRole:u.role,priority:document.getElementById('priority').value,startDate:document.getElementById('startDate').value,dueDate:document.getElementById('dueDate').value,metadata:{recordLabel:recordDef.label,routeUrl:recordDef.routeUrl,catalogVersion:window.PlatformRecordCatalog?.version||'unknown',ownerSection:recordDef.ownerSection||section,ownerSectionLabel:recordDef.ownerSectionLabel||'',recordGroupKey:recordDef.recordGroupKey||group,recordGroupName:recordDef.recordGroupName||recordDef.label,delegationScope,delegatedRecords:(recordDef.records||[]).map(r=>({moduleKey:r.moduleKey,recordType:r.recordType,label:r.label,routeUrl:r.routeUrl}))},grant:{moduleKey:recordDef.moduleKey,recordType:delegationScope==='record_group'?null:recordDef.recordType,recordId:null,permissionScope:delegationScope,recordGroupKey:recordDef.recordGroupKey||group,canCreate:true,canUpdate:true,canUpload:recordDef.supportsFiles!==false,canSubmit:true,canApprove:false}};
    const r=await CloudTaskEngine.create(payload);
    if(!r||!r.task||!r.task.id) throw new Error('لم يُرجع الخادم معرفًا صحيحًا للتكليف المحفوظ.');
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
  window.saveUpdate=async function(e,id){e.preventDefault();const t=getTask(id);if(!t)return;try{const file=document.getElementById('updFile').files[0];const title=document.getElementById('updTitle').value,notes=document.getElementById('updDesc').value,link=document.getElementById('updLink').value;const ur=await CloudTaskEngine.addUpdate({taskId:id,updateType:'execution',title,notes,linkUrl:link,status:'draft'});if(file){if(!window.CloudFileEngine)throw new Error('محرك الملفات غير متاح');const fr=await CloudFileEngine.upload({file,ownershipScope:'school',moduleKey:'central_tasks',recordType:'central_task',recordId:id,relationType:'evidence',metadata:{taskId:id,updateId:ur.update.id}});await CloudTaskEngine.attachEvidence({taskId:id,updateId:ur.update.id,platformFileId:fr.file.id,evidenceType:'execution'})}await emitCoreEvent(t,'record_updated',{status:t.status,progress_percent:t.progress_percent,title,notes,evidence:!!file});await refresh();closeModal();toast('تم حفظ التنفيذ والشاهد سحابيًا');}catch(err){console.error(err);toast(err.message||'تعذر حفظ التنفيذ السحابي',false)}};
  await refresh();
  setInterval(refresh,60000);
  window.addEventListener('focus',refresh);
 });
 window.CentralTaskCloudAdapter={refresh};
})();
