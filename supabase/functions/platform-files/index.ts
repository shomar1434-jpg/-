import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session, x-client-version'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const safeExt=(name:string)=>{const x=(name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');return x||'bin'};
const safeKey=(v:unknown,fallback='general')=>String(v||fallback).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)||fallback;
const managers=new Set(['manager','owner','school_manager','principal','مدير','مديرة']);
const maxSigned=3600;
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 try{
  const raw=req.headers.get('x-platform-session')||'';if(!raw)return json({error:'جلسة الملفات مفقودة'},401);
  const hash=await sha256(raw), now=new Date().toISOString();
  const {data:s}=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();
  if(!s)return json({error:'انتهت جلسة الملفات'},401);
  await sb.from('platform_sessions').update({last_seen_at:now}).eq('id',s.id);
  const action=new URL(req.url).searchParams.get('action')||'';
  const isManager=managers.has(String(s.role));
  const body=req.method==='GET'?{}:await req.clone().json().catch(()=>({}));
  const canRead=(row:any)=>row&&row.school_id===s.school_id&&(row.ownership_scope==='school'||row.owner_user_id===s.user_id||isManager);
  const canManage=(row:any)=>row&&row.school_id===s.school_id&&(row.ownership_scope==='school'?isManager:row.owner_user_id===s.user_id||isManager);
  const event=async(type:string,file:any,extra:any={})=>{await sb.from('platform_file_events').insert({school_id:s.school_id,file_id:file?.id||null,folder_id:extra.folder_id||file?.folder_id||null,user_id:s.user_id,event_type:type,module_key:file?.module_key||extra.module_key||null,old_values:extra.old_values||null,new_values:extra.new_values||null})};
  const getFile=async(id:string)=>{const {data}=await sb.from('platform_files').select('*').eq('id',id).eq('school_id',s.school_id).maybeSingle();return data};
  const getFolder=async(id:string)=>{const {data}=await sb.from('platform_folders').select('*').eq('id',id).eq('school_id',s.school_id).maybeSingle();return data};
  if(action==='health')return json({ok:true,version:'3.0.0',schoolId:s.school_id,userId:s.user_id,role:s.role});
  if(action==='upload'){
   const form=await req.formData(), file=form.get('file') as File;if(!file)return json({error:'لم يتم اختيار ملف'},400);
   const scope=String(form.get('ownershipScope')||'user')==='school'?'school':'user';if(scope==='school'&&!isManager)return json({error:'رفع ملف مدرسي مشترك يتطلب صلاحية المدير'},403);
   const moduleKey=safeKey(form.get('moduleKey')), folderId=String(form.get('folderId')||'')||null, recordType=String(form.get('recordType')||'')||null, recordId=String(form.get('recordId')||'')||null;
   const relationType=String(form.get('relationType')||'attachment'), replaceFileId=String(form.get('replaceFileId')||'')||null;
   if(folderId){const folder=await getFolder(folderId);if(!folder||!canManage(folder)||folder.module_key!==moduleKey||folder.status!=='active')return json({error:'المجلد غير صالح أو لا توجد صلاحية'},403)}
   let replaced:any=null;if(replaceFileId){replaced=await getFile(replaceFileId);if(!replaced||!canManage(replaced))return json({error:'الملف المراد استبداله غير صالح'},403)}
   const id=crypto.randomUUID(),ext=safeExt(file.name),slot=folderId||recordId||'root',root=scope==='school'?'shared':`users/${s.user_id}`,path=`schools/${s.school_id}/${root}/${moduleKey}/${slot}/${id}.${ext}`;
   const up=await sb.storage.from('school-platform-files').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(up.error)throw up.error;
   let metadata:any={};try{metadata=JSON.parse(String(form.get('metadata')||'{}'))}catch(_){metadata={}}
   const {data:row,error}=await sb.from('platform_files').insert({id,school_id:s.school_id,ownership_scope:scope,owner_user_id:scope==='user'?s.user_id:null,uploaded_by:s.user_id,module_key:moduleKey,folder_id:folderId,primary_record_type:recordType,primary_record_id:recordId,storage_path:path,original_name:file.name,display_name:String(form.get('displayName')||file.name).slice(0,255),stored_name:`${id}.${ext}`,extension:ext,mime_type:file.type||'application/octet-stream',file_size:file.size,visibility:scope==='school'?'school':'private',version_number:replaced?(Number(replaced.version_number)||1)+1:1,replaced_file_id:replaced?.id||null,metadata}).select('*').single();
   if(error){await sb.storage.from('school-platform-files').remove([path]);throw error}
   if(recordType&&recordId){const {error:le}=await sb.from('platform_file_links').insert({school_id:s.school_id,file_id:id,module_key:moduleKey,record_type:recordType,record_id:recordId,relation_type:relationType,linked_by:s.user_id,is_primary:true});if(le&&!String(le.message).includes('duplicate'))throw le}
   if(replaced){await sb.from('platform_files').update({status:'archived',updated_at:now}).eq('id',replaced.id);await event('replaced',replaced,{new_values:{replacement_file_id:id}})}
   await event('uploaded',row,{new_values:{path,name:file.name,size:file.size}});return json({file:row});
  }
  if(action==='list'){
   let q=sb.from('platform_files').select('*').eq('school_id',s.school_id).order('created_at',{ascending:false}).limit(Math.min(Number(body.limit)||500,1000));
   q=body.includeTrashed?q.eq('status','trashed'):q.eq('status','active').is('deleted_at',null);
   if(body.moduleKey)q=q.eq('module_key',safeKey(body.moduleKey));if(Object.prototype.hasOwnProperty.call(body,'folderId'))q=body.folderId?q.eq('folder_id',body.folderId):q.is('folder_id',null);
   if(body.ownershipScope==='user')q=q.eq('owner_user_id',s.user_id);else if(body.ownershipScope==='school')q=q.eq('ownership_scope','school');
   if(body.recordType)q=q.eq('primary_record_type',body.recordType);if(body.recordId)q=q.eq('primary_record_id',body.recordId);if(body.search)q=q.ilike('display_name',`%${String(body.search).slice(0,100)}%`);
   const {data,error}=await q;if(error)throw error;return json({files:data||[]});
  }
  if(action==='list-by-link'){
   let q=sb.from('platform_file_links').select('id,relation_type,is_primary,created_at,platform_files(*)').eq('school_id',s.school_id).is('deleted_at',null).eq('module_key',safeKey(body.moduleKey)).eq('record_type',body.recordType).eq('record_id',body.recordId).order('created_at',{ascending:false});
   const {data,error}=await q;if(error)throw error;const rows=(data||[]).filter((x:any)=>x.platform_files?.status==='active'&&canRead(x.platform_files));return json({links:rows});
  }
  if(action==='list-folders'){
   let q=sb.from('platform_folders').select('*').eq('school_id',s.school_id).eq('module_key',safeKey(body.moduleKey)).order('sort_order').order('folder_name');
   q=body.includeTrashed?q.eq('status','trashed'):q.eq('status','active').is('deleted_at',null);if(body.ownershipScope==='user')q=q.eq('owner_user_id',s.user_id);else if(body.ownershipScope==='school')q=q.eq('ownership_scope','school');if(!body.all)q=body.parentFolderId?q.eq('parent_folder_id',body.parentFolderId):q.is('parent_folder_id',null);
   const {data,error}=await q;if(error)throw error;return json({folders:data||[]});
  }
  if(action==='create-folder'){
   const name=String(body.folderName||'').trim().slice(0,160);if(!name)return json({error:'اسم المجلد مطلوب'},400);const scope=body.ownershipScope==='school'?'school':'user';if(scope==='school'&&!isManager)return json({error:'إنشاء المجلد المدرسي يتطلب صلاحية المدير'},403);
   if(body.parentFolderId){const p=await getFolder(body.parentFolderId);if(!p||!canManage(p)||p.module_key!==safeKey(body.moduleKey))return json({error:'المجلد الأب غير صالح'},403)}
   const {data,error}=await sb.from('platform_folders').insert({school_id:s.school_id,ownership_scope:scope,owner_user_id:scope==='user'?s.user_id:null,module_key:safeKey(body.moduleKey),parent_folder_id:body.parentFolderId||null,folder_name:name,created_by:s.user_id}).select('*').single();if(error)throw error;await event('folder_created',null,{folder_id:data.id,module_key:data.module_key,new_values:data});return json({folder:data});
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
   const file=await getFile(body.fileId);if(!file)return json({error:'الملف غير موجود'},404);if(action==='signed-url'){if(!canRead(file))return json({error:'لا توجد صلاحية'},403);if(file.status!=='active')return json({error:'الملف غير متاح للمعاينة'},409);const expires=Math.max(60,Math.min(Number(body.expiresIn)||300,maxSigned));const {data,error}=await sb.storage.from(file.bucket_name).createSignedUrl(file.storage_path,expires);if(error)throw error;await event('viewed',file);return json({signedUrl:data.signedUrl,expiresIn:expires})}
   if(!canManage(file))return json({error:'لا توجد صلاحية'},403);
   if(action==='trash'){await sb.from('platform_files').update({status:'trashed',deleted_at:now}).eq('id',file.id);await event('trashed',file);return json({ok:true})}
   if(action==='restore'){await sb.from('platform_files').update({status:'active',deleted_at:null}).eq('id',file.id);await event('restored',file);return json({ok:true})}
   if(action==='purge'){if(file.status!=='trashed')return json({error:'انقل الملف إلى سلة المحذوفات أولًا'},409);const rm=await sb.storage.from(file.bucket_name).remove([file.storage_path]);if(rm.error)throw rm.error;await sb.from('platform_files').update({status:'deleted',deleted_at:now}).eq('id',file.id);await event('deleted',file);return json({ok:true})}
   if(action==='rename-file'){const name=String(body.displayName||'').trim().slice(0,255);if(!name)return json({error:'اسم الملف مطلوب'},400);const {data,error}=await sb.from('platform_files').update({display_name:name}).eq('id',file.id).select('*').single();if(error)throw error;await event('renamed',file,{old_values:{display_name:file.display_name},new_values:{display_name:name}});return json({file:data})}
   if(action==='move-file'){if(body.folderId){const folder=await getFolder(body.folderId);if(!folder||!canManage(folder)||folder.module_key!==file.module_key||folder.status!=='active')return json({error:'المجلد الهدف غير صالح'},403)}const {data,error}=await sb.from('platform_files').update({folder_id:body.folderId||null}).eq('id',file.id).select('*').single();if(error)throw error;await event('moved',file,{old_values:{folder_id:file.folder_id},new_values:{folder_id:body.folderId||null}});return json({file:data})}
   const {data:links,error}=await sb.from('platform_file_links').select('*').eq('file_id',file.id).is('deleted_at',null).order('created_at');if(error)throw error;return json({file,links:links||[]});
  }
  if(action==='link'){
   const file=await getFile(body.fileId);if(!file)return json({error:'الملف غير موجود'},404);if(!canManage(file))return json({error:'لا توجد صلاحية'},403);const key={school_id:s.school_id,file_id:file.id,module_key:safeKey(body.moduleKey),record_type:String(body.recordType),record_id:String(body.recordId),relation_type:String(body.relationType||'attachment')};const {data:existing}=await sb.from('platform_file_links').select('*').match(key).maybeSingle();let data:any,error:any;if(existing){({data,error}=await sb.from('platform_file_links').update({deleted_at:null,linked_by:s.user_id,is_primary:!!body.isPrimary}).eq('id',existing.id).select('*').single())}else{({data,error}=await sb.from('platform_file_links').insert({...key,linked_by:s.user_id,is_primary:!!body.isPrimary}).select('*').single())}if(error)throw error;await event('linked',file,{new_values:data});return json({link:data});
  }
  if(action==='unlink'){
   const {data:link}=await sb.from('platform_file_links').select('*,platform_files(*)').eq('id',body.linkId).eq('school_id',s.school_id).maybeSingle();if(!link)return json({error:'الرابط غير موجود'},404);const file=(link as any).platform_files;if(!canManage(file))return json({error:'لا توجد صلاحية'},403);await sb.from('platform_file_links').update({deleted_at:now}).eq('id',link.id);await event('unlinked',file,{old_values:link});return json({ok:true});
  }
  if(action==='audit'){
   let q=sb.from('platform_file_events').select('*').eq('school_id',s.school_id).order('created_at',{ascending:false}).limit(Math.min(Number(body.limit)||100,500));if(body.fileId)q=q.eq('file_id',body.fileId);if(body.moduleKey)q=q.eq('module_key',safeKey(body.moduleKey));if(!isManager)q=q.eq('user_id',s.user_id);const {data,error}=await q;if(error)throw error;return json({events:data||[]});
  }
  if(action==='stats'){
   let q=sb.from('platform_files').select('file_size,status,ownership_scope,module_key').eq('school_id',s.school_id).neq('status','deleted');if(!isManager)q=q.eq('owner_user_id',s.user_id);if(body.moduleKey)q=q.eq('module_key',safeKey(body.moduleKey));const {data,error}=await q;if(error)throw error;const rows=data||[];return json({files:rows.length,bytes:rows.reduce((a:any,x:any)=>a+Number(x.file_size||0),0),active:rows.filter((x:any)=>x.status==='active').length,trashed:rows.filter((x:any)=>x.status==='trashed').length});
  }
  return json({error:'عملية غير مدعومة'},400);
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:String(e)},500)}
});
