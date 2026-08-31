(function(){
'use strict';if(window.InternalMessaging)return;
const cfg={url:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,''),key:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjaWpoZ3ZidHJ2bW1sY3NzZ3hodCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4Njk2ODM1LCJleHAiOjIwOTQyNzI4MzV9.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM'};
const token=()=>window.PlatformCloudSession?.token?.()||sessionStorage.getItem('platform_tab_session_token_v1')||localStorage.getItem('platform_file_session_token')||'';const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function ensureSession(){if(window.PlatformCloudSession?.ensure){await window.PlatformCloudSession.ensure()}if(!token())throw new Error('الجلسة السحابية غير متاحة')}
async function call(action,body){await ensureSession();const send=async()=>{const r=await fetch(`${cfg.url()}/functions/v1/platform-messages?action=${encodeURIComponent(action)}`,{method:body!==undefined?'POST':'GET',headers:{apikey:cfg.key(),'content-type':'application/json','x-platform-session':token()},body:body!==undefined?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));return {r,j}};let res=await send();if(res.r.status===401&&window.PlatformCloudSession?.recover){await window.PlatformCloudSession.recover();res=await send()}if(!res.r.ok)throw new Error(res.j.error||'تعذر الاتصال بالمراسلات');return res.j}
async function taskCall(action,body){await ensureSession();const send=async()=>{const r=await fetch(`${cfg.url()}/functions/v1/platform-tasks?action=${encodeURIComponent(action)}`,{method:'POST',headers:{apikey:cfg.key(),'content-type':'application/json','x-platform-session':token()},body:JSON.stringify(body||{})});const j=await r.json().catch(()=>({}));return {r,j}};let res=await send();if(res.r.status===401&&window.PlatformCloudSession?.recover){await window.PlatformCloudSession.recover();res=await send()}if(!res.r.ok)throw new Error(res.j.error||'تعذر إنشاء التكليف');return res.j}
function isSystemAdmin(){const q=new URLSearchParams(location.search);if(q.get('systemAdmin')==='1')return true;try{return sessionStorage.getItem('system_admin_session')==='1'||sessionStorage.getItem('systemAdmin')==='1'||JSON.parse(sessionStorage.getItem('systemAdminSession')||'null')?.active===true}catch(_){return false}}
function addStyles(){if(document.getElementById('im-style'))return;const st=document.createElement('style');st.id='im-style';st.textContent=`.im-fab{position:fixed;top:14px;left:78px;z-index:9000;width:42px;height:42px;border:1px solid #d5e8e6;border-radius:14px;background:#fff;color:#087f78;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 18px #0b4b4518;cursor:pointer;font-size:20px}.im-badge{position:absolute;top:-6px;right:-6px;min-width:19px;height:19px;padding:0 4px;border-radius:10px;background:#d94a4a;color:#fff;font:700 11px/19px Tahoma;text-align:center;display:none}.im-panel{position:fixed;top:64px;left:18px;width:min(400px,calc(100vw - 36px));max-height:74vh;background:#fff;border:1px solid #d9e5e5;border-radius:20px;box-shadow:0 18px 50px #173a3a30;z-index:9001;display:none;direction:rtl;overflow:hidden;font-family:Tajawal,Arial,sans-serif}.im-head{padding:15px 17px;border-bottom:1px solid #edf2f2;display:flex;justify-content:space-between;align-items:center}.im-head b{color:#087f78}.im-list{max-height:48vh;overflow:auto}.im-item{padding:12px 16px;border-bottom:1px solid #f0f3f3;cursor:pointer}.im-item:hover{background:#f5fbfa}.im-item.unread{background:#effaf8}.im-sub{font-weight:700;color:#263b3a}.im-meta{font-size:12px;color:#7b8b8a;margin-top:4px}.im-actions{padding:12px;display:flex;flex-wrap:wrap;gap:8px}.im-actions button{border:0;border-radius:10px;padding:9px 12px;cursor:pointer}.im-open{background:#087f78;color:white}.im-new,.im-share{background:#e8f7f5;color:#087f78}
.im-toolbar-btn{position:relative;display:inline-flex!important;align-items:center;gap:7px;white-space:nowrap}
.im-toolbar-badge{position:absolute;top:-7px;left:-7px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#d94a4a;color:#fff;font:700 10px/18px Tahoma;text-align:center;display:none;box-shadow:0 1px 4px #0002}
.im-admin-toolbar-btn{border:1px solid #cfe4d9;background:#fff;color:#0f6b4a;border-radius:13px;padding:10px 16px;font-family:inherit;font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:7px;position:relative}`;document.head.appendChild(st)}
function setBadge(el,count){if(!el)return;const n=Math.max(0,Number(count)||0);el.textContent=String(n);el.style.display=n?'flex':'none';el.setAttribute('aria-label',n?'لديك '+n+' تنبيه غير مقروء':'لا توجد تنبيهات غير مقروءة')}
function updateNotificationBadges(messages){
 const rows=Array.isArray(messages)?messages:[];
 const unreadNotices=rows.filter(m=>String(m.message_type||'')==='notice'&&!m.read_at).length;
 document.querySelectorAll('#ssInboxBadge,.ss-notification-badge,[data-notification-badge]').forEach(b=>setBadge(b,unreadNotices));
 const btn=document.getElementById('ssInbox');if(btn){btn.dataset.cloudNotificationCount=String(unreadNotices);btn.title=unreadNotices?'تلقي التنبيهات — '+unreadNotices+' جديد':'تلقي التنبيهات'}
 return unreadNotices;
}
async function refresh(){try{const d=await call('inbox',{}),rows=d.messages||[],badges=[...document.querySelectorAll('.im-toolbar-badge')];badges.forEach(b=>setBadge(b,d.unread||0));updateNotificationBadges(rows);render(rows)}catch(e){console.warn('[InternalMessaging]',e.message)}}
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
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
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
 setInterval(refresh,60000);
}
window.InternalMessaging={call,taskCall,refresh,mount,currentLink,composeUrl,centerUrl,share:(o)=>location.href=composeUrl(o||{})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();