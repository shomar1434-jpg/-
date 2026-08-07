(function(){'use strict';
const q=new URLSearchParams(location.search),taskId=q.get('task_id'),delegated=q.get('delegated')==='1';
if(!taskId||!delegated)return;
const moduleKey=q.get('module_key')||'shared',recordType=q.get('record_type')||'record',recordId=q.get('record_id')||null;
const returnTo=q.get('return_to')||('central_task_center.html?mode=assignee&task_id='+encodeURIComponent(taskId));
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function loadScript(src,test){return new Promise((resolve,reject)=>{if(test&&test())return resolve();const old=[...document.scripts].find(s=>String(s.src||'').endsWith('/'+src)||String(s.getAttribute('src')||'')===src);if(old){old.addEventListener('load',()=>resolve(),{once:true});setTimeout(()=>test&&test()?resolve():reject(new Error('تعذر تهيئة '+src)),8000);return}const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>resolve();s.onerror=()=>reject(new Error('تعذر تحميل '+src));document.head.appendChild(s)})}
async function ensureEngines(){
 await loadScript('platform-cloud-session.js',()=>!!window.PlatformCloudSession);
 await loadScript('platform-core-engine.js',()=>!!window.PlatformCore);
 if(window.PlatformCloudSession?.ensure)await window.PlatformCloudSession.ensure();
}
let lastActivity=0,workspace=null,activityTimer=null,lastEventKey='';
async function emit(eventType,data={},progress){
 try{
  await ensureEngines();
  const key=eventType+'|'+String(data.title||'');
  if(key===lastEventKey&&Date.now()-lastActivity<1500)return;
  lastEventKey=key;lastActivity=Date.now();
  await window.PlatformCore.emitRecordEvent({moduleKey,recordType,recordId,taskId,eventType,data:{...data,internal_evidence:true,page:location.pathname,route:location.href}});
  window.dispatchEvent(new CustomEvent('platform:record_updated',{detail:{taskId,moduleKey,recordType,recordId,eventType,progress}}));
 }catch(e){console.warn('[delegated-access] تعذر توثيق نشاط السجل:',e)}
}
function activity(title,progress=60,eventType='record_updated'){
 clearTimeout(activityTimer);activityTimer=setTimeout(()=>emit(eventType,{title,notes:'تنفيذ مباشر داخل السجل المفوض.'},progress),350);
}
function hookStorage(){
 try{
  const original=Storage.prototype.setItem;
  if(original.__delegatedWrapped)return;
  const wrapped=function(k,v){const r=original.apply(this,arguments);try{if(this===localStorage&&window.PlatformDelegatedAccess?.task)activity('حفظ بيانات السجل',60,'record_updated')}catch{}return r};
  wrapped.__delegatedWrapped=true;Storage.prototype.setItem=wrapped;
 }catch(e){console.warn('[delegated-access] تعذر ربط التخزين المحلي',e)}
}
function hookFormsAndActions(){
 document.addEventListener('submit',()=>activity('حفظ نموذج داخل السجل',60,'record_updated'),true);
 document.addEventListener('change',e=>{const el=e.target;if(el&&/INPUT|SELECT|TEXTAREA/.test(el.tagName||''))window.PlatformDelegatedAccess.dirty=true},true);
 document.addEventListener('click',e=>{const b=e.target.closest('button,a,[role="button"]');if(!b)return;const t=(b.textContent||'').trim();if(/حفظ|تحديث|إضافة|إنشاء|تسجيل|توثيق|تنفيذ/.test(t))activity('تنفيذ إجراء: '+t.slice(0,70),60,'record_updated')},true);
 window.addEventListener('platform:record_saved',e=>activity(e.detail?.title||'حفظ السجل',e.detail?.completed?80:60,e.detail?.completed?'record_completed':'record_updated'));
}
async function run(){try{
 await ensureEngines();
 workspace=await window.PlatformCore.workspace(taskId);
 const grants=workspace.grants||[];
 const grant=grants.find(g=>(!moduleKey||g.module_key===moduleKey)&&(!recordType||!g.record_type||g.record_type===recordType)&&(!recordId||!g.record_id||String(g.record_id)===String(recordId)));
 if(!grant||!grant.can_view)throw new Error('لا توجد صلاحية فعالة لفتح هذا السجل');
 const bar=document.createElement('div');bar.id='delegatedAccessBanner';bar.style.cssText='position:sticky;top:0;z-index:99998;direction:rtl;background:#0f766e;color:#fff;padding:9px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;font:700 13px/1.5 system-ui;box-shadow:0 7px 20px #0002';
 bar.innerHTML=`<div><strong>تنفيذ تكليف:</strong> ${esc(workspace.task?.title||'تكليف')} · أي حفظ أو تعديل داخل السجل يُوثق تلقائيًا ضمن نسبة الإنجاز.</div><button id="delegatedBackBtn" style="border:0;border-radius:10px;padding:7px 12px;font-weight:900;cursor:pointer">العودة لمركز تكليفاتي</button>`;
 document.body.prepend(bar);bar.querySelector('#delegatedBackBtn').onclick=()=>location.href=returnTo;
 window.PlatformDelegatedAccess={task:workspace.task,grant,workspace,dirty:false,recordActivity:(title,completed=false)=>activity(title,completed?80:60,completed?'record_completed':'record_updated')};
 hookStorage();hookFormsAndActions();
 await emit('record_opened',{title:'فتح السجل المفوض',notes:'بدأ المكلف العمل داخل السجل.'},20);
 }catch(e){document.body.innerHTML=`<div dir="rtl" style="max-width:700px;margin:80px auto;padding:30px;border:1px solid #fecaca;border-radius:20px;background:#fff7f7;font-family:system-ui"><h2>تعذر فتح السجل</h2><p>${esc(e.message||e)}</p><button onclick="history.back()">رجوع</button></div>`}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();})();
