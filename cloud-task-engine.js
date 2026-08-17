(function(){
 'use strict';
 const VERSION='1.1.0',TIMEOUT=45000;
 const cfg={base:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'')+'/functions/v1/platform-tasks',anon:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM',token:()=>localStorage.getItem('platform_file_session_token')||''};
 async function ensure(){if(window.PlatformCloudSession?.ensure){await window.PlatformCloudSession.ensure();if(cfg.token())return cfg.token()}if(cfg.token())return cfg.token();throw new Error('تعذر استعادة الجلسة السحابية تلقائيًا.');}
 async function request(action,body,method='POST'){await ensure();const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT);try{const h={apikey:cfg.anon(),'x-platform-session':cfg.token(),'x-client-version':VERSION};let payload;if(method!=='GET'){h['content-type']='application/json';payload=JSON.stringify(body||{})}const send=async()=>{h['x-platform-session']=cfg.token();const r=await fetch(`${cfg.base()}?action=${encodeURIComponent(action)}`,{method,headers:h,body:payload,signal:c.signal});const j=await r.json().catch(()=>({}));return {r,j}};let res=await send();if(res.r.status===401&&window.PlatformCloudSession?.recover){await window.PlatformCloudSession.recover();res=await send()}if(!res.r.ok)throw new Error(res.j.error||`فشلت عملية التكليفات (${action}: ${res.r.status})`);if(action==='create'&&(!res.j||!res.j.task||!res.j.task.id))throw new Error('استجابة إنشاء التكليف غير مكتملة ولم تتضمن task.id');window.dispatchEvent(new CustomEvent('cloudtasks:changed',{detail:{action,response:res.j}}));return res.j}catch(e){throw e?.name==='AbortError'?new Error('انتهت مهلة الاتصال بمحرك التكليفات.'):e}finally{clearTimeout(t)}}
 const mapTask=t=>({task_id:t.id,school_id:t.school_id,title:t.title,description:t.description||'',assignment_type:t.assignment_type,source_owner:t.source_owner||'',record_key:t.record_key||'',owner_role:t.owner_role||'',owner_label:t.owner_label||'',owner_id:t.created_by,assignee_id:t.assigned_to||'',assignee_email:t.assignee_email||'',assignee_name:t.assignee_name||'',assignee_role:t.assignee_role||'',priority:t.priority,start_date:t.start_date||'',due_date:t.due_date||'',status:t.status,progress_percent:t.progress_percent||0,created_at:t.created_at,updated_at:t.updated_at,pending_updates:(t.central_task_updates||[]).map(u=>({id:u.id,title:u.title||'',desc:u.notes||'',link:u.link_url||'',at:u.created_at,status:u.status,progress_percent:u.progress_percent})),evidence:t.central_task_evidence||[],history:[],_cloud:true,_raw:t});
 async function archiveTask(taskId,note='أرشفة التكليف'){
  try{return await request('transition',{taskId,status:'archived',note})}
  catch(err){
   const msg=String(err?.message||err||'');
   if(!/انتقال الحالة غير مسموح|عملية غير مدعومة/.test(msg))throw err;
   const g=await request('get',{taskId}); const st=String(g?.task?.status||'');
   if(['active','in_progress','transferred'].includes(st)){await request('transition',{taskId,status:'withdrawn',note:'تهيئة الأرشفة'});return request('transition',{taskId,status:'archived',note})}
   if(st==='returned'){await request('transition',{taskId,status:'in_progress',note:'تهيئة الأرشفة'});await request('transition',{taskId,status:'withdrawn',note:'تهيئة الأرشفة'});return request('transition',{taskId,status:'archived',note})}
   if(['approved','rejected','withdrawn'].includes(st))return request('transition',{taskId,status:'archived',note});
   throw err;
  }
 }
 async function deleteTask(taskId,reason=''){
  try{return await request('delete-task',{taskId,reason})}
  catch(err){
   const msg=String(err?.message||err||'');
   // توافق مع نشر قديم لـ platform-tasks لا يعرف delete-task بعد.
   if(!/عملية غير مدعومة/.test(msg))throw err;
   const r=await archiveTask(taskId,reason||'إنهاء التكليف وإخفاؤه من المكلف');
   return {ok:true,taskId,compatibilityFallback:'archived',task:r?.task||null};
  }
 }
 const api={VERSION,request,health:()=>request('health',{},'GET'),list:o=>request('list',o||{}),get:taskId=>request('get',{taskId}),listUsers:()=>request('list-users',{}),setDeputyClassification:o=>request('set-deputy-classification',o),create:o=>request('create',o),reassign:o=>request('reassign',o),updateSchedule:o=>request('update-schedule',o),updateMetadata:o=>request('update-metadata',o),transition:(taskId,status,note='')=>request('transition',{taskId,status,note}),archiveTask,deleteTask,addUpdate:o=>request('add-update',o),attachEvidence:o=>request('attach-evidence',o),linkedRecords:taskId=>request('linked-records',{taskId}),dashboardSummary:o=>request('dashboard-summary',o||{}),mapTask};
 window.CloudTaskEngine=api;
})();
