import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session, x-client-version',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const managers=new Set(['manager','owner','school_manager','principal','leadership','admin','مدير','مديرة','مدير المدرسة','مديرة المدرسة']);
const MAX_FILE_SIZE=50*1024*1024;
const allowedMimePrefixes=['image/'];
const allowedMimeTypes=new Set([
 'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
 'application/octet-stream'
]);
const safeExt=(name:string)=>{const x=(name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');return x||'bin'};
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const supabaseUrl=Deno.env.get('SUPABASE_URL'), serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!supabaseUrl||!serviceRole)return json({error:'إعدادات خدمة متابعة مؤشرات التقويم غير مكتملة',code:'EVAL_TEAM_ENV_MISSING'},500);
 const sb=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
 const action=new URL(req.url).searchParams.get('action')||'';
 const requestId=crypto.randomUUID();
 const nowIso=()=>new Date().toISOString();

 const readJson=async()=>req.method==='GET'?{}:await req.clone().json().catch(()=>({}));
 const session=async()=>{
   const raw=req.headers.get('x-platform-session')||'';
   if(!raw)throw Object.assign(new Error('جلسة المنصة مفقودة'),{status:401,code:'SESSION_MISSING'});
   const hash=await sha256(raw), now=nowIso();
   const q=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();
   if(q.error)throw q.error;
   if(!q.data)throw Object.assign(new Error('انتهت جلسة المنصة'),{status:401,code:'SESSION_EXPIRED'});
   await sb.from('platform_sessions').update({last_seen_at:now}).eq('id',q.data.id);
   return q.data;
 };
 const managerSession=async()=>{
   const s=await session();
   const r=String(s.role||'').trim().toLowerCase();
   if(!managers.has(r)&&!managers.has(String(s.role||'')))throw Object.assign(new Error('هذا القسم مخصص لمدير/مديرة المدرسة'),{status:403,code:'MANAGER_ONLY'});
   return s;
 };
 const tokenLink=async(token:string)=>{
   if(!token||token.length<20)return null;
   const h=await sha256(token);
   const q=await sb.from('evaluation_team_upload_links').select('*').eq('token_hash',h).maybeSingle();
   if(q.error)throw q.error;
   const l=q.data;
   if(!l||l.status!=='active')return null;
   if(l.expires_at&&Date.parse(l.expires_at)<Date.now()){
     await sb.from('evaluation_team_upload_links').update({status:'expired',updated_at:nowIso()}).eq('id',l.id);
     return null;
   }
   return l;
 };

 try{
   // Public actions deliberately run without a platform session, but only through an unguessable hashed token.
   if(action==='resolve-link'){
     const body=await readJson();
     const l=await tokenLink(String(body.token||''));
     if(!l)return json({error:'رابط الرفع غير صالح أو منتهي',code:'LINK_INVALID'},404);
     return json({ok:true,link:{id:l.id,title:l.title,indicator_code:l.indicator_code,program_id:l.program_id,task_id:l.task_id,max_files:l.max_files,expires_at:l.expires_at}});
   }

   if(action==='public-upload'){
     const form=await req.formData();
     const token=String(form.get('token')||''), uploaderName=String(form.get('uploaderName')||'').trim().slice(0,180), batchId=String(form.get('batchId')||crypto.randomUUID()).slice(0,100);
     const file=form.get('file') as File|null;
     const l=await tokenLink(token);
     if(!l)return json({error:'رابط الرفع غير صالح أو منتهي',code:'LINK_INVALID'},404);
     if(!file)return json({error:'لم يتم اختيار ملف',code:'FILE_MISSING'},400);
     const originalSize=Number(form.get('clientOriginalSize')||file.size),preparedSize=Number(form.get('clientPreparedSize')||file.size);
     if(!Number.isFinite(file.size)||file.size<=0)return json({error:'وصل الملف بحجم صفر ولم يتم اعتماد الرفع',code:'EMPTY_FILE_UPLOAD'},422);
     if(originalSize!==preparedSize||preparedSize!==file.size)return json({error:'حجم الملف المستلم لا يطابق الملف المحدد في الجهاز',code:'UPLOAD_SIZE_MISMATCH'},422);
     if(file.size>MAX_FILE_SIZE)return json({error:'حجم الملف يتجاوز 50 ميجابايت',code:'FILE_TOO_LARGE'},413);
     const mime=file.type||'application/octet-stream';
     if(!allowedMimeTypes.has(mime)&&!allowedMimePrefixes.some(x=>mime.startsWith(x)))return json({error:'نوع الملف غير مسموح',code:'FILE_TYPE_NOT_ALLOWED'},415);
     const count=await sb.from('evaluation_team_submissions').select('id',{count:'exact',head:true}).eq('link_id',l.id).eq('batch_id',batchId);
     if(count.error)throw count.error;
     if(Number(count.count||0)>=Number(l.max_files||5))return json({error:'تم تجاوز الحد الأقصى للملفات في هذه العملية',code:'BATCH_FILE_LIMIT'},409);

     const id=crypto.randomUUID(), ext=safeExt(file.name);
     const path=`schools/${l.school_id}/users/${l.reviewer_user_id}/evaluation_team_monitor/public/${l.id}/${id}.${ext}`;
     const up=await sb.storage.from('school-platform-files').upload(path,file,{contentType:mime,upsert:false});
     if(up.error)throw up.error;
     const slash=path.lastIndexOf('/'),dir=path.slice(0,slash),name=path.slice(slash+1);
     const listed=await sb.storage.from('school-platform-files').list(dir,{limit:10,search:name});
     if(listed.error){await sb.storage.from('school-platform-files').remove([path]);throw listed.error}
     const stored=(listed.data||[]).find((x:any)=>String(x.name||'')===name);
     const storedSize=Number(stored?.metadata?.size??stored?.metadata?.contentLength??stored?.metadata?.['content-length']??-1);
     if(!stored||!Number.isFinite(storedSize)||storedSize<=0||storedSize!==file.size){
       await sb.storage.from('school-platform-files').remove([path]);
       return json({error:'لم ينجح التحقق من حفظ الملف فعليًا في سحابة المدرسة',code:'STORAGE_UPLOAD_NOT_VERIFIED'},502);
     }
     const metadata={source:'evaluation_team_public_link',externalUploaderName:uploaderName,linkId:l.id,indicatorCode:l.indicator_code,programId:l.program_id,taskId:l.task_id,batchId};
     const ins=await sb.from('platform_files').insert({
       id,school_id:l.school_id,ownership_scope:'user',owner_user_id:l.reviewer_user_id,uploaded_by:l.created_by,module_key:'evaluation_team_monitor',folder_id:null,
       primary_record_type:'evaluation_team_public_submission',primary_record_id:String(l.id),bucket_name:'school-platform-files',storage_path:path,
       original_name:file.name,display_name:file.name,stored_name:`${id}.${ext}`,extension:ext,mime_type:mime,file_size:storedSize,visibility:'private',status:'active',version_number:1,metadata
     }).select('*').single();
     if(ins.error){await sb.storage.from('school-platform-files').remove([path]);throw ins.error}
     const sub=await sb.from('evaluation_team_submissions').insert({school_id:l.school_id,link_id:l.id,batch_id:batchId,platform_file_id:id,title:file.name,original_name:file.name,uploader_name:uploaderName,reviewer_user_id:l.reviewer_user_id,status:'pending'}).select('*').single();
     if(sub.error){await sb.from('platform_files').delete().eq('id',id);await sb.storage.from('school-platform-files').remove([path]);throw sub.error}
     const linkRow=await sb.from('platform_file_links').insert({school_id:l.school_id,file_id:id,module_key:'evaluation_team_monitor',record_type:'evaluation_team_submission',record_id:String(sub.data.id),relation_type:'evidence',linked_by:l.created_by,is_primary:true});
     if(linkRow.error){await sb.from('evaluation_team_submissions').delete().eq('id',sub.data.id);await sb.from('platform_files').delete().eq('id',id);await sb.storage.from('school-platform-files').remove([path]);throw linkRow.error}
     return json({ok:true,submission:{id:sub.data.id,title:sub.data.title,status:sub.data.status},file:{id,file_size:storedSize}});
   }

   const s=await managerSession();
   const body=await readJson();

   if(action==='health')return json({ok:true,service:'platform-evaluation-team',version:'2026.09.11.1',schoolId:s.school_id,userId:s.user_id});

   if(action==='create-link'){
     const token=crypto.randomUUID()+'-'+crypto.randomUUID(), tokenHash=await sha256(token);
     const title=String(body.title||'رفع شاهد فريق التقويم').trim().slice(0,220);
     const maxFiles=Math.max(1,Math.min(20,Number(body.maxFiles)||5));
     const expiresAt=body.expiresAt?new Date(body.expiresAt).toISOString():null;
     const taskId=body.taskId&&isUuid(body.taskId)?String(body.taskId):null;
     if(taskId){
       const tq=await sb.from('central_tasks').select('id,school_id').eq('id',taskId).eq('school_id',s.school_id).maybeSingle();
       if(tq.error)throw tq.error;if(!tq.data)return json({error:'المهمة المرتبطة لا تنتمي إلى المدرسة الحالية',code:'TASK_SCOPE_MISMATCH'},403);
     }
     const q=await sb.from('evaluation_team_upload_links').insert({school_id:s.school_id,token_hash:tokenHash,title,indicator_code:String(body.indicatorCode||'').slice(0,80)||null,program_id:String(body.programId||'').slice(0,120)||null,task_id:taskId,created_by:s.user_id,reviewer_user_id:s.user_id,reviewer_role:s.role,expires_at:expiresAt,max_files:maxFiles,status:'active',metadata:{module:'evaluation_team_monitor'}}).select('*').single();
     if(q.error)throw q.error;
     return json({ok:true,link:{id:q.data.id,title:q.data.title,token,indicator_code:q.data.indicator_code,program_id:q.data.program_id,task_id:q.data.task_id,max_files:q.data.max_files,expires_at:q.data.expires_at,status:q.data.status}});
   }

   if(action==='rotate-link-token'){
     const id=String(body.linkId||'');if(!isUuid(id))return json({error:'معرف الرابط غير صالح'},400);
     const own=await sb.from('evaluation_team_upload_links').select('*').eq('id',id).eq('school_id',s.school_id).eq('created_by',s.user_id).maybeSingle();
     if(own.error)throw own.error;if(!own.data||own.data.status!=='active')return json({error:'الرابط غير موجود أو متوقف'},404);
     const token=crypto.randomUUID()+'-'+crypto.randomUUID(),h=await sha256(token);
     const u=await sb.from('evaluation_team_upload_links').update({token_hash:h,updated_at:nowIso()}).eq('id',id).eq('school_id',s.school_id);if(u.error)throw u.error;
     return json({ok:true,token});
   }

   if(action==='list-links'){
     const q=await sb.from('evaluation_team_upload_links').select('id,title,indicator_code,program_id,task_id,expires_at,max_files,status,created_at,updated_at').eq('school_id',s.school_id).eq('created_by',s.user_id).order('created_at',{ascending:false});
     if(q.error)throw q.error;return json({ok:true,links:q.data||[]});
   }

   if(action==='revoke-link'){
     const id=String(body.linkId||'');if(!isUuid(id))return json({error:'معرف الرابط غير صالح'},400);
     const q=await sb.from('evaluation_team_upload_links').update({status:'revoked',updated_at:nowIso()}).eq('id',id).eq('school_id',s.school_id).eq('created_by',s.user_id).select('id').maybeSingle();
     if(q.error)throw q.error;if(!q.data)return json({error:'الرابط غير موجود أو لا تملك صلاحية إيقافه'},404);return json({ok:true});
   }

   if(action==='list-submissions'){
     const q=await sb.from('evaluation_team_submissions').select('*').eq('school_id',s.school_id).eq('reviewer_user_id',s.user_id).order('created_at',{ascending:false});
     if(q.error)throw q.error;return json({ok:true,submissions:q.data||[]});
   }

   if(action==='decide-submission'){
     const id=String(body.submissionId||''),decision=String(body.decision||'');
     if(!isUuid(id)||!['approved','returned','rejected'].includes(decision))return json({error:'قرار المراجعة غير صالح'},400);
     const existing=await sb.from('evaluation_team_submissions').select('*').eq('id',id).eq('school_id',s.school_id).eq('reviewer_user_id',s.user_id).maybeSingle();
     if(existing.error)throw existing.error;if(!existing.data)return json({error:'الشاهد غير موجود أو لا تملك صلاحية مراجعته'},404);
     const q=await sb.from('evaluation_team_submissions').update({status:decision,review_note:String(body.note||'').slice(0,2000),reviewed_at:nowIso()}).eq('id',id).eq('school_id',s.school_id).eq('reviewer_user_id',s.user_id).select('*').single();
     if(q.error)throw q.error;return json({ok:true,submission:q.data});
   }

   return json({error:'الإجراء غير معروف',code:'UNKNOWN_ACTION'},404);
 }catch(e:any){
   console.error('[platform-evaluation-team]',requestId,e);
   const status=Number(e?.status)||500;
   return json({error:String(e?.message||'تعذر تنفيذ العملية'),code:e?.code||'EVALUATION_TEAM_ERROR',requestId},status);
 }
});
