(function(){
'use strict';if(window.InternalMessaging)return;
const cfg={url:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,''),key:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjaWpoZ3ZidHJ2bW1sY3NzZ3hodCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4Njk2ODM1LCJleHAiOjIwOTQyNzI4MzV9.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM'};
const token=()=>window.PlatformCloudSession?.token?.()||sessionStorage.getItem('platform_tab_session_token_v1')||localStorage.getItem('platform_file_session_token')||'';const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function ensureSession(){if(window.PlatformCloudSession?.ensure){await window.PlatformCloudSession.ensure()}if(!token())throw new Error('الجلسة السحابية غير متاحة')}
const UNREAD_CHANNEL='school-platform-unread-v1',UNREAD_PULSE_KEY='school_platform_unread_pulse_v1';
let unreadChannel=null,refreshInFlight=null;
try{if('BroadcastChannel' in window)unreadChannel=new BroadcastChannel(UNREAD_CHANNEL)}catch(_){}
function emitUnreadEvent(reason){const payload={type:'unread-changed',reason:String(reason||'update'),at:Date.now()};try{unreadChannel?.postMessage(payload)}catch(_){}try{localStorage.setItem(UNREAD_PULSE_KEY,JSON.stringify(payload))}catch(_){}}
async function call(action,body){await ensureSession();const send=async()=>{const r=await fetch(`${cfg.url()}/functions/v1/platform-messages?action=${encodeURIComponent(action)}`,{method:body!==undefined?'POST':'GET',headers:{apikey:cfg.key(),'content-type':'application/json','x-platform-session':token()},body:body!==undefined?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));return {r,j}};let res=await send();if(res.r.status===401&&window.PlatformCloudSession?.recover){await window.PlatformCloudSession.recover();res=await send()}if(!res.r.ok)throw new Error(res.j.error||'تعذر الاتصال بالمراسلات');const changed=new Set(['send','read','mark-unread','archive-message','unarchive-message','acknowledge','action-status']);if(changed.has(String(action||'')))emitUnreadEvent(action);return res.j}
async function taskCall(action,body){await ensureSession();const send=async()=>{const r=await fetch(`${cfg.url()}/functions/v1/platform-tasks?action=${encodeURIComponent(action)}`,{method:'POST',headers:{apikey:cfg.key(),'content-type':'application/json','x-platform-session':token()},body:JSON.stringify(body||{})});const j=await r.json().catch(()=>({}));return {r,j}};let res=await send();if(res.r.status===401&&window.PlatformCloudSession?.recover){await window.PlatformCloudSession.recover();res=await send()}if(!res.r.ok)throw new Error(res.j.error||'تعذر إنشاء التكليف');return res.j}
function isSystemAdmin(){const q=new URLSearchParams(location.search);if(q.get('systemAdmin')==='1')return true;try{return sessionStorage.getItem('system_admin_session')==='1'||sessionStorage.getItem('systemAdmin')==='1'||JSON.parse(sessionStorage.getItem('systemAdminSession')||'null')?.active===true}catch(_){return false}}
function addStyles(){if(document.getElementById('im-style'))return;const st=document.createElement('style');st.id='im-style';st.textContent=`.im-fab{position:fixed;top:14px;left:78px;z-index:9000;width:42px;height:42px;border:1px solid #d5e8e6;border-radius:14px;background:#fff;color:#087f78;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 18px #0b4b4518;cursor:pointer;font-size:20px}.im-badge{position:absolute;top:-6px;right:-6px;min-width:19px;height:19px;padding:0 4px;border-radius:10px;background:#d94a4a;color:#fff;font:700 11px/19px Tahoma;text-align:center;display:none}.im-panel{position:fixed;top:64px;left:18px;width:min(400px,calc(100vw - 36px));max-height:74vh;background:#fff;border:1px solid #d9e5e5;border-radius:20px;box-shadow:0 18px 50px #173a3a30;z-index:9001;display:none;direction:rtl;overflow:hidden;font-family:Tajawal,Arial,sans-serif}.im-head{padding:15px 17px;border-bottom:1px solid #edf2f2;display:flex;justify-content:space-between;align-items:center}.im-head b{color:#087f78}.im-list{max-height:48vh;overflow:auto}.im-item{padding:12px 16px;border-bottom:1px solid #f0f3f3;cursor:pointer}.im-item:hover{background:#f5fbfa}.im-item.unread{background:#effaf8}.im-sub{font-weight:700;color:#263b3a}.im-meta{font-size:12px;color:#7b8b8a;margin-top:4px}.im-actions{padding:12px;display:flex;flex-wrap:wrap;gap:8px}.im-actions button{border:0;border-radius:10px;padding:9px 12px;cursor:pointer}.im-open{background:#087f78;color:white}.im-new,.im-share{background:#e8f7f5;color:#087f78}
.im-toolbar-btn{position:relative;display:inline-flex!important;align-items:center;gap:7px;white-space:nowrap}
.im-toolbar-badge{position:absolute!important;top:-7px!important;left:-7px!important;min-width:18px!important;height:18px!important;padding:0 4px!important;border-radius:999px!important;background:#dc2626!important;color:#fff!important;font:900 10px/18px Tahoma!important;text-align:center!important;display:none;align-items:center!important;justify-content:center!important;box-shadow:0 2px 7px rgba(220,38,38,.38)!important;z-index:2147483646!important;visibility:visible!important;opacity:1!important;pointer-events:none!important}
.im-admin-toolbar-btn{border:1px solid #cfe4d9;background:#fff;color:#0f6b4a;border-radius:13px;padding:10px 16px;font-family:inherit;font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:7px;position:relative}`;document.head.appendChild(st)}
function setBadge(el,count,label){if(!el)return;const n=Math.max(0,Number(count)||0);el.textContent=String(n);el.dataset.count=String(n);el.dataset.unreadCount=String(n);el.setAttribute('aria-label',n?`لديك ${n} ${label||'عنصر'} غير مقروء`:`لا توجد ${label||'عناصر'} غير مقروءة`);if(el.parentElement){el.parentElement.style.setProperty('overflow','visible','important');el.parentElement.style.setProperty('position','relative','important')}if(n){el.style.setProperty('display','flex','important');el.style.setProperty('visibility','visible','important');el.style.setProperty('opacity','1','important');el.style.setProperty('z-index','2147483646','important');el.style.setProperty('background','#dc2626','important');el.style.setProperty('color','#fff','important');el.style.setProperty('align-items','center','important');el.style.setProperty('justify-content','center','important')}else{el.style.setProperty('display','none','important')}}
function unreadBreakdown(messages){const rows=Array.isArray(messages)?messages:[];const unread=rows.filter(m=>!m.read_at);return {notices:unread.filter(m=>String(m.message_type||'')==='notice').length,messages:unread.filter(m=>String(m.message_type||'')!=='notice').length,total:unread.length}}
function ensureCloudBadge(btn,kind){
 if(!btn)return null;const attr=kind==='notification'?'data-cloud-notification-badge':'data-cloud-message-badge';let b=btn.querySelector('['+attr+']');
 if(!b){b=document.createElement('span');b.setAttribute(attr,'1');b.className='im-toolbar-badge im-cloud-owned-badge';b.setAttribute('aria-hidden','false');btn.appendChild(b)}
 return b
}
function updateNotificationBadges(messages){
 const c=unreadBreakdown(messages),n=c.notices;
 document.querySelectorAll('#ssInbox').forEach(btn=>{const b=ensureCloudBadge(btn,'notification');setBadge(b,n,'تنبيهات');btn.dataset.cloudNotificationCount=String(n);btn.title=n?'تلقي التنبيهات — '+n+' جديد':'تلقي التنبيهات'});
 document.querySelectorAll('.ss-notification-badge,[data-notification-badge]').forEach(b=>{if(!b.matches('#ssInboxBadge'))setBadge(b,n,'تنبيهات')});
 return n
}
function updateMessageBadges(messages){
 const c=unreadBreakdown(messages),n=c.messages;
 document.querySelectorAll('.im-static-messaging-btn,.im-toolbar-btn,[data-internal-messages-link]').forEach(btn=>{const b=ensureCloudBadge(btn,'message');setBadge(b,n,'رسائل');btn.dataset.cloudMessageCount=String(n);btn.title=n?'المراسلات الداخلية — '+n+' غير مقروءة':'فتح مركز المراسلات الداخلية'});
 document.querySelectorAll('[data-message-badge]').forEach(b=>setBadge(b,n,'رسائل'));
 return n
}
async function refresh(){if(refreshInFlight)return refreshInFlight;refreshInFlight=(async()=>{try{const d=await call('inbox',{}),rows=d.messages||[];updateMessageBadges(rows);updateNotificationBadges(rows);render(rows);return {ok:true,rows}}catch(e){console.warn('[InternalMessaging unread badges]',e.message);return {ok:false,error:e}}finally{refreshInFlight=null}})();return refreshInFlight}
function currentRole(){return String(localStorage.getItem('platform_file_session_role')||localStorage.getItem('currentRole')||'').trim().toLowerCase()}
function canSendSchoolAlerts(){return /^(manager|school_manager|principal|agent|deputy|deputy_admin|deputy_academic|deputy_students)$/.test(currentRole())}
function validHttpUrl(v){return !v||/^https?:\/\//i.test(String(v).trim())}
function legacyAlertRecipientSelection(){
 const target=document.getElementById('alertTarget')?.value||'custom';
 const selected=[...document.querySelectorAll('.recUser:checked')].map(x=>String(x.value||''));
 const ids=selected.map(v=>v.includes(':')?v.slice(v.indexOf(':')+1):v).filter(Boolean);
 const roles=[...new Set(selected.map(v=>v.includes(':')?v.slice(0,v.indexOf(':')):'').filter(Boolean))];
 const role=currentRole();
 if(target==='all'&&/^(manager|school_manager|principal)$/.test(role))return {recipientIds:[],recipientRoles:[],allSchool:true};
 if(target==='custom')return {recipientIds:ids,recipientRoles:[],allSchool:false};
 if(roles.length)return {recipientIds:[],recipientRoles:roles,allSchool:false};
 const map={agents:['agent'],teachers:['teacher'],student_advisors:['student_advisor'],activity_leaders:['activity_leader'],health_advisors:['health_advisor'],employees:['administrative_employee','admin_employee']};
 return {recipientIds:[],recipientRoles:map[target]||[],allSchool:false};
}
async function uploadLegacyAlertFiles(files){
 const list=[...(files||[])];if(!list.length)return [];
 if(!window.CloudFileEngine||typeof CloudFileEngine.upload!=='function')throw new Error('محرك الملفات السحابي غير متاح لرفع مرفقات التنبيه');
 const out=[];
 try{
  for(const file of list){
   const r=await CloudFileEngine.upload({file,ownershipScope:'user',moduleKey:'internal_messages',displayName:file.name,metadata:{source:'school_notification',pendingMessage:true}});
   if(!r?.file?.id)throw new Error('تعذر تأكيد رفع المرفق: '+file.name);
   out.push({fileId:r.file.id,name:r.file.display_name||file.name,source:'device'});
  }
  return out;
 }catch(e){
  for(const a of out){try{if(CloudFileEngine.trash)await CloudFileEngine.trash(a.fileId)}catch(_){}}
  throw e;
 }
}
async function sendLegacyAlertThroughCloud(){
 if(!canSendSchoolAlerts())throw new Error('إرسال التنبيهات متاح للمدير والوكيل فقط');
 const msg=String(document.getElementById('alertMsg')?.value||'').trim();
 const link=String(document.getElementById('alertLink')?.value||'').trim();
 if(!msg)throw new Error('اكتب نص التنبيه أولاً');if(msg.length>300)throw new Error('نص التنبيه يتجاوز 300 حرف');if(!validHttpUrl(link))throw new Error('الرابط يجب أن يبدأ بـ http أو https');
 const t=legacyAlertRecipientSelection();if(!t.allSchool&&!t.recipientIds.length&&!t.recipientRoles.length)throw new Error('اختر مستلمًا واحدًا على الأقل');
 const input=document.getElementById('alertFiles'),uploaded=await uploadLegacyAlertFiles(input?.files||[]);
 try{
  const role=currentRole(),senderIsManager=/^(manager|school_manager|principal)$/.test(role),subject=senderIsManager?'تنبيه من مدير المدرسة':'تنبيه من الوكيل';
  const result=await call('send',{...t,subject,body:msg,priority:'important',messageType:'notice',acknowledgementMode:'read_receipt',attachments:uploaded,linked:link?{module:'school_notifications',recordType:'notice',title:'رابط مرفق بالتنبيه',url:link}:{module:'school_notifications',recordType:'notice'},metadata:{source:'school_notification_bridge'}});
  const expected=uploaded.length;if(expected&&(Number(result?.savedAttachmentCount||0)!==expected||result?.attachmentsConfirmed!==true))throw new Error('لم يتم تأكيد حفظ جميع مرفقات التنبيه');
  const backdrop=document.getElementById('ssFinalBackdrop');if(backdrop)backdrop.style.display='none';
  alert(expected?'تم إرسال التنبيه وحفظ '+expected+' مرفق سحابيًا بنجاح ✅':'تم إرسال التنبيه بنجاح ✅');
  await refresh();return result;
 }catch(e){
  for(const a of uploaded){try{if(window.CloudFileEngine?.trash)await CloudFileEngine.trash(a.fileId)}catch(_){}}
  throw e;
 }
}
function notificationCenterUrl(){const q=new URLSearchParams({return_to:roleHome(),filterType:'notice'});return 'internal_messages.html?'+q.toString()}
function installNotificationBridge(){
 if(document.documentElement.dataset.imNotificationBridge==='1')return;document.documentElement.dataset.imNotificationBridge='1';
 document.addEventListener('click',function(ev){
  const inbox=ev.target?.closest?.('#ssInbox');if(inbox){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();location.href=notificationCenterUrl();return}
  const send=ev.target?.closest?.('#sendAlert');if(send&&document.getElementById('alertMsg')&&canSendSchoolAlerts()){
   ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
   if(send.dataset.cloudSending==='1')return;send.dataset.cloudSending='1';send.disabled=true;
   const old=send.textContent;send.textContent='جارٍ الإرسال...';
   sendLegacyAlertThroughCloud().catch(e=>alert(e?.message||'تعذر إرسال التنبيه')).finally(()=>{send.dataset.cloudSending='0';send.disabled=false;send.textContent=old||'إرسال التنبيه'});
  }
 },true);
 const onUnreadChanged=()=>{if(!document.hidden)refresh()};
 try{if(unreadChannel)unreadChannel.addEventListener('message',e=>{if(e?.data?.type==='unread-changed')onUnreadChanged()})}catch(_){}
 window.addEventListener('storage',e=>{if(e.key===UNREAD_PULSE_KEY)onUnreadChanged()});
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 let mutationTimer=0;const mo=new MutationObserver(muts=>{let relevant=false;for(const m of muts){if(m.type==='childList'&&[...m.addedNodes].some(n=>n&&n.nodeType===1&&(n.matches?.('#ssInbox,.im-static-messaging-btn,.im-toolbar-btn,[data-internal-messages-link]')||n.querySelector?.('#ssInbox,.im-static-messaging-btn,.im-toolbar-btn,[data-internal-messages-link]')))){relevant=true;break}}if(relevant){clearTimeout(mutationTimer);mutationTimer=setTimeout(refresh,60)}});
 try{mo.observe(document.documentElement,{childList:true,subtree:true})}catch(_){}
}


function render(msgs){const list=document.querySelector('.im-list');if(!list)return;list.innerHTML=msgs.length?msgs.slice(0,8).map(m=>`<div class="im-item ${m.read_at?'':'unread'}" data-id="${esc(m.id)}"><div class="im-sub">${m.pinned_at?'📌 ':''}${esc(m.subject)}</div><div class="im-meta">من: ${esc(m.sender_name||'مستخدم')} · ${new Date(m.created_at).toLocaleString('ar-SA')}</div></div>`).join(''):'<div style="padding:28px;text-align:center;color:#84908f">لا توجد رسائل جديدة</div>';list.querySelectorAll('.im-item').forEach(x=>x.onclick=()=>location.href='internal_messages.html?message='+encodeURIComponent(x.dataset.id))}
function roleHome(){
 const role=(localStorage.getItem('platform_file_session_role')||'').toLowerCase();
 const map={manager:'manager.html',school_manager:'manager.html',principal:'manager.html',agent:'agent.html',deputy:'agent.html',deputy_admin:'agent.html',deputy_academic:'agent.html',deputy_students:'agent.html',teacher:'teacher.html',health_advisor:'health_advisor.html',kindergarten_teacher:'kindergarten_teacher.html',student_advisor:'student_advisor.html',counselor:'student_advisor.html',activity_leader:'activity_leader.html',admin_employee:'administrative_employee_portal.html',administrative_employee:'administrative_employee_portal.html',employee:'administrative_employee_portal.html'};
 return map[role]||((location.pathname.split('/').pop()||'').match(/^(manager|agent|teacher|health_advisor|kindergarten_teacher|student_advisor|activity_leader|administrative_employee_portal)\.html$/i)?.[0]||'index.html');
}
function currentLink(){const title=(document.querySelector('h1')?.textContent||document.title||'').trim();return {module:(location.pathname.split('/').pop()||'page').replace(/\.html?$/i,''),recordType:document.body?.dataset?.recordType||'page',recordId:new URLSearchParams(location.search).get('record_id')||new URLSearchParams(location.search).get('task_id')||'',title,url:location.href}}
function returnPath(){return roleHome()}function centerUrl(extra={}){const q=new URLSearchParams(extra);q.set('return_to',returnPath());return 'internal_messages.html?'+q.toString()}function composeUrl(opts={}){const q=new URLSearchParams({compose:'1',return_to:returnPath()});if(opts.recipientId)q.set('recipient',opts.recipientId);if(opts.subject)q.set('subject',opts.subject);if(opts.body)q.set('body',opts.body);const l=opts.linked||currentLink();Object.entries({linkedModule:l.module,linkedType:l.recordType,linkedId:l.recordId,linkedTitle:l.title,linkedUrl:l.url}).forEach(([k,v])=>v&&q.set(k,String(v)));return 'internal_messages.html?'+q.toString()}
function mount(){
 if(/internal_messages\.html$/i.test(location.pathname))return;
 addStyles();
 installNotificationBridge();
 const buttons=[...document.querySelectorAll('.im-static-messaging-btn')];
 if(!buttons.length)return;
 buttons.forEach(btn=>{
   btn.style.setProperty('display','inline-flex','important');
   btn.style.setProperty('visibility','visible','important');
   btn.style.setProperty('opacity','1','important');
 });
 refresh();
 [350,1500,5000].forEach(ms=>setTimeout(refresh,ms));
 setInterval(refresh,20000);
}
window.InternalMessaging={call,taskCall,refresh,mount,currentLink,composeUrl,centerUrl,share:(o)=>location.href=composeUrl(o||{})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();