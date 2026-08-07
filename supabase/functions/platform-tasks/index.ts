import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session, x-client-version','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
const safeKey=(v:unknown,f='general')=>String(v||f).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||f;
const ownerRoles=new Set(['manager','owner','school_manager','principal','agent','deputy','deputy_admin','deputy_academic','deputy_students','وكيل','مدير','مديرة']);
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return json({error:'إعدادات محرك التكليفات غير مكتملة',code:'TASKS_ENV_MISSING'},500);
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),requestId=crypto.randomUUID();
 try{
  const raw=req.headers.get('x-platform-session')||''; if(!raw)return json({error:'جلسة المنصة مفقودة',code:'SESSION_MISSING'},401);
  const now=new Date().toISOString(),hash=await sha256(raw);
  const {data:s,error:se}=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();
  if(se)throw se; if(!s)return json({error:'انتهت جلسة المنصة',code:'SESSION_EXPIRED'},401);
  await sb.from('platform_sessions').update({last_seen_at:now}).eq('id',s.id);
  const action=new URL(req.url).searchParams.get('action')||'',body=req.method==='GET'?{}:await req.json().catch(()=>({}));
  const role=String(s.role||'').toLowerCase(),isOwner=ownerRoles.has(role)||ownerRoles.has(String(s.role||''));
  let sessionEmail=String(s.user_email||'').trim().toLowerCase();
  if(!sessionEmail&&isUuid(s.user_id)){const {data:su}=await sb.from('users').select('email').eq('id',s.user_id).eq('school_id',s.school_id).maybeSingle();sessionEmail=String(su?.email||'').trim().toLowerCase()}
  const event=async(taskId:string,type:string,note='',oldValues:any=null,newValues:any=null)=>{await sb.from('central_task_events').insert({school_id:s.school_id,task_id:taskId,actor_id:s.user_id,event_type:type,event_note:note||null,old_values:oldValues,new_values:newValues})};
  const notice=async(taskId:string,userId:any,email:any,type:string,title:string,message:string)=>{await sb.from('central_task_notifications').insert({school_id:s.school_id,task_id:taskId,recipient_user_id:isUuid(userId)?userId:null,recipient_email:email?String(email).toLowerCase():null,notification_type:type,title,message})};
  const getTask=async(id:string)=>{const {data}=await sb.from('central_tasks').select('*').eq('id',id).eq('school_id',s.school_id).is('deleted_at',null).maybeSingle();return data};
  const mine=(t:any)=>t&&(String(t.assigned_to||'')===String(s.user_id)||String(t.assignee_email||'').toLowerCase()===sessionEmail);
  const canRead=(t:any)=>t&&t.school_id===s.school_id&&(isOwner||mine(t)||String(t.created_by)===String(s.user_id));
  const executionStatuses=new Set(['active','in_progress','transferred','returned']);
  const terminalStatuses=new Set(['approved','rejected','withdrawn','archived','closed','canceled']);
  const revokeTaskAccess=async(taskId:string)=>{
   await sb.from('task_access_grants').update({status:'revoked'}).eq('task_id',taskId).eq('status','active');
   await sb.from('central_task_assignments').update({is_current:false,ended_at:now}).eq('task_id',taskId).eq('is_current',true);
  };
  const uniqueGrantRows=(rows:any[])=>{const m=new Map();for(const r of rows||[]){const k=[r.module_key,r.record_type||'',r.record_id||''].join('|');if(!m.has(k))m.set(k,r)}return Array.from(m.values())};
  console.log('[platform-tasks]',{requestId,action,schoolId:s.school_id,userId:s.user_id,role:s.role});
  if(action==='health')return json({ok:true,version:'2.1.0',schoolId:s.school_id,userId:s.user_id,role:s.role});
  if(action==='list-users'){
   if(!isOwner)return json({error:'لا توجد صلاحية لعرض المستخدمين'},403);
   const {data,error}=await sb.from('users').select('id,school_id,email,full_name,role,status').eq('school_id',s.school_id).order('full_name');
   if(error)throw error;return json({users:(data||[]).filter((u:any)=>String(u.status||'active')!=='deleted')});
  }
  if(action==='list'){
   let q=sb.from('central_tasks').select('*,central_task_updates(*),central_task_evidence(*),central_task_assignments(*)').eq('school_id',s.school_id).is('deleted_at',null).order('updated_at',{ascending:false}).limit(Math.min(Number(body.limit)||500,1000));
   if(!isOwner)q=q.or(`assigned_to.eq.${s.user_id},created_by.eq.${s.user_id}${sessionEmail?`,assignee_email.eq.${sessionEmail}`:''}`);
   if(body.status)q=q.eq('status',body.status);if(body.moduleKey)q=q.eq('module_key',safeKey(body.moduleKey));
   const {data,error}=await q;if(error)throw error;return json({tasks:data||[]});
  }
  if(action==='get'){
   const t=await getTask(String(body.taskId||''));if(!t)return json({error:'التكليف غير موجود'},404);if(!canRead(t))return json({error:'لا توجد صلاحية'},403);
   const [{data:updates},{data:assignments},{data:evidence},{data:reviews},{data:events},{data:grants},{data:links}]=await Promise.all([
    sb.from('central_task_updates').select('*').eq('task_id',t.id).order('created_at',{ascending:false}),sb.from('central_task_assignments').select('*').eq('task_id',t.id).order('assigned_at',{ascending:false}),sb.from('central_task_evidence').select('*,platform_files(*)').eq('task_id',t.id).is('deleted_at',null),sb.from('central_task_reviews').select('*').eq('task_id',t.id).order('reviewed_at',{ascending:false}),sb.from('central_task_events').select('*').eq('task_id',t.id).order('created_at',{ascending:false}),sb.from('task_access_grants').select('*').eq('task_id',t.id).eq('status','active'),sb.from('task_record_links').select('*').eq('task_id',t.id)
   ]);return json({task:t,updates:updates||[],assignments:assignments||[],evidence:evidence||[],reviews:reviews||[],events:events||[],grants:grants||[],recordLinks:links||[]});
  }
  if(action==='create'){
   if(!isOwner)return json({error:'إنشاء التكليف متاح للمدير والوكيل فقط'},403);
   const assignedTo=isUuid(body.assignedTo)?String(body.assignedTo):null,assigneeEmail=String(body.assigneeEmail||'').trim().toLowerCase()||null;
   if(!assignedTo&&!assigneeEmail)return json({error:'يجب تحديد المستخدم المكلف'},400);
   if(assignedTo){const {data:u}=await sb.from('users').select('id,school_id,email,full_name,role,status').eq('id',assignedTo).eq('school_id',s.school_id).maybeSingle();if(!u)return json({error:'المستخدم المكلف غير مرتبط بالمدرسة'},409)}
   const row={school_id:s.school_id,module_key:safeKey(body.moduleKey||body.sourceOwner||'central_tasks'),record_type:body.recordType||body.assignmentType||null,record_id:body.recordId||null,title:String(body.title||'').trim().slice(0,300),description:String(body.description||'').trim()||null,assignment_type:['record','partial','additional_role'].includes(body.assignmentType)?body.assignmentType:'partial',source_owner:body.sourceOwner||null,record_key:body.recordKey||null,created_by:s.user_id,owner_role:s.role,owner_label:body.ownerLabel||null,assigned_to:assignedTo,assignee_email:assigneeEmail,assignee_name:body.assigneeName||null,assignee_role:body.assigneeRole||null,priority:['low','normal','high','urgent'].includes(body.priority)?body.priority:'normal',status:'active',start_date:body.startDate||null,due_date:body.dueDate||null,requires_approval:body.requiresApproval!==false,metadata:{...(body.metadata||{}),assignment_engine_version:'2.0.0',assignment_engine:'unified',created_via:'platform-tasks'}};
   if(!row.title)return json({error:'عنوان التكليف مطلوب'},400);
   const {data:t,error}=await sb.from('central_tasks').insert(row).select('*').single();if(error){console.error('[platform-tasks:create:insert]',requestId,error,row);throw error;}if(!t?.id)throw new Error('تعذر إنشاء معرف التكليف بعد الإدراج');
   await sb.from('central_task_assignments').insert({school_id:s.school_id,task_id:t.id,assigned_to:assignedTo,assignee_email:assigneeEmail,assignee_name:row.assignee_name,assignee_role:row.assignee_role,assigned_by:s.user_id,assignment_reason:'إنشاء التكليف',is_current:true});
   let delegatedRecords=Array.isArray(body.metadata?.delegatedRecords)?body.metadata.delegatedRecords.filter((r:any)=>r?.moduleKey&&r?.recordType):[];
   const sourceOwner=String(body.sourceOwner||'');
   // Server is authoritative: reconstruct exact group records from the central registry when needed.
   if(!delegatedRecords.length && String(body.metadata?.delegationScope||'')==='record_group' && body.metadata?.recordGroupKey){
    let gq=sb.from('platform_record_types').select('module_key,record_type,display_name,route_url,record_group_key,owner_section,is_active').eq('record_group_key',String(body.metadata.recordGroupKey)).eq('is_active',true);
    if(body.metadata?.ownerSection)gq=gq.eq('owner_section',String(body.metadata.ownerSection));
    const {data:groupRows,error:groupErr}=await gq;if(groupErr)throw groupErr;
    delegatedRecords=(groupRows||[]).map((r:any)=>({moduleKey:r.module_key,recordType:r.record_type,label:r.display_name,routeUrl:r.route_url}));
    if(delegatedRecords.length){const repairedMetadata={...(t.metadata||{}),delegatedRecords,delegation_repaired_at:now};const {error:metaErr}=await sb.from('central_tasks').update({metadata:repairedMetadata,updated_at:now}).eq('id',t.id);if(metaErr)throw metaErr;t.metadata=repairedMetadata;}
   }
   const ownerModuleAllowed=(m:string)=>sourceOwner==='manager'?m==='manager_records':sourceOwner==='agent'?m.startsWith('deputy_'):sourceOwner==='shared'?!m.startsWith('deputy_')&&m!=='manager_records':true;
   const requestedPairs=delegatedRecords.length?delegatedRecords.filter((r:any)=>r?.moduleKey&&r?.recordType).map((r:any)=>({moduleKey:safeKey(r.moduleKey),recordType:String(r.recordType)})):(body.recordType?[{moduleKey:row.module_key,recordType:String(body.recordType)}]:[]);
   for(const pair of requestedPairs){
    if(!ownerModuleAllowed(pair.moduleKey))return json({error:'نطاق السجل لا يطابق الجهة المالكة المحددة'},409);
    const {data:registered,error:regError}=await sb.from('platform_record_types').select('module_key,record_type,is_active').eq('module_key',pair.moduleKey).eq('record_type',pair.recordType).eq('is_active',true).maybeSingle();
    if(regError)throw regError;if(!registered)return json({error:`السجل غير مسجل في القاموس الموحد: ${pair.moduleKey}/${pair.recordType}`},409);
   }
   if(delegatedRecords.length){
    const links=delegatedRecords.filter((r:any)=>r&&r.moduleKey&&r.recordType).map((r:any)=>({school_id:s.school_id,task_id:t.id,module_key:safeKey(r.moduleKey),record_type:String(r.recordType),record_id:null,relation_type:'delegated_record',created_by:s.user_id}));
    if(links.length){const {error:linksError}=await sb.from('task_record_links').insert(links);if(linksError)throw linksError}
   }else if(body.recordKey||body.recordType){
    const {error:linkError}=await sb.from('task_record_links').insert({school_id:s.school_id,task_id:t.id,module_key:row.module_key,record_type:String(body.recordType||body.assignmentType||'record'),record_id:body.recordId||null,relation_type:'execution_source',created_by:s.user_id});if(linkError)throw linkError;
   }

   {
    // صلاحيات التنفيذ تُشتق من روابط السجلات نفسها، لذلك تعمل مع جميع ملاك السجلات دون استثناء.
    const {data:linkedForGrant,error:linkedGrantError}=await sb.from('task_record_links').select('module_key,record_type,record_id').eq('task_id',t.id);if(linkedGrantError)throw linkedGrantError;
    const grantConfig=body.grant||{};
    const baseGrant={school_id:s.school_id,task_id:t.id,user_id:assignedTo,user_email:assigneeEmail,can_view:true,can_create:grantConfig.canCreate!==false,can_update:grantConfig.canUpdate!==false,can_upload:grantConfig.canUpload!==false,can_submit:grantConfig.canSubmit!==false,can_approve:!!grantConfig.canApprove,can_delete:!!grantConfig.canDelete,starts_at:body.startDate||now,expires_at:grantConfig.expiresAt||null,status:'active',granted_by:s.user_id};
    const sources=(linkedForGrant||[]).length?(linkedForGrant||[]):[{module_key:safeKey(grantConfig.moduleKey||row.module_key),record_type:grantConfig.recordType||body.recordType||row.record_type||null,record_id:grantConfig.recordId||body.recordId||row.record_id||null}];
    const grantRows=uniqueGrantRows(sources.filter((r:any)=>r&&r.module_key).map((r:any)=>({...baseGrant,module_key:safeKey(r.module_key),record_type:r.record_type?String(r.record_type):null,record_id:r.record_id||null,permission_scope:'record'})));
    if(grantRows.length){const {error:grantError}=await sb.from('task_access_grants').insert(grantRows);if(grantError)throw grantError}
   }
   await event(t.id,'created','تم إنشاء التكليف',null,t);await notice(t.id,assignedTo,assigneeEmail,'assigned','تكليف جديد',`تم إسناد التكليف: ${t.title}`);return json({task:t},201);
  }
  const task=await getTask(String(body.taskId||''));if(!task)return json({error:'التكليف غير موجود'},404);
  if(action==='delete-task'){
   if(!isOwner)return json({error:'حذف التكليف متاح للمدير والوكيل فقط'},403);
   await revokeTaskAccess(task.id);
   const metadata={...(task.metadata||{}),deleted_by:s.user_id,deleted_at:now,delete_reason:body.reason||'حذف التكليف من مركز التكليفات'};
   const {error:de}=await sb.from('central_tasks').update({deleted_at:now,status:'archived',metadata,updated_at:now}).eq('id',task.id).eq('school_id',s.school_id);if(de)throw de;
   await event(task.id,'deleted',body.reason||'تم حذف التكليف وإنهاء التفويض',task,{deleted_at:now,deleted_by:s.user_id});
   await notice(task.id,task.assigned_to,task.assignee_email,'deleted','تم إنهاء التكليف',`تم حذف التكليف "${task.title}" من قائمة تكليفاتك. بقيت الأعمال التي نفذتها داخل السجلات محفوظة.`);
   return json({ok:true,taskId:task.id,deletedAt:now});
  }
  if(action==='reassign'){
   if(!isOwner)return json({error:'نقل التكليف متاح للمدير والوكيل فقط'},403);const to=isUuid(body.assignedTo)?String(body.assignedTo):null,email=String(body.assigneeEmail||'').trim().toLowerCase()||null;if(!to&&!email)return json({error:'المكلف الجديد مطلوب'},400);
   await sb.from('central_task_assignments').update({is_current:false,ended_at:now}).eq('task_id',task.id).eq('is_current',true);
   const next={assigned_to:to,assignee_email:email,assignee_name:body.assigneeName||null,assignee_role:body.assigneeRole||null,status:'transferred'};const {data,error}=await sb.from('central_tasks').update(next).eq('id',task.id).select('*').single();if(error)throw error;
   await sb.from('central_task_assignments').insert({school_id:s.school_id,task_id:task.id,assigned_from:task.assigned_to,assigned_to:to,assignee_email:email,assignee_name:next.assignee_name,assignee_role:next.assignee_role,assigned_by:s.user_id,assignment_reason:body.reason||'نقل التكليف',is_current:true});
   await sb.from('task_access_grants').update({status:'revoked'}).eq('task_id',task.id).eq('status','active');
   const {data:reassignLinks}=await sb.from('task_record_links').select('module_key,record_type,record_id').eq('task_id',task.id);
   const reassignGrantBase={school_id:s.school_id,task_id:task.id,user_id:to,user_email:email,can_view:true,can_create:true,can_update:true,can_upload:true,can_submit:true,can_approve:false,can_delete:false,granted_by:s.user_id,starts_at:now,expires_at:null,status:'active'};
   const reassignSources=(reassignLinks||[]).length?(reassignLinks||[]):[{module_key:task.module_key,record_type:task.record_type,record_id:task.record_id}];
   const reassignGrants=uniqueGrantRows(reassignSources.filter((r:any)=>r&&r.module_key).map((r:any)=>({...reassignGrantBase,module_key:r.module_key,record_type:r.record_type||null,record_id:r.record_id||null,permission_scope:'record'})));
   if(reassignGrants.length){const {error:rgError}=await sb.from('task_access_grants').insert(reassignGrants);if(rgError)throw rgError}
   await event(task.id,'reassigned',body.reason||'تم نقل التكليف',task,data);await notice(task.id,to,email,'assigned','تم نقل تكليف إليك',`أصبح التكليف "${task.title}" ضمن تكليفاتك.`);return json({task:data});
  }
  if(action==='transition'){
   const target=String(body.status||''),ownerOnly=new Set(['approved','returned','rejected','withdrawn','archived','closed']);if(ownerOnly.has(target)&&!isOwner)return json({error:'لا توجد صلاحية لتنفيذ هذا الإجراء'},403);if(!ownerOnly.has(target)&&!isOwner&&!mine(task))return json({error:'هذا التكليف غير مسند إليك'},403);
   const allowed:any={active:['in_progress','withdrawn','archived'],transferred:['in_progress','withdrawn','archived'],in_progress:['pending_approval','withdrawn','archived'],returned:['in_progress','pending_approval','withdrawn','archived'],pending_approval:['approved','returned','rejected'],approved:['archived','closed'],rejected:['archived'],withdrawn:['archived']};if(!(allowed[task.status]||[]).includes(target))return json({error:`انتقال الحالة غير مسموح: ${task.status} ← ${target}`},409);
   const changes:any={status:target};
   if(target==='pending_approval')changes.progress_percent=Math.max(Number(task.progress_percent||0),90);
   if(target==='approved')changes.progress_percent=100;
   if(['closed','archived'].includes(target))changes.closed_at=now;
   const {data,error}=await sb.from('central_tasks').update(changes).eq('id',task.id).select('*').single();if(error)throw error;
   // بمجرد إنهاء/إيقاف التكليف تنتهي صلاحية السجلات فوراً، بينما returned يبقيها للتصحيح.
   if(terminalStatuses.has(target))await revokeTaskAccess(task.id);
   if(['approved','returned','rejected'].includes(target))await sb.from('central_task_reviews').insert({school_id:s.school_id,task_id:task.id,reviewer_id:s.user_id,decision:target==='returned'?'returned_for_correction':target,review_notes:body.note||null});
   await event(task.id,target,body.note||'',task,data);const recipient=ownerOnly.has(target)?task.assigned_to:task.created_by;await notice(task.id,recipient,ownerOnly.has(target)?task.assignee_email:null,target,'تحديث على التكليف',`تم تحديث حالة التكليف "${task.title}" إلى ${target}`);return json({task:data});
  }
  if(action==='add-update'){
   if(!isOwner&&!mine(task))return json({error:'هذا التكليف غير مسند إليك'},403);const progress=body.progressPercent==null?null:Math.max(0,Math.min(100,Number(body.progressPercent)));
   const {data:u,error}=await sb.from('central_task_updates').insert({school_id:s.school_id,task_id:task.id,user_id:s.user_id,update_type:body.updateType||'execution',title:body.title||null,notes:body.notes||null,link_url:body.linkUrl||null,progress_percent:progress,status:body.status||'draft',metadata:body.metadata||{}}).select('*').single();if(error)throw error;
   const changes:any={status:task.status==='active'||task.status==='transferred'||task.status==='returned'?'in_progress':task.status};if(progress!=null)changes.progress_percent=progress;await sb.from('central_tasks').update(changes).eq('id',task.id);await event(task.id,'updated',body.title||body.notes||'تحديث تنفيذ',null,u);return json({update:u});
  }
  if(action==='attach-evidence'){
   if(!isOwner&&!mine(task))return json({error:'لا توجد صلاحية'},403);const fileId=String(body.platformFileId||'');const {data:file}=await sb.from('platform_files').select('*').eq('id',fileId).eq('school_id',s.school_id).maybeSingle();if(!file)return json({error:'الملف غير موجود'},404);
   const {data,error}=await sb.from('central_task_evidence').upsert({school_id:s.school_id,task_id:task.id,update_id:isUuid(body.updateId)?body.updateId:null,platform_file_id:fileId,uploaded_by:s.user_id,evidence_type:body.evidenceType||'execution',status:'active'},{onConflict:'task_id,platform_file_id'}).select('*').single();if(error)throw error;
   await sb.from('platform_file_links').upsert({school_id:s.school_id,file_id:fileId,module_key:'central_tasks',record_type:'central_task',record_id:task.id,relation_type:'evidence',linked_by:s.user_id,is_primary:false},{onConflict:'school_id,file_id,module_key,record_type,record_id,relation_type'});await event(task.id,'evidence_uploaded','تم إرفاق شاهد',null,{platform_file_id:fileId});return json({evidence:data});
  }
  if(action==='linked-records'){
   if(!canRead(task))return json({error:'لا توجد صلاحية'},403);const {data,error}=await sb.from('task_record_links').select('*').eq('task_id',task.id);if(error)throw error;const {data:grants}=await sb.from('task_access_grants').select('*').eq('task_id',task.id).eq('status','active');return json({records:data||[],grants:grants||[]});
  }
  if(action==='dashboard-summary'){
   let q=sb.from('central_tasks').select('status,progress_percent,due_date,assignee_role,module_key').eq('school_id',s.school_id).is('deleted_at',null);if(!isOwner)q=q.or(`assigned_to.eq.${s.user_id},created_by.eq.${s.user_id}`);const {data,error}=await q;if(error)throw error;const rows=data||[],today=new Date().toISOString().slice(0,10);return json({summary:{total:rows.length,active:rows.filter((x:any)=>['active','in_progress','transferred','returned'].includes(x.status)).length,pending:rows.filter((x:any)=>x.status==='pending_approval').length,approved:rows.filter((x:any)=>x.status==='approved').length,overdue:rows.filter((x:any)=>x.due_date&&x.due_date<today&&!['approved','archived','closed','withdrawn','rejected','canceled'].includes(x.status)).length,averageProgress:rows.length?Math.round(rows.reduce((a:any,x:any)=>a+Number(x.progress_percent||0),0)/rows.length):0}});
  }
  return json({error:'عملية غير مدعومة'},400);
 }catch(e){console.error('[platform-tasks]',requestId,e);return json({error:e instanceof Error?e.message:String(e),code:'TASKS_FATAL_ERROR',requestId},500)}
});
