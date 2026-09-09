import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type,x-platform-session','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const text=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n);
const low=(v:unknown)=>text(v).toLowerCase();
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const managerRoles=new Set(['manager','owner','school_manager','principal','leadership','مدير','مديرة','مدير المدرسة','مديرة المدرسة']);
function severityFor(eventType:string,body:any){const x=low(body?.severity);if(['normal','important','critical'].includes(x))return x;if(/delete|security|unauthorized|failed|rejected|رفض|حذف|أمني/i.test(eventType))return 'critical';if(/evidence|submit|approval|review|task|weekly|plan|اعتماد|شاهد|تكليف|خطة/i.test(eventType))return 'important';return 'normal';}
function labelFor(eventType:string){const map:Record<string,string>={'evidence.submitted':'وصول شاهد جديد','weekly_plan.started':'بدء تنفيذ أسبوع','weekly_plan.closed':'إغلاق أسبوع','task.completed':'إكمال مهمة','record_saved':'حفظ سجل','record_updated':'تحديث سجل'};return map[eventType]||eventType.replace(/[._-]+/g,' ');}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!service)return json({error:'ENV_MISSING'},500);
 const sb=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});const requestId=crypto.randomUUID();
 try{
  const action=text(new URL(req.url).searchParams.get('action')||'',80),body:any=await req.json().catch(()=>({}));
  const raw=text(req.headers.get('x-platform-session'),700);if(!raw)return json({error:'SESSION_MISSING',requestId},401);
  const h=await sha256(raw),now=new Date().toISOString();
  const ss=await sb.from('platform_sessions').select('*').eq('session_token_hash',h).eq('status','active').gt('expires_at',now).maybeSingle();if(ss.error)throw ss.error;const session:any=ss.data;if(!session)return json({error:'SESSION_INVALID',requestId},401);
  const schoolId=String(session.school_id||''),userId=String(session.user_id||''),role=low(session.role),isManager=managerRoles.has(role);
  const mem=await sb.from('school_members').select('user_id,role,status').eq('school_id',schoolId).eq('user_id',userId).eq('status','active');if(mem.error)throw mem.error;
  if(!isManager&&!(mem.data||[]).some((m:any)=>low(m.role)===role))return json({error:'MEMBERSHIP_INVALID',requestId},403);
  const own=async()=>{const q=await sb.from('users').select('id,full_name,email,role,mobile_number,mobile_verified').eq('id',userId).maybeSingle();if(q.error)throw q.error;return q.data||{};};
  const schoolSettings=async()=>{let q=await sb.from('school_notification_settings').select('*').eq('school_id',schoolId).maybeSingle();if(q.error)throw q.error;if(!q.data){const ins=await sb.from('school_notification_settings').insert({school_id:schoolId,push_enabled:true,important_only:true,updated_by:userId}).select('*').single();if(ins.error)throw ins.error;q=ins;}return q.data;};
  const pushConfigured=()=>Boolean(Deno.env.get('VAPID_PUBLIC_KEY')&&Deno.env.get('VAPID_PRIVATE_KEY')&&Deno.env.get('VAPID_SUBJECT'));
  const sendPush=async(recipientId:string,notification:any)=>{
    if(!pushConfigured())return {sent:0,failed:0,configured:false};
    const settings=await schoolSettings();if(settings.push_enabled===false)return {sent:0,failed:0,configured:true,disabled:true};
    const sq=await sb.from('push_subscriptions').select('*').eq('school_id',schoolId).eq('user_id',recipientId).eq('is_active',true);if(sq.error)throw sq.error;
    webpush.setVapidDetails(String(Deno.env.get('VAPID_SUBJECT')),String(Deno.env.get('VAPID_PUBLIC_KEY')),String(Deno.env.get('VAPID_PRIVATE_KEY')));
    const payload=JSON.stringify({title:notification.title,body:notification.body||'',url:notification.action_url||'manager.html',notificationId:notification.id,schoolId,severity:notification.severity,tag:'school-'+schoolId+'-'+notification.id,renotify:notification.severity==='critical',requireInteraction:notification.severity==='critical'});
    let sent=0,failed=0;
    for(const sub of sq.data||[]){try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);sent++;await sb.from('push_subscriptions').update({failure_count:0,last_error:null,last_seen_at:now,updated_at:now}).eq('id',sub.id);}catch(e:any){failed++;const status=Number(e?.statusCode||e?.status||0),dead=status===404||status===410;await sb.from('push_subscriptions').update({failure_count:Number(sub.failure_count||0)+1,last_error:text(e?.message||e,500),is_active:dead?false:sub.is_active,updated_at:now}).eq('id',sub.id);}}
    await sb.from('platform_notifications').update({push_sent_at:sent?now:null,push_attempts:Number(notification.push_attempts||0)+1}).eq('id',notification.id).eq('school_id',schoolId);
    return {sent,failed,configured:true};
  };

  if(action==='config'){if(!isManager)return json({error:'MANAGER_REQUIRED'},403);const s=await schoolSettings();return json({ok:true,vapidPublicKey:Deno.env.get('VAPID_PUBLIC_KEY')||'',pushConfigured:pushConfigured(),schoolPushEnabled:s.push_enabled!==false,importantOnly:s.important_only!==false,requestId});}
  if(action==='profile'){if(!isManager)return json({error:'MANAGER_REQUIRED'},403);const u=await own();return json({ok:true,profile:{user_id:u.id,full_name:u.full_name,email:u.email,mobile_number:u.mobile_number||'',mobile_verified:!!u.mobile_verified,school_id:schoolId},requestId});}
  if(action==='save-mobile'){
    if(!isManager)return json({error:'MANAGER_REQUIRED'},403);let mobile=text(body.mobileNumber,30).replace(/[\s()-]/g,'');if(/^05\d{8}$/.test(mobile))mobile='+966'+mobile.slice(1);if(/^9665\d{8}$/.test(mobile))mobile='+'+mobile;if(mobile&&!/^\+9665\d{8}$/.test(mobile))return json({error:'MOBILE_INVALID'},400);
    const up=await sb.from('users').update({mobile_number:mobile||null,mobile_verified:false,mobile_updated_at:now}).eq('id',userId).select('id,mobile_number,mobile_verified').maybeSingle();if(up.error)throw up.error;if(!up.data)return json({error:'USER_NOT_FOUND'},404);return json({ok:true,profile:up.data,requestId});
  }
  if(action==='set-school-push'){if(!isManager)return json({error:'MANAGER_REQUIRED'},403);const enabled=body.enabled!==false;const q=await sb.from('school_notification_settings').upsert({school_id:schoolId,push_enabled:enabled,updated_by:userId,updated_at:now},{onConflict:'school_id'}).select('*').single();if(q.error)throw q.error;return json({ok:true,settings:q.data,requestId});}
  if(action==='register-subscription'){
    if(!isManager)return json({error:'MANAGER_REQUIRED'},403);const sub=body.subscription||{},endpoint=text(sub.endpoint,3000),p256dh=text(sub.keys?.p256dh,1000),auth=text(sub.keys?.auth,1000);if(!endpoint||!p256dh||!auth)return json({error:'SUBSCRIPTION_INVALID'},400);
    const q=await sb.from('push_subscriptions').upsert({school_id:schoolId,user_id:userId,endpoint,p256dh,auth,device_name:text(body.deviceName,220),user_agent:text(req.headers.get('user-agent'),500),is_active:true,failure_count:0,last_error:null,last_seen_at:now,updated_at:now},{onConflict:'school_id,user_id,endpoint'}).select('id,school_id,user_id,device_name,is_active,last_seen_at').single();if(q.error)throw q.error;return json({ok:true,subscription:q.data,requestId});
  }
  if(action==='remove-subscription'){if(!isManager)return json({error:'MANAGER_REQUIRED'},403);const endpoint=text(body.endpoint,3000);if(!endpoint)return json({error:'ENDPOINT_REQUIRED'},400);const q=await sb.from('push_subscriptions').update({is_active:false,updated_at:now}).eq('school_id',schoolId).eq('user_id',userId).eq('endpoint',endpoint);if(q.error)throw q.error;return json({ok:true,requestId});}
  if(action==='list-notifications'){if(!isManager)return json({error:'MANAGER_REQUIRED'},403);const limit=Math.min(Math.max(Number(body.limit||50),1),100);const q=await sb.from('platform_notifications').select('*').eq('school_id',schoolId).eq('recipient_user_id',userId).order('created_at',{ascending:false}).limit(limit);if(q.error)throw q.error;return json({ok:true,notifications:q.data||[],requestId});}
  if(action==='list-events'){if(!isManager)return json({error:'MANAGER_REQUIRED'},403);const limit=Math.min(Math.max(Number(body.limit||60),1),120);const q=await sb.from('school_events').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}).limit(limit);if(q.error)throw q.error;return json({ok:true,events:q.data||[],requestId});}
  if(action==='mark-read'||action==='mark-all-read'){
    if(!isManager)return json({error:'MANAGER_REQUIRED'},403);let q;if(action==='mark-all-read')q=await sb.from('platform_notifications').update({read_at:now}).eq('school_id',schoolId).eq('recipient_user_id',userId).is('read_at',null);else q=await sb.from('platform_notifications').update({read_at:now}).eq('school_id',schoolId).eq('recipient_user_id',userId).eq('id',text(body.notificationId,100));if(q.error)throw q.error;return json({ok:true,requestId});
  }
  if(action==='test-push'){
    if(!isManager)return json({error:'MANAGER_REQUIRED'},403);const me=await own();const ins=await sb.from('platform_notifications').insert({school_id:schoolId,recipient_user_id:userId,title:'تنبيه تجريبي من منصة القيادة المدرسية',body:'تم ربط هذا الجهاز بحساب المدير بنجاح.',severity:'important',action_url:'manager.html',actor_user_id:userId,actor_name:me.full_name||'',source_key:'test:'+crypto.randomUUID()}).select('*').single();if(ins.error)throw ins.error;const r=await sendPush(userId,ins.data);return json({ok:true,...r,notification:ins.data,requestId});
  }
  if(action==='record-event'){
    const me=await own(),eventType=text(body.eventType||body.name,160)||'platform.action',severity=severityFor(eventType,body),moduleKey=text(body.moduleKey||body.options?.moduleKey||body.data?.moduleKey,160),recordType=text(body.recordType||body.options?.recordType||body.data?.recordType,160),recordId=text(body.recordId||body.options?.recordId||body.data?.recordId,220),summary=text(body.summary||body.data?.summary||body.data?.title||body.data?.notes||labelFor(eventType),700),actionUrl=text(body.actionUrl||body.data?.action_url||body.data?.actionUrl,1000),sourceKey=text(body.sourceKey,300)||null;
    let recipient=text(body.recipientUserId||body.data?.recipient_user_id||body.data?.reviewer_id||body.data?.requester_id||body.data?.supervisor_id,100);
    if(recipient){const rq=await sb.from('school_members').select('user_id').eq('school_id',schoolId).eq('user_id',recipient).eq('status','active').limit(1);if(rq.error)throw rq.error;if(!(rq.data||[]).length)recipient='';}
    const ev=await sb.from('school_events').insert({school_id:schoolId,actor_user_id:userId,actor_name:me.full_name||me.email||'',actor_role:role,event_type:eventType,event_label:text(body.eventLabel,220)||labelFor(eventType),module_key:moduleKey||null,record_type:recordType||null,record_id:recordId||null,summary,severity,recipient_user_id:recipient||null,action_url:actionUrl||null,event_data:body.data||{},source_key:sourceKey}).select('*').single();if(ev.error)throw ev.error;
    let recipients:string[]=[];
    if(recipient)recipients=[recipient];else{const mq=await sb.from('school_members').select('user_id,role').eq('school_id',schoolId).eq('status','active');if(mq.error)throw mq.error;recipients=Array.from(new Set<string>((mq.data||[]).filter((m:any)=>managerRoles.has(low(m.role))).map((m:any)=>String(m.user_id)).filter(Boolean)));if(!recipients.length){const uq=await sb.from('users').select('id,role').eq('school_id',schoolId).eq('status','active');if(uq.error)throw uq.error;recipients=Array.from(new Set<string>((uq.data||[]).filter((u:any)=>managerRoles.has(low(u.role))).map((u:any)=>String(u.id)).filter(Boolean)));}}
    const settings=await schoolSettings();const shouldNotify=body.notifyManager===true||severity!=='normal'||settings.important_only===false;let created:any[]=[];let push={sent:0,failed:0,configured:pushConfigured()};
    if(shouldNotify){for(const rid of recipients){if(rid===userId&&body.notifySelf!==true)continue;const n=await sb.from('platform_notifications').insert({school_id:schoolId,recipient_user_id:rid,source_event_id:ev.data.id,title:text(body.title,300)||labelFor(eventType),body:summary,severity,action_url:actionUrl||null,actor_user_id:userId,actor_name:me.full_name||me.email||'',source_key:sourceKey?`${sourceKey}:${rid}`:null,metadata:{module_key:moduleKey,record_type:recordType,record_id:recordId}}).select('*').single();if(n.error){if(String(n.error.code)==='23505')continue;throw n.error;}created.push(n.data);if((severity==='important'||severity==='critical'||body.notifyPush===true)&&settings.push_enabled!==false){const r=await sendPush(rid,n.data);push.sent+=r.sent||0;push.failed+=r.failed||0;}}}
    return json({ok:true,event:ev.data,notifications:created,push,requestId});
  }
  return json({error:'ACTION_UNSUPPORTED',requestId},400);
 }catch(e){console.error('[platform-notifications]',requestId,e);return json({error:e instanceof Error?e.message:String(e),requestId},500);}
});
