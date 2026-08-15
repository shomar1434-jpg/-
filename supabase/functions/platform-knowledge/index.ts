import { createClient } from 'npm:@supabase/supabase-js@2';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8'};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Cache-Control':'no-store'}});
const txt=(v:any)=>String(v??'').trim();
const gateway='https://mfzsgaqxvxusayoribfo.supabase.co/functions/v1/ASK-AI';
const vec=(a:number[])=>'['+a.map(n=>Number(n).toFixed(8)).join(',')+']';
async function embeddings(inputs:string[]){const clean=inputs.map(x=>txt(x)).filter(Boolean);if(!clean.length)return[];const r=await fetch(gateway,{method:'POST',headers:{'content-type':'application/json','x-agent-source':'school-platform-v2'},body:JSON.stringify({mode:'embeddings',input:clean})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||d?.error||d?.message||'تعذر إنشاء الفهرس الدلالي');return(d.data||[]).sort((a:any,b:any)=>a.index-b.index).map((x:any)=>x.embedding as number[])}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const requestId=crypto.randomUUID();const now=new Date().toISOString();
 try{
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!service||!anon)return json({error:'إعدادات Supabase غير مكتملة',requestId},500);
  const token=txt((req.headers.get('authorization')||'').replace(/^Bearer\s+/i,''));if(!token)return json({error:'يلزم تسجيل دخول مدير النظام',requestId},401);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const ur=await auth.auth.getUser(token);const user=ur.data?.user;if(ur.error||!user)return json({error:'جلسة مدير النظام غير صالحة',requestId},401);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});const allowed=await admin.from('system_admins').select('user_id,email,is_active').eq('user_id',user.id).eq('is_active',true).maybeSingle();if(allowed.error||!allowed.data)return json({error:'هذه العملية متاحة لمدير النظام فقط',requestId},403);
  const body=await req.json().catch(()=>({}));const action=txt(body.action);
  const audit=async(event:string,documentId?:string,details:any={})=>{try{await admin.from('knowledge_audit_log').insert({actor_user_id:user.id,action:event,document_id:documentId||null,details:{...details,requestId}})}catch(_){}};

  if(action==='list'){const q=await admin.from('knowledge_documents').select('id,title,category,authority,version_label,issue_date,effective_date,status,replaces_document_id,original_name,mime_type,file_size,page_count,chunk_count,storage_path,created_at,updated_at').order('updated_at',{ascending:false}).limit(500);if(q.error)throw q.error;return json({ok:true,documents:q.data||[],requestId})}


  if(action==='begin_ingest'){
   const d=body.document||{};const title=txt(d.title),storagePath=txt(d.storagePath),originalName=txt(d.originalName);
   if(!title||!storagePath||!originalName)return json({error:'بيانات الدليل غير مكتملة',stage:'begin',requestId},400);
   const folder=storagePath.split('/').slice(0,-1).join('/'),fileName=storagePath.split('/').pop();
   const obj=await admin.storage.from('regulatory-knowledge').list(folder,{search:fileName,limit:10});
   if(obj.error)throw obj.error;if(!(obj.data||[]).some((x:any)=>x.name===fileName))return json({error:'لم يتم العثور على الملف بعد رفعه إلى التخزين',stage:'storage_verify',requestId},400);
   if(d.sourceHash){const ex=await admin.from('knowledge_documents').select('id,title,status,chunk_count').eq('source_hash',txt(d.sourceHash)).maybeSingle();if(ex.data)return json({ok:true,duplicate:true,document:ex.data,requestId})}
   const row:any={title,category:txt(d.category)||'عام',authority:txt(d.authority)||'وزارة التعليم',version_label:txt(d.versionLabel)||null,issue_date:d.issueDate||null,effective_date:d.effectiveDate||null,status:'draft',replaces_document_id:d.replacesDocumentId||null,storage_bucket:'regulatory-knowledge',storage_path:storagePath,original_name:originalName,mime_type:txt(d.mimeType)||null,file_size:Number(d.fileSize||0)||null,page_count:Number(d.pageCount||0),chunk_count:0,source_hash:txt(d.sourceHash)||null,metadata:{...(d.metadata||{}),indexing_state:'processing',indexing_started_at:now},uploaded_by:user.id};
   const ins=await admin.from('knowledge_documents').insert(row).select('*').single();if(ins.error)throw ins.error;
   await audit('knowledge.begin_ingest',ins.data.id,{title});
   return json({ok:true,document:ins.data,requestId});
  }

  if(action==='ingest_batch'){
   const documentId=txt(body.documentId),chunks=Array.isArray(body.chunks)?body.chunks:[];
   if(!documentId||!chunks.length)return json({error:'دفعة الفهرسة فارغة',stage:'batch',requestId},400);
   if(chunks.length>32)return json({error:'حجم دفعة الفهرسة أكبر من الحد المسموح (32 مقطعًا)',stage:'batch',requestId},413);
   const dq=await admin.from('knowledge_documents').select('id,status,chunk_count,metadata').eq('id',documentId).maybeSingle();if(dq.error)throw dq.error;if(!dq.data)return json({error:'سجل الدليل غير موجود',stage:'batch',requestId},404);
   const clean=chunks.map((x:any)=>({...x,content:txt(x.content).slice(0,8000)})).filter((x:any)=>x.content);
   if(!clean.length)return json({error:'لا تحتوي الدفعة على نص صالح',stage:'batch',requestId},400);
   const embs=await embeddings(clean.map((x:any)=>x.content));if(embs.length!==clean.length)return json({error:'عدد المتجهات لا يطابق عدد المقاطع',stage:'embedding',requestId},502);
   const rows=clean.map((x:any,j:number)=>({document_id:documentId,chunk_index:Number(x.chunkIndex),page_start:x.pageStart||null,page_end:x.pageEnd||x.pageStart||null,heading:txt(x.heading)||null,content:x.content,embedding:vec(embs[j]),metadata:x.metadata||{}}));
   const iq=await admin.from('knowledge_chunks').upsert(rows,{onConflict:'document_id,chunk_index'});if(iq.error)throw iq.error;
   const cq=await admin.from('knowledge_chunks').select('id',{count:'exact',head:true}).eq('document_id',documentId);if(cq.error)throw cq.error;
   const indexed=Number(cq.count||0);
   await admin.from('knowledge_documents').update({chunk_count:indexed,updated_at:now,metadata:{...(dq.data.metadata||{}),indexing_state:'processing',last_batch_at:now}}).eq('id',documentId);
   return json({ok:true,indexedChunks:indexed,batchChunks:rows.length,requestId});
  }

  if(action==='finalize_ingest'){
   const documentId=txt(body.documentId),wantedStatus=body.status==='draft'?'draft':'active';
   const dq=await admin.from('knowledge_documents').select('*').eq('id',documentId).maybeSingle();if(dq.error)throw dq.error;if(!dq.data)return json({error:'سجل الدليل غير موجود',stage:'finalize',requestId},404);
   const cq=await admin.from('knowledge_chunks').select('id',{count:'exact',head:true}).eq('document_id',documentId);if(cq.error)throw cq.error;const indexed=Number(cq.count||0);
   if(!indexed)return json({error:'لم يتم إنشاء أي مقطع معرفي للدليل',stage:'finalize',requestId},400);
   if(dq.data.replaces_document_id)await admin.from('knowledge_documents').update({status:'superseded',updated_at:now}).eq('id',dq.data.replaces_document_id);
   const meta={...(dq.data.metadata||{}),indexing_state:'complete',indexing_completed_at:now};
   const up=await admin.from('knowledge_documents').update({status:wantedStatus,chunk_count:indexed,metadata:meta,updated_at:now}).eq('id',documentId).select('*').single();if(up.error)throw up.error;
   await audit('knowledge.finalize_ingest',documentId,{chunks:indexed,title:dq.data.title});
   return json({ok:true,document:up.data,indexedChunks:indexed,requestId});
  }

  if(action==='abort_ingest'){
   const documentId=txt(body.documentId);if(!documentId)return json({ok:true,requestId});
   const dq=await admin.from('knowledge_documents').select('id,title,metadata').eq('id',documentId).maybeSingle();
   if(dq.data){await admin.from('knowledge_chunks').delete().eq('document_id',documentId);await admin.from('knowledge_documents').update({status:'draft',chunk_count:0,metadata:{...(dq.data.metadata||{}),indexing_state:'failed',indexing_error:txt(body.error)||'unknown',indexing_failed_at:now},updated_at:now}).eq('id',documentId);await audit('knowledge.abort_ingest',documentId,{error:txt(body.error)})}
   return json({ok:true,requestId});
  }

  if(action==='ingest'){
   const d=body.document||{},chunks=Array.isArray(body.chunks)?body.chunks:[];const title=txt(d.title),storagePath=txt(d.storagePath),originalName=txt(d.originalName);
   if(!title||!storagePath||!originalName||!chunks.length)return json({error:'بيانات الدليل أو النص المستخرج غير مكتملة',requestId},400);
   if(chunks.length>1400)return json({error:'الدليل كبير جدًا للمعالجة في عملية واحدة. الحد الحالي 1400 مقطع.',requestId},413);
   const folder=storagePath.split('/').slice(0,-1).join('/'),fileName=storagePath.split('/').pop();const obj=await admin.storage.from('regulatory-knowledge').list(folder,{search:fileName,limit:10});if(obj.error)throw obj.error;if(!(obj.data||[]).some((x:any)=>x.name===fileName))return json({error:'لم يتم العثور على الملف المرفوع في التخزين',requestId},400);
   if(d.sourceHash){const ex=await admin.from('knowledge_documents').select('id,title,status').eq('source_hash',txt(d.sourceHash)).maybeSingle();if(ex.data)return json({error:'هذا الدليل مرفوع مسبقًا',duplicate:ex.data,requestId},409)}
   const row:any={title,category:txt(d.category)||'عام',authority:txt(d.authority)||'وزارة التعليم',version_label:txt(d.versionLabel)||null,issue_date:d.issueDate||null,effective_date:d.effectiveDate||null,status:'draft',replaces_document_id:d.replacesDocumentId||null,storage_bucket:'regulatory-knowledge',storage_path:storagePath,original_name:originalName,mime_type:txt(d.mimeType)||null,file_size:Number(d.fileSize||0)||null,page_count:Number(d.pageCount||0),source_hash:txt(d.sourceHash)||null,metadata:d.metadata||{},uploaded_by:user.id};
   const ins=await admin.from('knowledge_documents').insert(row).select('*').single();if(ins.error)throw ins.error;const doc=ins.data;
   try{
    let indexed=0;for(let i=0;i<chunks.length;i+=48){const batch=chunks.slice(i,i+48),embs=await embeddings(batch.map((x:any)=>txt(x.content)));if(embs.length!==batch.length)throw new Error('عدد المتجهات لا يطابق عدد المقاطع');const rows=batch.map((x:any,j:number)=>({document_id:doc.id,chunk_index:Number(x.chunkIndex??i+j),page_start:x.pageStart||null,page_end:x.pageEnd||x.pageStart||null,heading:txt(x.heading)||null,content:txt(x.content).slice(0,8000),embedding:vec(embs[j]),metadata:x.metadata||{}}));const iq=await admin.from('knowledge_chunks').insert(rows);if(iq.error)throw iq.error;indexed+=rows.length}
    if(d.replacesDocumentId)await admin.from('knowledge_documents').update({status:'superseded',updated_at:new Date().toISOString()}).eq('id',d.replacesDocumentId);
    const up=await admin.from('knowledge_documents').update({status:d.status==='draft'?'draft':'active',chunk_count:indexed,updated_at:new Date().toISOString()}).eq('id',doc.id).select('*').single();if(up.error)throw up.error;await audit('knowledge.ingest',doc.id,{chunks:indexed,title});return json({ok:true,document:up.data,indexedChunks:indexed,requestId});
   }catch(e){await admin.from('knowledge_chunks').delete().eq('document_id',doc.id);await admin.from('knowledge_documents').update({status:'draft',metadata:{...(doc.metadata||{}),indexing_error:String((e as any)?.message||e)},updated_at:new Date().toISOString()}).eq('id',doc.id);throw e}
  }

  if(action==='set_status'){const id=txt(body.id),status=txt(body.status);if(!id||!['draft','active','superseded','archived'].includes(status))return json({error:'طلب غير صالح',requestId},400);const q=await admin.from('knowledge_documents').update({status,updated_at:new Date().toISOString()}).eq('id',id).select('*').single();if(q.error)throw q.error;await audit('knowledge.status',id,{status});return json({ok:true,document:q.data,requestId})}
  if(action==='delete'){const id=txt(body.id);const q=await admin.from('knowledge_documents').select('id,storage_bucket,storage_path,title').eq('id',id).maybeSingle();if(q.error)throw q.error;if(!q.data)return json({error:'الدليل غير موجود',requestId},404);const rm=await admin.storage.from(q.data.storage_bucket||'regulatory-knowledge').remove([q.data.storage_path]);if(rm.error)throw rm.error;const del=await admin.from('knowledge_documents').delete().eq('id',id);if(del.error)throw del.error;await audit('knowledge.delete',id,{title:q.data.title});return json({ok:true,requestId})}
  if(action==='signed_url'){const id=txt(body.id);const q=await admin.from('knowledge_documents').select('storage_bucket,storage_path').eq('id',id).maybeSingle();if(q.error||!q.data)return json({error:'الدليل غير موجود',requestId},404);const su=await admin.storage.from(q.data.storage_bucket).createSignedUrl(q.data.storage_path,300);if(su.error)throw su.error;return json({ok:true,url:su.data.signedUrl,requestId})}
  if(action==='search_test'){const query=txt(body.query);if(!query)return json({error:'اكتب عبارة البحث',requestId},400);const e=await embeddings([query]);const r=await admin.rpc('match_knowledge_chunks',{query_embedding:vec(e[0]),match_threshold:Number(body.threshold||.22),match_count:Number(body.limit||8),category_filter:body.category||null});if(r.error)throw r.error;await audit('knowledge.search_test',undefined,{query,count:(r.data||[]).length});return json({ok:true,results:r.data||[],requestId})}
  return json({error:'عملية غير مدعومة',requestId},400);
 }catch(e){console.error('[platform-knowledge]',requestId,e);return json({error:e instanceof Error?e.message:String(e),requestId},500)}
});
