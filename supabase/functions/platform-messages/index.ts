import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return json({error:'إعدادات المراسلات غير مكتملة'},500);
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const raw=req.headers.get('x-platform-session')||''; if(!raw)return json({error:'جلسة المنصة مفقودة'},401);
  const hash=await sha256(raw),now=new Date().toISOString();
  const {data:s,error:se}=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();
  if(se)throw se;if(!s)return json({error:'انتهت جلسة المنصة'},401);
  const schoolId=s.school_id,userId=s.user_id,role=String(s.role||''),email=String(s.user_email||'').toLowerCase();
  const action=new URL(req.url).searchParams.get('action')||'inbox';
  const body=req.method==='POST'?await req.json().catch(()=>({})):{};
  if(action==='users'){
    const {data,error}=await sb.from('users').select('id,email,full_name,role,status').eq('school_id',schoolId).order('full_name');
    if(error)throw error;return json({users:(data||[]).filter((u:any)=>String(u.status||'active')!=='deleted')});
  }
  if(action==='send'){
    const ids=Array.isArray(body.recipientIds)?body.recipientIds.filter(isUuid):[];
    if(!ids.length)return json({error:'اختر مستلمًا واحدًا على الأقل'},400);
    const {data:targets,error:ue}=await sb.from('users').select('id,email,full_name,role').eq('school_id',schoolId).in('id',ids);if(ue)throw ue;
    const subject=String(body.subject||'').trim(),text=String(body.body||'').trim();if(!subject||!text)return json({error:'العنوان ونص الرسالة مطلوبان'},400);
    const mid=crypto.randomUUID(),thread=isUuid(body.threadId)?body.threadId:mid;
    const senderName=String(body.senderName||s.user_name||email||'مستخدم');
    const {error:me}=await sb.from('internal_messages').insert({id:mid,school_id:schoolId,sender_user_id:isUuid(userId)?userId:null,sender_name:senderName,sender_role:role,subject,body:text,priority:['important','urgent'].includes(body.priority)?body.priority:'normal',thread_id:thread,parent_message_id:isUuid(body.parentMessageId)?body.parentMessageId:null});if(me)throw me;
    const rows=(targets||[]).map((u:any)=>({school_id:schoolId,message_id:mid,recipient_user_id:u.id,recipient_email:String(u.email||'').toLowerCase()||null,recipient_name:u.full_name||u.email||'',recipient_role:u.role||''}));
    if(rows.length){const {error}=await sb.from('internal_message_recipients').insert(rows);if(error)throw error;}
    return json({ok:true,messageId:mid,recipientCount:rows.length});
  }
  if(action==='read'){
    const id=String(body.messageId||'');if(!isUuid(id))return json({error:'معرف الرسالة غير صالح'},400);
    let rq=sb.from('internal_message_recipients').select('id').eq('school_id',schoolId).eq('message_id',id);
    rq=isUuid(userId)?rq.eq('recipient_user_id',userId):rq.eq('recipient_email',email);
    const {data:r}=await rq.maybeSingle();
    const {data:m}=await sb.from('internal_messages').select('*').eq('school_id',schoolId).eq('id',id).maybeSingle();
    if(!m||(!r&&String(m.sender_user_id)!==String(userId)))return json({error:'لا توجد صلاحية لقراءة الرسالة'},403);
    if(r)await sb.from('internal_message_recipients').update({read_at:now}).eq('id',r.id);
    const {data:rec}=await sb.from('internal_message_recipients').select('recipient_user_id,recipient_name,recipient_role,read_at').eq('school_id',schoolId).eq('message_id',id);
    return json({message:m,recipients:rec||[]});
  }
  if(action==='sent'){
    const {data,error}=await sb.from('internal_messages').select('*,internal_message_recipients(recipient_name,recipient_role,read_at)').eq('school_id',schoolId).eq('sender_user_id',userId).order('created_at',{ascending:false}).limit(100);
    if(error)throw error;return json({messages:data||[]});
  }
  // inbox
  let rq=sb.from('internal_message_recipients').select('message_id,read_at,archived_at,internal_messages(*)').eq('school_id',schoolId).is('archived_at',null);
  rq=isUuid(userId)?rq.eq('recipient_user_id',userId):rq.eq('recipient_email',email);
  const {data,error}=await rq.order('created_at',{ascending:false}).limit(100);if(error)throw error;
  return json({messages:(data||[]).map((r:any)=>({...r.internal_messages,read_at:r.read_at})),unread:(data||[]).filter((r:any)=>!r.read_at).length});
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:String(e)},500)}
});