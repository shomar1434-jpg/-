import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT, jwtVerify } from 'npm:jose@5.9.6';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session, x-client-version','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const b64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const randomSecret=()=>b64url(crypto.getRandomValues(new Uint8Array(32)));
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
const editableExt=new Set(['docx','xlsx','pptx']);
const useModes=new Set(['reference','work','continuous']);
const MAX_FILE_SIZE=50*1024*1024;
const extOf=(f:any)=>String(f?.extension||String(f?.display_name||'').split('.').pop()||'').trim().toLowerCase();
const modeOf=(f:any)=>{const m=String(f?.metadata?.documentUseMode||'').trim();return useModes.has(m)?m:'work'};
const isLibraryFile=(f:any)=>/library/i.test(String(f?.module_key||''))||String(f?.primary_record_type||'')==='library_file';
const docType=(ext:string)=>ext==='xlsx'?'cell':ext==='pptx'?'slide':'word';
const mimeFor=(ext:string)=>ext==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':ext==='pptx'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const managers=new Set(['manager','owner','school_manager','principal','leadership','admin','مدير','مديرة','مدير المدرسة','مديرة المدرسة']);

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const documentServerUrl=(Deno.env.get('ONLYOFFICE_DOCUMENT_SERVER_URL')||'').replace(/\/$/,'');
  const jwtSecret=Deno.env.get('ONLYOFFICE_JWT_SECRET')||'';
  if(!supabaseUrl||!serviceRole)return json({error:'إعدادات Supabase غير مكتملة'},500);
  const sb=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
  const url=new URL(req.url),action=url.searchParams.get('action')||'',now=new Date(),nowIso=now.toISOString();
  const jwtKey=jwtSecret?new TextEncoder().encode(jwtSecret):null;
  const docOrigin=(()=>{try{return documentServerUrl?new URL(documentServerUrl).origin:''}catch(_){return''}})();

  async function verifyPlatformSession(){
    const raw=req.headers.get('x-platform-session')||'';if(!raw)return null;
    const hash=await sha256(raw);
    const {data}=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',nowIso).maybeSingle();
    if(data)await sb.from('platform_sessions').update({last_seen_at:nowIso}).eq('id',data.id);return data;
  }
  const isManager=(s:any)=>managers.has(String(s?.role||'').toLowerCase())||managers.has(String(s?.role||''));
  async function getFile(fileId:string,schoolId:string){const {data}=await sb.from('platform_files').select('*').eq('id',fileId).eq('school_id',schoolId).maybeSingle();return data}
  function canRead(s:any,f:any){if(!s||!f||String(f.school_id)!==String(s.school_id))return false;if(f.ownership_scope==='user')return String(f.owner_user_id||'')===String(s.user_id||'')||isManager(s);return isManager(s)}
  function canManage(s:any,f:any){if(!canRead(s,f))return false;if(f.ownership_scope==='user')return String(f.owner_user_id||'')===String(s.user_id||'')||isManager(s);return isManager(s)}
  function canEdit(s:any,f:any){return !!s&&!!f&&String(f.school_id)===String(s.school_id)&&f.status==='active'&&editableExt.has(extOf(f))&&isLibraryFile(f)&&modeOf(f)!=='reference'&&canManage(s,f)}
  async function verifyCallback(body:any){if(!jwtKey)return false;const raw=String(req.headers.get('authorization')||body?.token||'').replace(/^Bearer\s+/i,'').trim();if(!raw)return false;try{await jwtVerify(raw,jwtKey);return true}catch(_){return false}}
  async function event(schoolId:string,userId:string,type:string,file:any,extra:any={}){await sb.from('platform_file_events').insert({school_id:schoolId,file_id:file?.id||null,folder_id:file?.folder_id||null,user_id:userId,event_type:type,module_key:file?.module_key||null,old_values:extra.old_values||null,new_values:extra.new_values||null})}
  async function moveLibraryLinks(oldFile:any,newFile:any,userId:string){
    const {data:links}=await sb.from('platform_file_links').select('*').eq('school_id',oldFile.school_id).eq('file_id',oldFile.id).is('deleted_at',null);
    for(const l of links||[]){
      const isLibrary=String(l.relation_type||'')==='library_file'||['library_file','library'].includes(String(l.record_type||''));if(!isLibrary)continue;
      const payload:any={school_id:l.school_id,file_id:newFile.id,module_key:l.module_key,record_type:l.record_type,record_id:l.record_id,relation_type:l.relation_type,linked_by:userId,is_primary:l.is_primary,metadata:l.metadata||{}};
      const ins=await sb.from('platform_file_links').insert(payload);if(!ins.error)await sb.from('platform_file_links').update({deleted_at:nowIso}).eq('id',l.id);
    }
  }
  async function insertVersion(source:any,bytes:Uint8Array,userId:string,metadataExtra:any){
    const ext=extOf(source),newId=crypto.randomUUID(),bucket=source.bucket_name||'school-platform-files',dir=String(source.storage_path||'').split('/').slice(0,-1).join('/');
    if(!dir)throw new Error('مسار الملف غير صالح');
    const newPath=`${dir}/${newId}.${ext}`;
    const up=await sb.storage.from(bucket).upload(newPath,bytes,{contentType:mimeFor(ext),upsert:false});if(up.error)throw up.error;
    const md=source.metadata&&typeof source.metadata==='object'?source.metadata:{};
    const metadata={...md,...metadataExtra,documentUseMode:modeOf(source)};
    const payload={id:newId,school_id:source.school_id,ownership_scope:source.ownership_scope,owner_user_id:source.owner_user_id,uploaded_by:userId,module_key:source.module_key,folder_id:source.folder_id,primary_record_type:source.primary_record_type,primary_record_id:source.primary_record_id,bucket_name:bucket,storage_path:newPath,original_name:source.original_name,display_name:source.display_name,stored_name:`${newId}.${ext}`,extension:ext,mime_type:mimeFor(ext),file_size:bytes.byteLength,visibility:source.visibility,version_number:(Number(source.version_number)||1)+1,replaced_file_id:source.id,metadata};
    const ins=await sb.from('platform_files').insert(payload).select('*').single();if(ins.error){await sb.storage.from(bucket).remove([newPath]);throw ins.error}
    const archived=await sb.from('platform_files').update({status:'archived',updated_at:nowIso}).eq('id',source.id).eq('school_id',source.school_id);if(archived.error){await sb.storage.from(bucket).remove([newPath]);await sb.from('platform_files').delete().eq('id',newId);throw archived.error}
    await moveLibraryLinks(source,ins.data,userId);return ins.data;
  }
  async function versionChain(head:any,schoolId:string){const rows:any[]=[];let cur=head;const seen=new Set<string>();while(cur&&!seen.has(String(cur.id))&&rows.length<200){seen.add(String(cur.id));rows.push(cur);if(!cur.replaced_file_id)break;cur=await getFile(String(cur.replaced_file_id),schoolId)}return rows}

  try{
    if(action==='callback'){
      const sessionId=String(url.searchParams.get('session')||''),secret=String(url.searchParams.get('secret')||'');if(!isUuid(sessionId)||!secret)return json({error:1});
      const body=await req.json().catch(()=>({}));if(!jwtSecret||!(await verifyCallback(body)))return json({error:1});
      const secretHash=await sha256(secret);const {data:session}=await sb.from('document_workspace_sessions').select('*').eq('id',sessionId).eq('callback_secret_hash',secretHash).maybeSingle();
      if(!session||!['active','saving'].includes(String(session.status)))return json({error:0});
      const status=Number(body.status||0);await sb.from('document_workspace_sessions').update({last_callback_at:nowIso,updated_at:nowIso}).eq('id',session.id);
      if(status===4){await sb.from('document_workspace_sessions').update({status:'closed',closed_at:nowIso,updated_at:nowIso}).eq('id',session.id);return json({error:0})}
      if(![2,6].includes(status))return json({error:0});
      const editedUrl=String(body.url||'');let parsed:URL;try{parsed=new URL(editedUrl)}catch(_){return json({error:1})}if(parsed.protocol!=='https:'||!docOrigin||parsed.origin!==docOrigin){await sb.from('document_workspace_sessions').update({status:'failed',error_message:'رابط الحفظ لا يعود لخادم المحرر المعتمد',updated_at:nowIso}).eq('id',session.id);return json({error:1})}
      await sb.from('document_workspace_sessions').update({status:'saving',updated_at:nowIso}).eq('id',session.id);
      const source=await getFile(String(session.current_file_id),String(session.school_id));if(!source||source.status!=='active'||!isLibraryFile(source)){await sb.from('document_workspace_sessions').update({status:'failed',error_message:'ملف المصدر غير متاح أو تغير أثناء التحرير',updated_at:nowIso}).eq('id',session.id);return json({error:1})}
      let fetched=await fetch(editedUrl).catch(()=>null);if((!fetched||!fetched.ok)&&body.token)fetched=await fetch(editedUrl,{headers:{Authorization:`Bearer ${String(body.token).trim()}`}}).catch(()=>null);
      if(!fetched||!fetched.ok){await sb.from('document_workspace_sessions').update({status:'failed',error_message:'تعذر تنزيل النسخة المعدلة من المحرر',updated_at:nowIso}).eq('id',session.id);return json({error:1})}
      const bytes=new Uint8Array(await fetched.arrayBuffer());if(bytes.byteLength>MAX_FILE_SIZE)return json({error:1});
      const saved=await insertVersion(source,bytes,String(session.user_id),{workspaceProvider:'onlyoffice',workspaceEditedBy:String(session.user_id),workspaceEditedByName:String(session.metadata?.userName||''),workspaceEditedAt:nowIso,workspaceSessionId:session.id,workspaceAction:status===6?'force_save':'save'});
      await event(source.school_id,String(session.user_id),'workspace_version_saved',saved,{old_values:{file_id:source.id,version_number:source.version_number},new_values:{file_id:saved.id,version_number:saved.version_number,workspace_session_id:session.id}});
      await sb.from('document_workspace_sessions').update({status:status===6?'active':'completed',file_id:saved.id,current_file_id:saved.id,saved_file_id:saved.id,closed_at:status===6?null:nowIso,updated_at:nowIso}).eq('id',session.id);
      return json({error:0});
    }

    const s=await verifyPlatformSession();if(!s)return json({error:'جلسة مساحة العمل مفقودة أو منتهية'},401);
    const body=req.method==='GET'?{}:await req.json().catch(()=>({}));
    if(action==='health')return json({ok:true,version:'2.0.0-CDW-COMPLETE',provider:'onlyoffice',configured:!!(documentServerUrl&&jwtSecret),schoolId:s.school_id,userId:s.user_id});
    if(action==='capabilities'){const f=await getFile(String(body.fileId||''),String(s.school_id));return json({editable:canEdit(s,f),configured:!!(documentServerUrl&&jwtSecret),extension:extOf(f),libraryFile:!!f&&isLibraryFile(f),mode:modeOf(f)});}
    if(action==='open-session'){
      if(!documentServerUrl||!jwtSecret)return json({error:'محرر ONLYOFFICE Docs غير مهيأ. أضف ONLYOFFICE_DOCUMENT_SERVER_URL و ONLYOFFICE_JWT_SECRET إلى أسرار Supabase.'},503);
      const f=await getFile(String(body.fileId||''),String(s.school_id));if(!f)return json({error:'الملف غير موجود'},404);if(!canEdit(s,f))return json({error:modeOf(f)==='reference'?'تم تصنيف هذا الملف كمرجع للقراءة. غيّر نوع الاستخدام إلى ملف عمل أو سجل مستمر أولًا.':'لا توجد صلاحية لتحرير هذا الملف أو أن صيغته غير مدعومة.'},403);
      const staleIso=new Date(Date.now()-5*60*1000).toISOString();await sb.from('document_workspace_sessions').update({status:'expired',closed_at:nowIso,updated_at:nowIso}).eq('school_id',s.school_id).eq('file_id',f.id).in('status',['active','saving']).or(`expires_at.lt.${nowIso},updated_at.lt.${staleIso}`);
      const {data:active}=await sb.from('document_workspace_sessions').select('*').eq('school_id',s.school_id).eq('file_id',f.id).in('status',['active','saving']).gt('expires_at',nowIso).maybeSingle();
      if(active){if(String(active.user_id)!==String(s.user_id))return json({error:'الملف قيد التحرير الآن بواسطة مستخدم آخر في نفس المدرسة.',code:'EDIT_LOCKED'},409);if(!body.force)return json({error:'لديك جلسة تحرير سابقة ما زالت نشطة.',code:'OWN_EDIT_SESSION_ACTIVE'},409);await sb.from('document_workspace_sessions').update({status:'closed',closed_at:nowIso,updated_at:nowIso}).eq('id',active.id)}
      const callbackSecret=randomSecret(),callbackHash=await sha256(callbackSecret),sessionId=crypto.randomUUID(),ext=extOf(f),expiresAt=new Date(Date.now()+4*60*60*1000).toISOString(),key=`cdw-${String(f.id).replace(/-/g,'')}-${Number(f.version_number)||1}`.slice(0,120);
      const userName=String(s.user_name||s.full_name||s.user_email||s.role||'مستخدم المنصة');
      const ins=await sb.from('document_workspace_sessions').insert({id:sessionId,school_id:s.school_id,file_id:f.id,current_file_id:f.id,user_id:s.user_id,document_key:key,callback_secret_hash:callbackHash,status:'active',expires_at:expiresAt,metadata:{moduleKey:f.module_key,displayName:f.display_name,extension:ext,userName}}).select('*').single();if(ins.error)throw ins.error;
      const signed=await sb.storage.from(f.bucket_name||'school-platform-files').createSignedUrl(f.storage_path,3600);if(signed.error){await sb.from('document_workspace_sessions').update({status:'failed',error_message:'تعذر إنشاء رابط قراءة مؤقت',updated_at:nowIso}).eq('id',sessionId);throw signed.error}
      const callbackUrl=`${supabaseUrl}/functions/v1/platform-document-workspace?action=callback&session=${encodeURIComponent(sessionId)}&secret=${encodeURIComponent(callbackSecret)}`;
      const config:any={documentType:docType(ext),document:{fileType:ext,key,title:f.display_name||f.original_name||`document.${ext}`,url:signed.data.signedUrl,permissions:{edit:true,download:true,print:true,copy:true,comment:true,review:true}},editorConfig:{mode:'edit',lang:'ar',callbackUrl,user:{id:String(s.user_id),name:userName},customization:{autosave:true,forcesave:true,compactHeader:false,help:false}}};
      config.token=await new SignJWT(config).setProtectedHeader({alg:'HS256',typ:'JWT'}).sign(jwtKey!);await event(String(s.school_id),String(s.user_id),'workspace_edit_opened',f,{new_values:{workspace_session_id:sessionId,version_number:f.version_number}});
      return json({sessionId,file:{id:f.id,display_name:f.display_name,extension:ext,version_number:f.version_number,metadata:f.metadata||{}},documentServerUrl,config,expiresAt});
    }
    if(action==='heartbeat'){
      const id=String(body.sessionId||'');if(!isUuid(id))return json({error:'جلسة غير صالحة'},400);const {data:sess}=await sb.from('document_workspace_sessions').select('*').eq('id',id).eq('school_id',s.school_id).eq('user_id',s.user_id).maybeSingle();if(!sess||!['active','saving'].includes(String(sess.status)))return json({error:'جلسة التحرير لم تعد نشطة'},409);await sb.from('document_workspace_sessions').update({updated_at:nowIso,expires_at:new Date(Date.now()+4*60*60*1000).toISOString()}).eq('id',id);return json({ok:true});
    }
    if(action==='versions'){
      const f=await getFile(String(body.fileId||''),String(s.school_id));if(!f)return json({error:'الملف غير موجود'},404);if(!canRead(s,f))return json({error:'لا توجد صلاحية'},403);const rows=await versionChain(f,String(s.school_id));return json({currentFile:f,versions:rows.map(x=>({...x,storage_path:undefined,bucket_name:undefined}))});
    }
    if(action==='set-mode'){
      const f=await getFile(String(body.fileId||''),String(s.school_id));if(!f)return json({error:'الملف غير موجود'},404);if(!canManage(s,f))return json({error:'لا توجد صلاحية'},403);const mode=String(body.mode||'');if(!useModes.has(mode))return json({error:'نوع الاستخدام غير صالح'},400);const md=f.metadata&&typeof f.metadata==='object'?f.metadata:{};const {data,error}=await sb.from('platform_files').update({metadata:{...md,documentUseMode:mode,documentUseModeUpdatedAt:nowIso,documentUseModeUpdatedBy:s.user_id}}).eq('id',f.id).eq('school_id',s.school_id).select('*').single();if(error)throw error;await event(String(s.school_id),String(s.user_id),'workspace_mode_changed',data,{new_values:{documentUseMode:mode}});return json({file:data});
    }
    if(action==='restore-version'){
      const head=await getFile(String(body.fileId||''),String(s.school_id)),versionId=String(body.versionId||'');if(!head||!isUuid(versionId))return json({error:'بيانات الاستعادة غير صالحة'},400);if(!canManage(s,head)||head.status!=='active')return json({error:'لا توجد صلاحية للاستعادة'},403);const chain=await versionChain(head,String(s.school_id)),selected=chain.find(x=>String(x.id)===versionId);if(!selected)return json({error:'الإصدار المطلوب لا ينتمي إلى سجل إصدارات هذا الملف'},409);
      const down=await sb.storage.from(selected.bucket_name||'school-platform-files').download(selected.storage_path);if(down.error||!down.data)throw down.error||new Error('تعذر قراءة الإصدار المطلوب');const bytes=new Uint8Array(await down.data.arrayBuffer());const restored=await insertVersion(head,bytes,String(s.user_id),{workspaceProvider:'version_restore',workspaceEditedBy:String(s.user_id),workspaceEditedAt:nowIso,workspaceRestoredFrom:selected.id,workspaceRestoreNote:String(body.note||'').slice(0,500)});await event(String(s.school_id),String(s.user_id),'workspace_version_restored',restored,{old_values:{file_id:head.id,version_number:head.version_number},new_values:{file_id:restored.id,version_number:restored.version_number,restored_from:selected.id}});return json({file:restored});
    }
    if(action==='close-session'){
      const id=String(body.sessionId||'');if(!isUuid(id))return json({error:'جلسة غير صالحة'},400);const {data:sess}=await sb.from('document_workspace_sessions').select('*').eq('id',id).eq('school_id',s.school_id).eq('user_id',s.user_id).maybeSingle();if(!sess)return json({error:'الجلسة غير موجودة'},404);if(sess.status==='active')await sb.from('document_workspace_sessions').update({status:'closed',closed_at:nowIso,updated_at:nowIso}).eq('id',id);return json({ok:true});
    }
    return json({error:'عملية غير مدعومة'},400);
  }catch(e){console.error('[platform-document-workspace]',e);return json({error:e instanceof Error?e.message:String(e)},500)}
});
