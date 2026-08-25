import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const sha256Bytes=async(v:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',v))).map(x=>x.toString(16).padStart(2,'0')).join('');
const decodeSignature=(data:any)=>{const x=String(data||'');const m=x.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);if(!m)throw new Error('صيغة التوقيع غير صالحة');if(m[2].length>2800000)throw new Error('حجم صورة التوقيع كبير جدًا');const raw=atob(m[2]),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return{bytes,mime:'image/'+m[1].toLowerCase(),ext:m[1].toLowerCase()==='jpeg'?'jpg':m[1].toLowerCase()}};
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
const ownerRoles=new Set(['manager','owner','school_manager','principal','agent','deputy','deputy_admin','deputy_academic','deputy_students','مدير','مديرة','وكيل']);
const managerRoles=new Set(['manager','owner','school_manager','principal','مدير','مديرة']);
const safe=(v:unknown,n=500)=>String(v??'').trim().slice(0,n);const safeUrl=(v:unknown)=>{const x=safe(v,1200);if(!x)return '';return /^(https?:\/\/|[./?#]|[a-zA-Z0-9_-]+\.html(?:[?#]|$))/i.test(x)?x:''};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)return json({error:'إعدادات المراسلات غير مكتملة'},500);
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const raw=req.headers.get('x-platform-session')||'';if(!raw)return json({error:'جلسة المنصة مفقودة'},401);
  const now=new Date().toISOString(),hash=await sha256(raw);
  const {data:s,error:se}=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();if(se)throw se;if(!s)return json({error:'انتهت جلسة المنصة'},401);
  const schoolId=String(s.school_id||''),userId=String(s.user_id||''),role=String(s.role||''),email=String(s.user_email||'').trim().toLowerCase(),isOwner=ownerRoles.has(role.toLowerCase())||ownerRoles.has(role),isManager=managerRoles.has(role.toLowerCase())||managerRoles.has(role);
  const action=new URL(req.url).searchParams.get('action')||'inbox',body=req.method==='POST'?await req.json().catch(()=>({})):{};
  const recipientQuery=(messageId?:string,columns='*')=>{let q=sb.from('internal_message_recipients').select(columns).eq('school_id',schoolId);if(messageId)q=q.eq('message_id',messageId);return isUuid(userId)?q.eq('recipient_user_id',userId):q.eq('recipient_email',email)};
  const canAccess=async(id:string)=>{const {data:m}=await sb.from('internal_messages').select('*').eq('school_id',schoolId).eq('id',id).maybeSingle();if(!m)return {m:null,r:null};const {data:r}=await recipientQuery(id).maybeSingle();return {m,r};};
  if(action==='users'){
   const {data,error}=await sb.from('users').select('id,email,full_name,role,status').eq('school_id',schoolId).order('full_name');if(error)throw error;
   const users=(data||[]).filter((u:any)=>String(u.status||'active')!=='deleted');const counts:any={};users.forEach((u:any)=>{const k=String(u.role||'user');counts[k]=(counts[k]||0)+1});return json({users,roleCounts:counts,current:{id:userId,role,email},permissions:{groupSend:isOwner,allSchool:isManager,official:isOwner,convertTask:isOwner}});
  }
  if(action==='send'){
   const direct=Array.isArray(body.recipientIds)?body.recipientIds.filter(isUuid):[],roles=Array.isArray(body.recipientRoles)?body.recipientRoles.map((x:any)=>safe(x,80)).filter(Boolean):[];
   if((roles.length||body.allSchool)&&!isOwner)return json({error:'الإرسال إلى فئة كاملة متاح للمدير والوكيل فقط'},403);if(body.allSchool&&!isManager)return json({error:'الإرسال إلى جميع المنسوبين متاح لمدير المدرسة فقط'},403);
   if(!body.allSchool&&!roles.length&&!direct.length)return json({error:'اختر مستلمًا واحدًا على الأقل'},400);
   const {data:rawTargets,error:ue}=await sb.from('users').select('id,email,full_name,role,status').eq('school_id',schoolId);if(ue)throw ue;
   let targets=(rawTargets||[]).filter((u:any)=>String(u.status||'active')!=='deleted'&&(body.allSchool||direct.includes(String(u.id))||roles.includes(String(u.role||''))));targets=[...new Map(targets.map((u:any)=>[String(u.id),u])).values()];if(!targets.length)return json({error:'لم يتم العثور على مستلمين مطابقين داخل المدرسة'},400);if(!isOwner&&targets.length>20)return json({error:'يمكن للمستخدم إرسال الرسالة إلى 20 مستلمًا كحد أقصى'},400);
   const subject=safe(body.subject,300),text=safe(body.body,20000);if(!subject||!text)return json({error:'العنوان ونص الرسالة مطلوبان'},400);
   const type=['message','official','notice','action_request'].includes(String(body.messageType))?String(body.messageType):'message';if(type==='official'&&!isOwner)return json({error:'التعميم الرسمي متاح للمدير والوكيل فقط'},403);
   const mid=crypto.randomUUID(),thread=isUuid(body.threadId)?String(body.threadId):mid;
   let ackMode=['none','read_receipt','signature'].includes(String(body.acknowledgementMode))?String(body.acknowledgementMode):(Boolean(body.requireAck)?'signature':'none');
   if(ackMode==='signature'&&!isOwner&&type!=='action_request')return json({error:'طلب الإقرار بالعلم والتوقيع متاح للمدير والوكيل أو لطلبات الإجراء فقط'},403);
   if(type==='official'&&ackMode==='none')ackMode='signature';
   const requireAck=ackMode==='signature';
   const linked=body.linked||{};const row:any={id:mid,school_id:schoolId,sender_user_id:isUuid(userId)?userId:null,sender_name:safe(body.senderName||s.user_name||email||'مستخدم',200),sender_role:role,subject,body:text,priority:['important','urgent'].includes(String(body.priority))?String(body.priority):'normal',message_type:type,require_ack:requireAck,acknowledgement_mode:ackMode,due_at:body.dueAt||null,thread_id:thread,parent_message_id:isUuid(body.parentMessageId)?body.parentMessageId:null,linked_module:safe(linked.module,120)||null,linked_record_type:safe(linked.recordType,120)||null,linked_record_id:safe(linked.recordId,240)||null,linked_title:safe(linked.title,500)||null,linked_url:safeUrl(linked.url)||null,metadata:body.metadata||{}};
   const {error:me}=await sb.from('internal_messages').insert(row);if(me)throw me;
   const recs=targets.map((u:any)=>({school_id:schoolId,message_id:mid,recipient_user_id:u.id,recipient_email:String(u.email||'').toLowerCase()||null,recipient_name:u.full_name||u.email||'',recipient_role:u.role||''}));if(recs.length){const {error}=await sb.from('internal_message_recipients').insert(recs);if(error)throw error;}
   const att=Array.isArray(body.attachments)?body.attachments.slice(0,15):[];if(att.length){const ids=att.map((a:any)=>a.fileId).filter(isUuid);if(ids.length){const {data:fs,error:fe}=await sb.from('platform_files').select('id,school_id,ownership_scope,owner_user_id,uploaded_by,display_name,original_name,mime_type,file_size,status,bucket_name,storage_path').eq('school_id',schoolId).in('id',ids);if(fe)throw fe;const fmap:Map<string,any>=new Map((fs||[]).filter((f:any)=>f.status==='active').map((f:any)=>[String(f.id),f]));const rows=[];for(const a of att){
    const f=fmap.get(String(a.fileId));if(!f)continue;
    const senderCanAttach=String(f.school_id)===schoolId&&(String(f.ownership_scope)==='school'||String(f.owner_user_id||'')===userId||isManager);
    if(!senderCanAttach)throw new Error('لا توجد صلاحية لإرفاق أحد الملفات المحددة');
    rows.push({school_id:schoolId,message_id:mid,file_id:f.id,file_name:f.display_name||f.original_name||'مرفق',mime_type:f.mime_type||null,file_size:Number(f.file_size||0),source:a.source==='library'?'library':'device'});
    const linkKey={school_id:schoolId,file_id:f.id,module_key:'internal_messages',record_type:'internal_message',record_id:mid,relation_type:'attachment'};
    const {data:existingLinks,error:linkFindError}=await sb.from('platform_file_links').select('id,deleted_at').match(linkKey).order('created_at',{ascending:false}).limit(1);
    if(linkFindError)throw linkFindError;
    const existingLink=(existingLinks||[])[0]||null;
    const linkedBy=isUuid(userId)?userId:f.uploaded_by;
    if(!linkedBy)throw new Error('تعذر تحديد مالك ربط المرفق');
    if(existingLink){
      const {error:linkRestoreError}=await sb.from('platform_file_links').update({deleted_at:null,linked_by:linkedBy,is_primary:false,metadata:{source:a.source||'device'}}).eq('id',existingLink.id);
      if(linkRestoreError)throw linkRestoreError;
    }else{
      const {error:linkInsertError}=await sb.from('platform_file_links').insert({...linkKey,linked_by:linkedBy,is_primary:false,metadata:{source:a.source||'device'}});
      if(linkInsertError)throw linkInsertError;
    }
   }if(rows.length){const {error:ae}=await sb.from('internal_message_attachments').insert(rows);if(ae)throw ae;}}}
   return json({ok:true,messageId:mid,recipientCount:recs.length});
  }
  if(action==='attachment-url'){
   const messageId=safe(body.messageId,60),fileId=safe(body.fileId,60);
   if(!isUuid(messageId)||!isUuid(fileId))return json({error:'معرف المرفق أو الرسالة غير صالح'},400);
   const {m,r}=await canAccess(messageId);
   if(!m||(!r&&String(m.sender_user_id)!==userId))return json({error:'لا توجد صلاحية لفتح مرفق هذه الرسالة'},403);
   const {data:a,error:ae}=await sb.from('internal_message_attachments').select('id,file_id,file_name,mime_type,file_size').eq('school_id',schoolId).eq('message_id',messageId).eq('file_id',fileId).maybeSingle();
   if(ae)throw ae;if(!a)return json({error:'المرفق غير مرتبط بهذه الرسالة'},404);
   const {data:f,error:fe}=await sb.from('platform_files').select('id,bucket_name,storage_path,status,display_name,original_name,mime_type').eq('school_id',schoolId).eq('id',fileId).maybeSingle();
   if(fe)throw fe;if(!f)return json({error:'ملف المرفق غير موجود'},404);if(String(f.status)!=='active')return json({error:'ملف المرفق غير متاح'},409);
   const signed=await sb.storage.from(f.bucket_name).createSignedUrl(f.storage_path,300);
   if(signed.error)throw signed.error;
   return json({ok:true,signedUrl:signed.data.signedUrl,fileName:a.file_name||f.display_name||f.original_name||'مرفق',mimeType:a.mime_type||f.mime_type||null,expiresIn:300});
  }
  if(action==='read'){
   const id=safe(body.messageId,60);if(!isUuid(id))return json({error:'معرف الرسالة غير صالح'},400);const {m,r}=await canAccess(id);if(!m||(!r&&String(m.sender_user_id)!==userId))return json({error:'لا توجد صلاحية لقراءة الرسالة'},403);if(r&&!r.read_at)await sb.from('internal_message_recipients').update({read_at:now}).eq('id',r.id);
   const [{data:rec},{data:att},{data:threadRaw},{data:myRecRows}]=await Promise.all([sb.from('internal_message_recipients').select('recipient_user_id,recipient_name,recipient_role,read_at,acknowledged_at,action_status,signature_storage_path,signature_hash,signature_mime_type,signed_at,acknowledgement_metadata').eq('school_id',schoolId).eq('message_id',id),sb.from('internal_message_attachments').select('*').eq('school_id',schoolId).eq('message_id',id),sb.from('internal_messages').select('id,sender_user_id,sender_name,sender_role,subject,body,priority,message_type,require_ack,due_at,created_at,parent_message_id').eq('school_id',schoolId).eq('thread_id',m.thread_id||m.id).order('created_at'),recipientQuery(undefined,'message_id')]);
   const myIds=new Set((myRecRows||[]).map((x:any)=>String(x.message_id)));const thread=(threadRaw||[]).filter((x:any)=>String(x.sender_user_id)===userId||myIds.has(String(x.id)));
   return json({message:m,recipientState:r?{...r,read_at:r.read_at||now}:null,recipients:rec||[],attachments:att||[],thread});
  }
  if(action==='list'||action==='inbox'||action==='archive'||action==='pinned'){
   let rq=recipientQuery(undefined,'message_id,read_at,acknowledged_at,action_status,pinned_at,archived_at,created_at,internal_messages(*)');if(action==='archive'||body.box==='archive')rq=rq.not('archived_at','is',null);else rq=rq.is('archived_at',null);if(action==='pinned'||body.box==='pinned')rq=rq.not('pinned_at','is',null);
   const {data,error}=await rq.order('pinned_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(150);if(error)throw error;const rows=data||[];return json({messages:rows.map((r:any)=>({...r.internal_messages,read_at:r.read_at,acknowledged_at:r.acknowledged_at,action_status:r.action_status,pinned_at:r.pinned_at,recipient_archived_at:r.archived_at})),unread:rows.filter((r:any)=>!r.read_at).length});
  }
  if(action==='sent'){
   const {data,error}=await sb.from('internal_messages').select('*,internal_message_recipients(recipient_user_id,recipient_name,recipient_role,read_at,acknowledged_at,action_status,signed_at),internal_message_attachments(id,file_id,file_name,mime_type,file_size,source)').eq('school_id',schoolId).eq('sender_user_id',userId).order('created_at',{ascending:false}).limit(150);if(error)throw error;return json({messages:(data||[]).map((m:any)=>{const rr=m.internal_message_recipients||[];return {...m,read_count:rr.filter((x:any)=>x.read_at).length,ack_count:rr.filter((x:any)=>x.acknowledged_at).length,recipient_count:rr.length}})});
  }
  if(['archive-message','unarchive-message','pin','unpin','acknowledge','mark-unread','action-status'].includes(action)){
   const id=safe(body.messageId,60);if(!isUuid(id))return json({error:'معرف الرسالة غير صالح'},400);const {m,r}=await canAccess(id);if(!m||!r)return json({error:'الإجراء متاح للمستلم فقط'},403);const change:any={};
   if(action==='archive-message')change.archived_at=now;
   if(action==='unarchive-message')change.archived_at=null;
   if(action==='pin')change.pinned_at=now;
   if(action==='unpin')change.pinned_at=null;
   if(action==='mark-unread')change.read_at=null;
   if(action==='acknowledge'){
     const ackMode=String(m.acknowledgement_mode||((m.require_ack)?'signature':'none'));
     if(ackMode!=='signature'&&m.require_ack!==true)return json({error:'هذه الرسالة لا تتطلب توقيعًا بالعلم'},400);
     if(r.signed_at||r.acknowledged_at)return json({ok:true,state:r,alreadySigned:true});
     const sig=decodeSignature(body.signatureData);
     const path=`${schoolId}/${m.id}/${r.id}-${crypto.randomUUID()}.${sig.ext}`;
     const up=await sb.storage.from('internal-message-signatures').upload(path,sig.bytes,{contentType:sig.mime,upsert:false,cacheControl:'31536000'});if(up.error)throw up.error;
     change.acknowledged_at=now;change.signed_at=now;change.read_at=r.read_at||now;change.signature_storage_path=path;change.signature_mime_type=sig.mime;change.signature_hash=await sha256Bytes(sig.bytes);change.acknowledgement_metadata={signed_via:'saved_digital_signature',user_agent:safe(req.headers.get('user-agent'),400),signed_at:now};
   }
   if(action==='action-status'){const st=['accepted','in_progress','done','declined'].includes(String(body.status))?String(body.status):'none';change.action_status=st;change.action_note=safe(body.note,1000)||null;change.read_at=r.read_at||now;}
   const {error}=await sb.from('internal_message_recipients').update(change).eq('id',r.id);if(error)throw error;return json({ok:true,state:{...r,...change}});
  }
  if(action==='ack-register'){
   const id=safe(body.messageId,60);if(!isUuid(id))return json({error:'معرف الرسالة غير صالح'},400);
   const {data:m,error:me}=await sb.from('internal_messages').select('*').eq('school_id',schoolId).eq('id',id).maybeSingle();if(me)throw me;if(!m)return json({error:'الرسالة غير موجودة'},404);
   if(String(m.sender_user_id||'')!==userId&&!isOwner)return json({error:'كشف العلم والتوقيع متاح لمرسل الخطاب أو إدارة المدرسة فقط'},403);
   const {data:rows,error:re}=await sb.from('internal_message_recipients').select('recipient_user_id,recipient_name,recipient_role,read_at,acknowledged_at,signed_at,signature_storage_path,signature_hash,signature_mime_type,action_status').eq('school_id',schoolId).eq('message_id',id).order('recipient_name');if(re)throw re;
   const recipients=[];for(const x of rows||[]){let signatureUrl=null;if(x.signature_storage_path){const su=await sb.storage.from('internal-message-signatures').createSignedUrl(x.signature_storage_path,300);if(!su.error)signatureUrl=su.data.signedUrl}recipients.push({...x,signature_url:signatureUrl})}
   return json({ok:true,message:m,recipients,summary:{total:recipients.length,read:recipients.filter((x:any)=>x.read_at).length,signed:recipients.filter((x:any)=>x.signed_at||x.acknowledged_at).length}});
  }
  if(action==='mark-converted'){
   if(!isOwner)return json({error:'تحويل الرسالة إلى تكليف متاح للمدير والوكيل فقط'},403);const id=safe(body.messageId,60),taskId=safe(body.taskId,60);if(!isUuid(id)||!isUuid(taskId))return json({error:'المعرف غير صالح'},400);const {m,r}=await canAccess(id);if(!m||(!r&&String(m.sender_user_id)!==userId))return json({error:'لا توجد صلاحية'},403);const {error}=await sb.from('internal_messages').update({converted_task_id:taskId}).eq('id',id).eq('school_id',schoolId);if(error)throw error;return json({ok:true});
  }
  if(action==='stats'){
   const {data:mine}=await recipientQuery(undefined,'read_at,acknowledged_at,archived_at,pinned_at');const {data:sent}=await sb.from('internal_messages').select('id').eq('school_id',schoolId).eq('sender_user_id',userId);return json({inbox:(mine||[]).filter((x:any)=>!x.archived_at).length,unread:(mine||[]).filter((x:any)=>!x.archived_at&&!x.read_at).length,pinned:(mine||[]).filter((x:any)=>!x.archived_at&&x.pinned_at).length,archive:(mine||[]).filter((x:any)=>x.archived_at).length,sent:(sent||[]).length});
  }
  return json({error:'عملية مراسلات غير مدعومة'},400);
 }catch(e){console.error('[platform-messages]',e);return json({error:e instanceof Error?e.message:String(e)},500)}
});
