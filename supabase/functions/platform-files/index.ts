import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session, x-client-version','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const safeExt=(name:string)=>{const x=(name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');return x||'bin'};
const safeKey=(v:unknown,fallback='general')=>String(v||fallback).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)||fallback;
const managers=new Set(['manager','owner','school_manager','principal','leadership','admin','مدير','مديرة','مدير المدرسة','مديرة المدرسة']);
const MAX_FILE_SIZE=50*1024*1024;
const allowedMimePrefixes=['image/','text/'];
const allowedMimeTypes=new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','application/octet-stream']);
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
const maxSigned=3600;
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const supabaseUrl=Deno.env.get('SUPABASE_URL'),serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!supabaseUrl||!serviceRole)return json({error:'إعدادات محرك الملفات غير مكتملة',code:'FILES_ENV_MISSING'},500);
 const sb=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
 const requestId=crypto.randomUUID();
 try{
  const raw=req.headers.get('x-platform-session')||'';if(!raw)return json({error:'جلسة الملفات مفقودة'},401);
  const hash=await sha256(raw), now=new Date().toISOString();
  const sessionLookup=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();
  if(sessionLookup.error){console.error('[platform-files]',requestId,'session_lookup_failed',sessionLookup.error);return json({error:'تعذر التحقق من جلسة الملفات',code:'SESSION_LOOKUP_FAILED',requestId},500)}
  const s=sessionLookup.data;
  if(!s)return json({error:'انتهت جلسة الملفات',code:'SESSION_EXPIRED',requestId},401);
  await sb.from('platform_sessions').update({last_seen_at:now}).eq('id',s.id);
  const action=new URL(req.url).searchParams.get('action')||'';
  const isManager=managers.has(String(s.role||'').toLowerCase())||managers.has(String(s.role||''));
  const body=req.method==='GET'?{}:await req.clone().json().catch(()=>({}));
  const historicalPrivateLibraryModules=['section_records_repository','administrative_employee_library','vice_principal_library','manager_records_archive'];
  const isPrivateLibraryModule=(mk:unknown)=>{const x=String(mk||'');return x.startsWith('section_library_')||historicalPrivateLibraryModules.includes(x)};
  const isPrivateSectionLibrary=(row:any)=>isPrivateLibraryModule(row?.module_key);
  const canRead=(row:any)=>row&&row.school_id===s.school_id&&(row.ownership_scope==='school'||row.owner_user_id===s.user_id||(isManager&&!isPrivateSectionLibrary(row)));
  const canReadFile=async(row:any)=>{if(canRead(row))return true;if(!row||row.school_id!==s.school_id)return false;const {data:links}=await sb.from('platform_file_links').select('record_id').eq('school_id',s.school_id).eq('file_id',row.id).eq('module_key','internal_messages').eq('record_type','internal_message').eq('relation_type','attachment');const mids=(links||[]).map((x:any)=>x.record_id).filter(isUuid);if(!mids.length)return false;let q=sb.from('internal_message_recipients').select('id').eq('school_id',s.school_id).in('message_id',mids);if(isUuid(s.user_id))q=q.eq('recipient_user_id',s.user_id);else if(s.user_email)q=q.eq('recipient_email',String(s.user_email).trim().toLowerCase());else return false;const {data:r}=await q.limit(1);return !!(r&&r.length)};
  const canManage=(row:any)=>row&&row.school_id===s.school_id&&(row.ownership_scope==='school'?isManager:(row.owner_user_id===s.user_id||(isManager&&!isPrivateSectionLibrary(row))));
  const event=async(type:string,file:any,extra:any={})=>{await sb.from('platform_file_events').insert({school_id:s.school_id,file_id:file?.id||null,folder_id:extra.folder_id||file?.folder_id||null,user_id:s.user_id,event_type:type,module_key:file?.module_key||extra.module_key||null,old_values:extra.old_values||null,new_values:extra.new_values||null})};
  const getFile=async(id:string)=>{const {data}=await sb.from('platform_files').select('*').eq('id',id).eq('school_id',s.school_id).maybeSingle();return data};
  const getFolder=async(id:string)=>{const {data}=await sb.from('platform_folders').select('*').eq('id',id).eq('school_id',s.school_id).maybeSingle();return data};
  if(action==='health')return json({ok:true,version:'3.5.0-RL29-expanded-section-library-recovery',schoolId:s.school_id,userId:s.user_id,role:s.role});
  if(action==='recover-section-library'){
   const allowedRoles=new Set(['manager','agent','teacher','student_advisor','health_advisor','activity_leader','kindergarten_teacher','administrative_employee','section']);
   const targetRole=safeKey(body.targetRole||'section');
   if(!allowedRoles.has(targetRole))return json({error:'دور مكتبة القسم غير صالح',code:'SECTION_LIBRARY_ROLE_INVALID',requestId},400);
   const targetModule=targetRole==='manager'?'manager_records_archive':`section_library_${targetRole}`;
   const requestedModule=safeKey(body.targetModule||targetModule);
   if(requestedModule!==targetModule)return json({error:'مسار مكتبة القسم لا يطابق الدور الحالي',code:'SECTION_LIBRARY_MODULE_MISMATCH',requestId},400);

   // RL29: المسارات التي استُخدمت فعلياً تاريخياً لمكتبات الأقسام في المدارس المستقلة.
   // لا يتم اعتبار أي module عام آخر مكتبة خاصة حتى لا ننقل ملفات سجلات/تكليفات إلى المكتبة بالخطأ.
   const recoveryModules=Array.from(new Set([targetModule,...historicalPrivateLibraryModules]));
   const roleAliases:Record<string,string[]>= {
    manager:['manager','principal','school_manager','owner','leadership','admin'],agent:['agent','vice_principal'],teacher:['teacher'],student_advisor:['student_advisor'],
    health_advisor:['health_advisor'],activity_leader:['activity_leader'],kindergarten_teacher:['kindergarten_teacher'],administrative_employee:['administrative_employee','admin_employee'],section:['section']
   };
   const sessionRole=String(s.role||'').trim().toLowerCase();
   const sessionRoleMatches=(roleAliases[targetRole]||[]).includes(sessionRole);
   const candidatesQuery=await sb.from('platform_files').select('*').eq('school_id',s.school_id).neq('status','deleted').in('module_key',recoveryModules);
   if(candidatesQuery.error)throw candidatesQuery.error;
   const rows=candidatesQuery.data||[];
   let recovered=0,alreadyCurrent=0,unresolved=0,skippedOwnership=0,skippedRole=0,linksReconciled=0;
   const recoveredIds:string[]=[], unresolvedIds:string[]=[];

   const roleFromRow=(f:any)=>{
    const module=String(f?.module_key||'').trim();
    // المسار التاريخي نفسه قرينة قوية لأنه كان مخصصاً لدور واحد فقط.
    if(module==='administrative_employee_library')return 'administrative_employee';
    if(module==='vice_principal_library')return 'agent';
    if(module==='manager_records_archive')return 'manager';
    if(module.startsWith('section_library_')){
      const r=module.slice('section_library_'.length);
      return allowedRoles.has(r)?r:'';
    }
    const md=f?.metadata&&typeof f.metadata==='object'?f.metadata:{};
    const explicit=String(md.libraryRole||md.role||'').trim().toLowerCase();
    if(allowedRoles.has(explicit)&&explicit!=='section')return explicit;
    const rt=String(f?.primary_record_type||'').trim().toLowerCase();
    if(rt==='agent_library'||rt==='vice_principal_library')return 'agent';
    if(rt==='teacher_library')return explicit==='kindergarten_teacher'?'kindergarten_teacher':'teacher';
    if(rt==='student_advisor_library')return 'student_advisor';
    if(rt==='administrative_employee_library'||rt==='admin_employee_library'||rt==='library'&&module==='administrative_employee_library')return 'administrative_employee';
    if(rt==='manager_library'||rt==='pdf_archive')return 'manager';
    if(rt==='section_library'&&['health_advisor','activity_leader'].includes(explicit))return explicit;
    // السجل القديم العام section_library لا يُحسم إلا إذا كان targetRole يطابق دور الجلسة
    // أو كانت metadata نفسها تحمل الدور؛ هذا يمنع خلط الصحة والنشاط لمستخدم متعدد الأدوار.
    if(rt==='section_library'&&explicit==='section'&&sessionRoleMatches&&['health_advisor','activity_leader','section'].includes(targetRole))return targetRole;
    return '';
   };
   const pathOwner=(path:string)=>{const m=String(path||'').match(new RegExp('^schools/'+String(s.school_id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/users/([0-9a-f-]{36})/','i'));return m?m[1]:''};
   const reconcileLinks=async(fileId:string,oldModule:string)=>{
    // نحدّث فقط روابط المكتبة القديمة لهذا الملف، ولا نمس روابطه في الرسائل/الشواهد/السجلات الأخرى.
    const q=await sb.from('platform_file_links').select('*').eq('school_id',s.school_id).eq('file_id',fileId).in('module_key',recoveryModules);
    if(q.error)throw q.error;
    const libraryLinks=q.data||[];
    let currentLink=libraryLinks.find((x:any)=>String(x.module_key)===targetModule&&String(x.record_type)==='library_file'&&String(x.record_id)===targetRole);
    if(currentLink&&currentLink.deleted_at){
      const restored=await sb.from('platform_file_links').update({deleted_at:null,linked_by:s.user_id,is_primary:true,relation_type:'library_file'}).eq('id',currentLink.id).eq('school_id',s.school_id).select('*').single();
      if(restored.error)throw restored.error;
      currentLink=restored.data;linksReconciled++;
    }
    if(!currentLink){
      const ins=await sb.from('platform_file_links').insert({school_id:s.school_id,file_id:fileId,module_key:targetModule,record_type:'library_file',record_id:targetRole,relation_type:'library_file',linked_by:s.user_id,is_primary:true}).select('*').single();
      if(ins.error)throw ins.error;
      currentLink=ins.data;linksReconciled++;
    }
    for(const l of libraryLinks){
      if(currentLink&&String(l.id)===String(currentLink.id))continue;
      if(l.deleted_at)continue;
      const upd=await sb.from('platform_file_links').update({deleted_at:now}).eq('id',l.id).eq('school_id',s.school_id);
      if(upd.error)throw upd.error;
      linksReconciled++;
    }
   };

   for(const f of rows){
    if(!f||!isPrivateLibraryModule(f.module_key))continue;
    const owner=String(f.owner_user_id||'');const uploader=String(f.uploaded_by||'');const pOwner=pathOwner(String(f.storage_path||''));
    // المالك الفعلي هو الدليل الأقوى. uploader وstorage path يجب ألا يناقضاه إن وُجدا.
    const evidence=[owner,uploader,pOwner].filter(Boolean);
    if(evidence.some(x=>x!==String(s.user_id))){skippedOwnership++;continue}
    if(!evidence.length||!evidence.includes(String(s.user_id))){skippedOwnership++;continue}

    const derived=roleFromRow(f);
    if(derived!==targetRole){
      if(!derived&&String(f.owner_user_id||'')===String(s.user_id)){unresolved++;unresolvedIds.push(String(f.id))}
      else skippedRole++;
      continue;
    }

    const isCurrent=String(f.module_key)===targetModule&&String(f.owner_user_id||'')===String(s.user_id)&&String(f.ownership_scope||'')==='user'&&
      (targetRole==='manager'||(String(f.primary_record_type||'')==='library_file'&&String(f.primary_record_id||'')===targetRole));
    if(isCurrent){
      alreadyCurrent++;
      await reconcileLinks(String(f.id),String(f.module_key||''));
      continue;
    }

    const oldMeta=f.metadata&&typeof f.metadata==='object'?f.metadata:{};
    const newMeta={...oldMeta,libraryRole:targetRole,role:targetRole,libraryOwnerUserId:String(s.user_id),recoveredFromModule:String(f.module_key||''),recoveredAt:now,recoveryVersion:'RL29-expanded'};
    const update:any={ownership_scope:'user',owner_user_id:s.user_id,visibility:'private',module_key:targetModule,metadata:newMeta,updated_at:now};
    if(targetRole!=='manager'){update.primary_record_type='library_file';update.primary_record_id=targetRole}
    const u=await sb.from('platform_files').update(update).eq('id',f.id).eq('school_id',s.school_id).select('*').single();
    if(u.error)throw u.error;
    await reconcileLinks(String(f.id),String(f.module_key||''));
    recovered++;recoveredIds.push(String(f.id));
    await event('section_library_recovered',u.data,{old_values:{module_key:f.module_key,ownership_scope:f.ownership_scope,owner_user_id:f.owner_user_id,primary_record_type:f.primary_record_type,primary_record_id:f.primary_record_id},new_values:{module_key:targetModule,ownership_scope:'user',owner_user_id:s.user_id,target_role:targetRole,recovery_version:'RL29-expanded'}});
   }
   return json({ok:true,version:'RL29-expanded',targetRole,targetModule,recoveryModules,recovered,alreadyCurrent,unresolved,skippedOwnership,skippedRole,linksReconciled,recoveredIds,unresolvedIds});
  }
  if(action==='upload'){
   const form=await req.formData(), file=form.get('file') as File;if(!file)return json({error:'لم يتم اختيار ملف'},400);
   if(file.size>MAX_FILE_SIZE)return json({error:'حجم الملف يتجاوز الحد المسموح (50 ميجابايت)',code:'FILE_TOO_LARGE',requestId},413);
   const mime=file.type||'application/octet-stream';if(!allowedMimeTypes.has(mime)&&!allowedMimePrefixes.some(x=>mime.startsWith(x)))return json({error:'نوع الملف غير مسموح',code:'FILE_TYPE_NOT_ALLOWED',requestId},415);
   let scope=String(form.get('ownershipScope')||'user')==='school'?'school':'user';
   const moduleKey=safeKey(form.get('moduleKey')), folderId=String(form.get('folderId')||'')||null, recordType=String(form.get('recordType')||'')||null, recordId=String(form.get('recordId')||'')||null;
   if(isPrivateLibraryModule(moduleKey))scope='user';
   const relationType=String(form.get('relationType')||'attachment'), replaceFileId=String(form.get('replaceFileId')||'')||null;
   let metadata:any={};try{metadata=JSON.parse(String(form.get('metadata')||'{}'))}catch(_){metadata={}}
   // شواهد الجاهزية ملفات مدرسية مشتركة، لكن المكلف يحتاج الرفع حتى لو لم يكن مديراً.
   // السماح هنا مقيد بتكليف جاهزية فعلي في نفس المدرسة ومنحة رفع نشطة للمستخدم.
   let readinessEvidenceAuthorized=false;
   let readinessPlanId='';
   if(moduleKey==='school_readiness'&&relationType==='evidence'){
    readinessPlanId=isUuid(metadata.readinessPlanId)?String(metadata.readinessPlanId):(recordType==='readiness_plan'&&isUuid(recordId)?recordId:'');
    if(isManager)readinessEvidenceAuthorized=true;
    else if(recordType==='readiness_task'&&isUuid(recordId)){
     const {data:grant}=await sb.from('task_access_grants').select('id').eq('school_id',s.school_id).eq('task_id',recordId).eq('user_id',s.user_id).eq('status','active').eq('can_upload',true).limit(1).maybeSingle();
     if(grant)readinessEvidenceAuthorized=true;
     else{
      const {data:task}=await sb.from('central_tasks').select('id,assigned_to,module_key,status').eq('id',recordId).eq('school_id',s.school_id).maybeSingle();
      readinessEvidenceAuthorized=!!task&&String(task.assigned_to||'')===String(s.user_id)&&String(task.module_key||'')==='school_readiness'&&!['archived','withdrawn','canceled'].includes(String(task.status||''));
     }
    }
   }
   if(scope==='school'&&!isManager&&!readinessEvidenceAuthorized)return json({error:'لا توجد صلاحية لرفع ملف مدرسي مشترك',code:'SCHOOL_UPLOAD_FORBIDDEN',requestId},403);
   if(folderId){const folder=await getFolder(folderId);if(!folder||!canManage(folder)||folder.module_key!==moduleKey||folder.status!=='active')return json({error:'المجلد غير صالح أو لا توجد صلاحية'},403)}
   let replaced:any=null;if(replaceFileId){replaced=await getFile(replaceFileId);if(!replaced||!canManage(replaced))return json({error:'الملف المراد استبداله غير صالح'},403)}
   const id=crypto.randomUUID(),ext=safeExt(file.name),slot=folderId||recordId||'root',root=scope==='school'?'shared':`users/${s.user_id}`,path=`schools/${s.school_id}/${root}/${moduleKey}/${slot}/${id}.${ext}`;
   const up=await sb.storage.from('school-platform-files').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(up.error)throw up.error;
   const {data:row,error}=await sb.from('platform_files').insert({id,school_id:s.school_id,ownership_scope:scope,owner_user_id:scope==='user'?s.user_id:null,uploaded_by:s.user_id,module_key:moduleKey,folder_id:folderId,primary_record_type:recordType,primary_record_id:recordId,storage_path:path,original_name:file.name,display_name:String(form.get('displayName')||file.name).slice(0,255),stored_name:`${id}.${ext}`,extension:ext,mime_type:file.type||'application/octet-stream',file_size:file.size,visibility:scope==='school'?'school':'private',version_number:replaced?(Number(replaced.version_number)||1)+1:1,replaced_file_id:replaced?.id||null,metadata}).select('*').single();
   if(error){await sb.storage.from('school-platform-files').remove([path]);throw error}
   if(recordType&&recordId){const {error:le}=await sb.from('platform_file_links').insert({school_id:s.school_id,file_id:id,module_key:moduleKey,record_type:recordType,record_id:recordId,relation_type:relationType,linked_by:s.user_id,is_primary:true});if(le&&!String(le.message).includes('duplicate')){await sb.storage.from('school-platform-files').remove([path]);await sb.from('platform_files').delete().eq('id',id);throw le}}
   let evidence:any=null;
   if(moduleKey==='school_readiness'&&relationType==='evidence'&&recordId){
    if(!isUuid(readinessPlanId)){await sb.storage.from('school-platform-files').remove([path]);await sb.from('platform_file_links').delete().eq('file_id',id);await sb.from('platform_files').delete().eq('id',id);return json({error:'لم يتم تحديد خطة جاهزية سحابية صالحة للشاهد',code:'READINESS_PLAN_REQUIRED',requestId},409)}
    const taskKey=String(metadata.taskKey||metadata.readinessTaskKey||'').trim();
    const sectionKey=String(metadata.sectionKey||metadata.sectionId||'').trim()||null;
    if(taskKey){
     const evidenceInsert=await sb.from('school_readiness_evidence').insert({
      school_id:s.school_id,
      plan_id:readinessPlanId,
      task_key:taskKey,
      section_key:sectionKey,
      stage_key:metadata.stageKey!=null?String(metadata.stageKey):(metadata.phase!=null?String(metadata.phase):null),
      file_name:file.name,
      file_path:path,
      file_type:file.type||'application/octet-stream',
      file_size:file.size,
      description:metadata.description?String(metadata.description):null,
      uploaded_by:s.user_id,
      platform_file_id:id,
      status:'active'
     }).select('*').single();
     if(evidenceInsert.error){
      await sb.storage.from('school-platform-files').remove([path]);
      await sb.from('platform_files').delete().eq('id',id);
      throw evidenceInsert.error;
     }
     evidence=evidenceInsert.data;
    }
   }
   if(replaced){await sb.from('platform_files').update({status:'archived',updated_at:now}).eq('id',replaced.id);await event('replaced',replaced,{new_values:{replacement_file_id:id}})}
   await event('uploaded',row,{new_values:{path,name:file.name,size:file.size,evidence_id:evidence?.id||null}});return json({file:row,evidence});
  }
  if(action==='list'){
   let q=sb.from('platform_files').select('*').eq('school_id',s.school_id).order('created_at',{ascending:false}).limit(Math.min(Number(body.limit)||500,1000));
   q=body.includeTrashed?q.eq('status','trashed'):q.eq('status','active').is('deleted_at',null);
   if(body.moduleKey)q=q.eq('module_key',safeKey(body.moduleKey));if(Object.prototype.hasOwnProperty.call(body,'folderId'))q=body.folderId?q.eq('folder_id',body.folderId):q.is('folder_id',null);
   if(body.ownershipScope==='user')q=q.eq('owner_user_id',s.user_id);else if(body.ownershipScope==='school')q=q.eq('ownership_scope','school');else if(!isManager)q=q.or(`ownership_scope.eq.school,owner_user_id.eq.${s.user_id}`);
   if(body.recordType)q=q.eq('primary_record_type',body.recordType);if(body.recordId)q=q.eq('primary_record_id',body.recordId);if(body.search)q=q.ilike('display_name',`%${String(body.search).slice(0,100)}%`);
   const {data,error}=await q;if(error)throw error;const visible=(data||[]).filter((x:any)=>!isPrivateSectionLibrary(x)||String(x.owner_user_id||'')===String(s.user_id));return json({files:visible});
  }
  if(action==='list-by-link'){
   let q=sb.from('platform_file_links').select('id,relation_type,is_primary,created_at,platform_files(*)').eq('school_id',s.school_id).is('deleted_at',null).eq('module_key',safeKey(body.moduleKey)).eq('record_type',body.recordType).eq('record_id',body.recordId).order('created_at',{ascending:false});
   const {data,error}=await q;if(error)throw error;const rows=(data||[]).filter((x:any)=>x.platform_files?.status==='active'&&canRead(x.platform_files));return json({links:rows});
  }
  if(action==='list-folders'){
   let q=sb.from('platform_folders').select('*').eq('school_id',s.school_id).eq('module_key',safeKey(body.moduleKey)).order('sort_order').order('folder_name');
   q=body.includeTrashed?q.eq('status','trashed'):q.eq('status','active').is('deleted_at',null);if(isPrivateLibraryModule(body.moduleKey))q=q.eq('owner_user_id',s.user_id);else if(body.ownershipScope==='user')q=q.eq('owner_user_id',s.user_id);else if(body.ownershipScope==='school')q=q.eq('ownership_scope','school');else if(!isManager)q=q.or(`ownership_scope.eq.school,owner_user_id.eq.${s.user_id}`);if(!body.all)q=body.parentFolderId?q.eq('parent_folder_id',body.parentFolderId):q.is('parent_folder_id',null);
   const {data,error}=await q;if(error)throw error;return json({folders:data||[]});
  }
  if(action==='create-folder'){
   const name=String(body.folderName||'').trim().slice(0,160);if(!name)return json({error:'اسم المجلد مطلوب'},400);const moduleKey=safeKey(body.moduleKey);const scope=isPrivateLibraryModule(moduleKey)?'user':(body.ownershipScope==='school'?'school':'user');if(scope==='school'&&!isManager)return json({error:'إنشاء المجلد المدرسي يتطلب صلاحية المدير'},403);
   if(body.parentFolderId){const p=await getFolder(body.parentFolderId);if(!p||!canManage(p)||p.module_key!==moduleKey)return json({error:'المجلد الأب غير صالح'},403)}
   const {data,error}=await sb.from('platform_folders').insert({school_id:s.school_id,ownership_scope:scope,owner_user_id:scope==='user'?s.user_id:null,module_key:moduleKey,parent_folder_id:body.parentFolderId||null,folder_name:name,created_by:s.user_id}).select('*').single();if(error)throw error;await event('folder_created',null,{folder_id:data.id,module_key:data.module_key,new_values:data});return json({folder:data});
  }
  if(['rename-folder','trash-folder','restore-folder'].includes(action)){
   const folder=await getFolder(body.folderId);if(!folder)return json({error:'المجلد غير موجود'},404);if(!canManage(folder))return json({error:'لا توجد صلاحية'},403);
   if(action==='rename-folder'){const name=String(body.folderName||'').trim().slice(0,160);if(!name)return json({error:'اسم المجلد مطلوب'},400);const {data,error}=await sb.from('platform_folders').update({folder_name:name}).eq('id',folder.id).select('*').single();if(error)throw error;await event('folder_renamed',null,{folder_id:folder.id,module_key:folder.module_key,old_values:{folder_name:folder.folder_name},new_values:{folder_name:name}});return json({folder:data})}
   if(action==='restore-folder'){const {data,error}=await sb.from('platform_folders').update({status:'active',deleted_at:null}).eq('id',folder.id).select('*').single();if(error)throw error;await event('folder_restored',null,{folder_id:folder.id,module_key:folder.module_key});return json({folder:data})}
   const [{count:files},{count:children}]=await Promise.all([sb.from('platform_files').select('*',{count:'exact',head:true}).eq('folder_id',folder.id).eq('status','active'),sb.from('platform_folders').select('*',{count:'exact',head:true}).eq('parent_folder_id',folder.id).eq('status','active')]);
   if(((files||0)>0||(children||0)>0)&&!body.recursive)return json({error:'لا يمكن حذف مجلد غير فارغ دون اختيار الحذف المتداخل'},409);
   if(body.recursive){await sb.rpc('platform_trash_folder_tree',{p_folder_id:folder.id,p_user_id:s.user_id})}else await sb.from('platform_folders').update({status:'trashed',deleted_at:now}).eq('id',folder.id);
   await event('folder_trashed',null,{folder_id:folder.id,module_key:folder.module_key});return json({ok:true});
  }
  if(['signed-url','trash','restore','purge','rename-file','move-file','usage'].includes(action)){
   const file=await getFile(body.fileId);if(!file)return json({error:'الملف غير موجود'},404);if(action==='signed-url'){if(!(await canReadFile(file)))return json({error:'لا توجد صلاحية'},403);if(file.status!=='active')return json({error:'الملف غير متاح للمعاينة'},409);const expires=Math.max(60,Math.min(Number(body.expiresIn)||300,maxSigned));const {data,error}=await sb.storage.from(file.bucket_name).createSignedUrl(file.storage_path,expires);if(error)throw error;await event('viewed',file);return json({signedUrl:data.signedUrl,expiresIn:expires})}
   if(!canManage(file))return json({error:'لا توجد صلاحية'},403);
   if(action==='trash'){await sb.from('platform_files').update({status:'trashed',deleted_at:now}).eq('id',file.id);if(file.module_key==='school_readiness')await sb.from('school_readiness_evidence').update({status:'trashed',deleted_at:now}).eq('platform_file_id',file.id);await event('trashed',file);return json({ok:true})}
   if(action==='restore'){await sb.from('platform_files').update({status:'active',deleted_at:null}).eq('id',file.id);if(file.module_key==='school_readiness')await sb.from('school_readiness_evidence').update({status:'active',deleted_at:null}).eq('platform_file_id',file.id);await event('restored',file);return json({ok:true})}
   if(action==='purge'){if(file.status!=='trashed')return json({error:'انقل الملف إلى سلة المحذوفات أولًا'},409);const rm=await sb.storage.from(file.bucket_name).remove([file.storage_path]);if(rm.error)throw rm.error;if(file.module_key==='school_readiness')await sb.from('school_readiness_evidence').delete().eq('platform_file_id',file.id);await sb.from('platform_files').update({status:'deleted',deleted_at:now}).eq('id',file.id);await event('deleted',file);return json({ok:true})}
   if(action==='rename-file'){const name=String(body.displayName||'').trim().slice(0,255);if(!name)return json({error:'اسم الملف مطلوب'},400);const {data,error}=await sb.from('platform_files').update({display_name:name}).eq('id',file.id).select('*').single();if(error)throw error;await event('renamed',file,{old_values:{display_name:file.display_name},new_values:{display_name:name}});return json({file:data})}
   if(action==='move-file'){if(body.folderId){const folder=await getFolder(body.folderId);if(!folder||!canManage(folder)||folder.module_key!==file.module_key||folder.status!=='active')return json({error:'المجلد الهدف غير صالح'},403)}const {data,error}=await sb.from('platform_files').update({folder_id:body.folderId||null}).eq('id',file.id).select('*').single();if(error)throw error;await event('moved',file,{old_values:{folder_id:file.folder_id},new_values:{folder_id:body.folderId||null}});return json({file:data})}
   const {data:links,error}=await sb.from('platform_file_links').select('*').eq('file_id',file.id).is('deleted_at',null).order('created_at');if(error)throw error;return json({file,links:links||[]});
  }
  if(action==='link'){
   const file=await getFile(body.fileId);if(!file)return json({error:'الملف غير موجود'},404);
   const moduleKey=safeKey(body.moduleKey),recordType=String(body.recordType||''),recordId=String(body.recordId||''),relationType=String(body.relationType||'attachment');
   const metadata=body.metadata&&typeof body.metadata==='object'?body.metadata:{};
   let readinessAuthorized=false,readinessPlanId='';
   if(moduleKey==='school_readiness'&&relationType==='evidence'){
    readinessPlanId=isUuid(metadata.readinessPlanId)?String(metadata.readinessPlanId):(recordType==='readiness_plan'&&isUuid(recordId)?recordId:'');
    if(isManager)readinessAuthorized=true;
    else if(recordType==='readiness_task'&&isUuid(recordId)){
     const {data:grant}=await sb.from('task_access_grants').select('id').eq('school_id',s.school_id).eq('task_id',recordId).eq('user_id',s.user_id).eq('status','active').eq('can_upload',true).limit(1).maybeSingle();
     readinessAuthorized=!!grant;
    }
    if(!readinessAuthorized)return json({error:'لا توجد صلاحية لربط شاهد الجاهزية',code:'READINESS_LINK_FORBIDDEN',requestId},403);
    if(!isUuid(readinessPlanId))return json({error:'لم يتم تحديد خطة جاهزية سحابية صالحة للشاهد',code:'READINESS_PLAN_REQUIRED',requestId},409);
   }else if(!canManage(file))return json({error:'لا توجد صلاحية'},403);
   if(moduleKey==='school_readiness'&&relationType==='evidence'&&!canRead(file))return json({error:'الملف غير متاح لهذه المدرسة',code:'READINESS_FILE_FORBIDDEN',requestId},403);
   const key={school_id:s.school_id,file_id:file.id,module_key:moduleKey,record_type:recordType,record_id:recordId,relation_type:relationType};const {data:existing}=await sb.from('platform_file_links').select('*').match(key).maybeSingle();let data:any,error:any;if(existing){({data,error}=await sb.from('platform_file_links').update({deleted_at:null,linked_by:s.user_id,is_primary:!!body.isPrimary}).eq('id',existing.id).select('*').single())}else{({data,error}=await sb.from('platform_file_links').insert({...key,linked_by:s.user_id,is_primary:!!body.isPrimary}).select('*').single())}if(error)throw error;
   let evidence:any=null;
   if(moduleKey==='school_readiness'&&relationType==='evidence'){
    const taskKey=String(metadata.taskKey||metadata.readinessTaskKey||'').trim();
    if(taskKey){
     const {data:existingEvidence}=await sb.from('school_readiness_evidence').select('*').eq('school_id',s.school_id).eq('plan_id',readinessPlanId).eq('task_key',taskKey).eq('platform_file_id',file.id).maybeSingle();
     if(existingEvidence){evidence=existingEvidence}else{
      const ins=await sb.from('school_readiness_evidence').insert({school_id:s.school_id,plan_id:readinessPlanId,task_key:taskKey,section_key:String(metadata.sectionKey||metadata.sectionId||'').trim()||null,stage_key:metadata.stageKey!=null?String(metadata.stageKey):(metadata.phase!=null?String(metadata.phase):null),file_name:file.display_name||file.original_name||'شاهد',file_path:file.storage_path,file_type:file.mime_type||'application/octet-stream',file_size:Number(file.file_size||0),description:metadata.description?String(metadata.description):null,uploaded_by:s.user_id,platform_file_id:file.id,status:'active'}).select('*').single();
      if(ins.error){await sb.from('platform_file_links').update({deleted_at:now}).eq('id',data.id);throw ins.error}evidence=ins.data;
     }
    }
   }
   await event('linked',file,{new_values:{...data,evidence_id:evidence?.id||null}});return json({link:data,evidence});
  }
  if(action==='unlink'){
   const {data:link}=await sb.from('platform_file_links').select('*,platform_files(*)').eq('id',body.linkId).eq('school_id',s.school_id).maybeSingle();if(!link)return json({error:'الرابط غير موجود'},404);const file=(link as any).platform_files;if(!canManage(file))return json({error:'لا توجد صلاحية'},403);await sb.from('platform_file_links').update({deleted_at:now}).eq('id',link.id);
   if(String((link as any).module_key)==='school_readiness'&&String((link as any).relation_type)==='evidence'&&isUuid((link as any).record_id)){await sb.from('school_readiness_evidence').update({status:'trashed',deleted_at:now}).eq('school_id',s.school_id).eq('plan_id',(link as any).record_id).eq('platform_file_id',file.id).eq('status','active')}
   await event('unlinked',file,{old_values:link});return json({ok:true});
  }
  if(action==='audit'){
   let q=sb.from('platform_file_events').select('*').eq('school_id',s.school_id).order('created_at',{ascending:false}).limit(Math.min(Number(body.limit)||100,500));if(body.fileId)q=q.eq('file_id',body.fileId);if(body.moduleKey)q=q.eq('module_key',safeKey(body.moduleKey));if(!isManager)q=q.eq('user_id',s.user_id);const {data,error}=await q;if(error)throw error;return json({events:data||[]});
  }
  if(action==='stats'){
   let q=sb.from('platform_files').select('file_size,status,ownership_scope,module_key,owner_user_id').eq('school_id',s.school_id).neq('status','deleted');if(isPrivateLibraryModule(body.moduleKey)||!isManager)q=q.eq('owner_user_id',s.user_id);if(body.moduleKey)q=q.eq('module_key',safeKey(body.moduleKey));const {data,error}=await q;if(error)throw error;const rows=(data||[]).filter((x:any)=>!isPrivateSectionLibrary(x)||String(x.owner_user_id||'')===String(s.user_id));return json({files:rows.length,bytes:rows.reduce((a:any,x:any)=>a+Number(x.file_size||0),0),active:rows.filter((x:any)=>x.status==='active').length,trashed:rows.filter((x:any)=>x.status==='trashed').length});
  }
  return json({error:'عملية غير مدعومة'},400);
 }catch(e){console.error('[platform-files]',requestId,'fatal',e);return json({error:e instanceof Error?e.message:String(e),code:'FILES_FATAL_ERROR',requestId},500)}
});
