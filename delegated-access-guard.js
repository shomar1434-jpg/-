(function(){'use strict';
const q=new URLSearchParams(location.search),taskId=q.get('task_id'),delegated=q.get('delegated')==='1';if(!taskId||!delegated)return;
const moduleKey=q.get('module_key')||'shared',recordType=q.get('record_type')||'record',recordId=q.get('record_id')||null;
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
let lastActivity=0,workspace=null;
async function emit(eventType,data={},progress){
 try{
  if(!window.PlatformCore)return;
  await PlatformCore.emitRecordEvent({moduleKey,recordType,recordId,taskId,eventType,data:{...data,internal_evidence:true,page:location.pathname,route:location.href}});
  if(progress!=null&&window.CloudTaskEngine){await CloudTaskEngine.addUpdate({taskId,updateType:'record_activity',title:data.title||'تنفيذ داخل السجل',notes:data.notes||'تم توثيق نشاط تنفيذي داخل السجل المرتبط بالتكليف.',progressPercent:progress,status:'completed'});}
  window.dispatchEvent(new CustomEvent('platform:record_updated',{detail:{taskId,moduleKey,recordType,recordId,eventType}}));
 }catch(e){console.warn('تعذر توثيق نشاط السجل:',e)}
}
function activity(title,progress=60){const now=Date.now();if(now-lastActivity<1200)return;lastActivity=now;emit('record_updated',{title,notes:'تنفيذ مباشر داخل السجل المفوض.'},progress)}
async function run(){try{
 if(!window.PlatformCore)throw new Error('محرك المنصة غير متاح');workspace=await PlatformCore.workspace(taskId);const grants=workspace.grants||[];const grant=grants.find(g=>(!moduleKey||g.module_key===moduleKey)&&(!recordType||!g.record_type||g.record_type===recordType));if(!grant||!grant.can_view)throw new Error('لا توجد صلاحية فعالة لفتح هذا السجل');
 const bar=document.createElement('div');bar.id='delegatedAccessBanner';bar.style.cssText='position:sticky;top:0;z-index:99998;direction:rtl;background:#0f766e;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;font:700 13px/1.5 system-ui;box-shadow:0 7px 20px #0002';bar.innerHTML=`<div><strong>أنت تعمل بصفتك مكلفًا مؤقتًا</strong> · ${esc(workspace.task?.title||'تكليف')} · التنفيذ داخل هذا السجل يُوثق تلقائيًا كشاهد داخلي.</div><button style="border:0;border-radius:10px;padding:7px 12px;font-weight:900;cursor:pointer" onclick="location.href='central_task_center.html?mode=assignee&task_id=${encodeURIComponent(taskId)}'">العودة لمركز تكليفاتي</button>`;document.body.prepend(bar);window.PlatformDelegatedAccess={task:workspace.task,grant};
 await emit('record_opened',{title:'فتح السجل المفوض',notes:'بدأ المكلف العمل داخل السجل.'},20);
 document.addEventListener('submit',()=>setTimeout(()=>activity('حفظ بيانات داخل السجل',60),500),true);
 document.addEventListener('click',e=>{const b=e.target.closest('button,a,[role="button"]');if(!b)return;const t=(b.textContent||'').trim();if(/حفظ|تحديث|إضافة|إنشاء|تسجيل|اعتماد|تنفيذ/.test(t))setTimeout(()=>activity('تنفيذ إجراء: '+t.slice(0,70),60),650)},true);
 window.addEventListener('beforeunload',()=>{navigator.sendBeacon&&void 0});
 }catch(e){document.body.innerHTML=`<div dir="rtl" style="max-width:700px;margin:80px auto;padding:30px;border:1px solid #fecaca;border-radius:20px;background:#fff7f7;font-family:system-ui"><h2>تعذر فتح السجل</h2><p>${esc(e.message||e)}</p><button onclick="history.back()">رجوع</button></div>`}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();})();