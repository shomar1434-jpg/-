(function(){
'use strict';
const qs=new URLSearchParams(location.search);
if(qs.get('delegated')==='1' && qs.get('task_id')) return; // delegated-access-guard owns delegated execution.
const PAGE=(location.pathname.split('/').pop()||'page').toLowerCase();
const MAP={
 'administrative_employee_plan.html':['performance_management','administrative_employee_plan'],
 'administrative_employee_execution.html':['performance_management','administrative_employee_execution'],
 'administrative_employee_evaluation.html':['performance_management','administrative_employee_evaluation'],
 'administrative_employee_improvement.html':['performance_management','administrative_employee_improvement'],
 'teacher_comprehensive_record.html':['teacher_records','teacher_comprehensive_record'],
 'student_advisor_records.html':['student_advisor','student_advisor_record'],
 'manager_records.html':['manager_records','manager_record'],
 'wakil-records.html':['deputy_records','deputy_record'],
 'school_readiness.html':['readiness','school_readiness'],
 'activity_leader_records.html':['activity_leader','activity_record']
};
const spec=MAP[PAGE]; if(!spec)return;
const moduleKey=spec[0],recordType=spec[1];
const rid=qs.get('record_id')||qs.get('record')||qs.get('emp')||qs.get('id')||qs.get('student')||qs.get('case')||PAGE.replace(/\.html$/,'');
let timer=null,lastKey='',lastAt=0;
function loadScript(src,test){return new Promise((resolve,reject)=>{if(test&&test())return resolve();const old=[...document.scripts].find(s=>String(s.getAttribute('src')||'')===src||String(s.src||'').endsWith('/'+src));if(old){if(test&&test())return resolve();old.addEventListener('load',()=>resolve(),{once:true});setTimeout(()=>test&&test()?resolve():reject(new Error('تعذر تحميل '+src)),8000);return;}const el=document.createElement('script');el.src=src;el.async=false;el.onload=resolve;el.onerror=()=>reject(new Error('تعذر تحميل '+src));document.head.appendChild(el);})}
async function ensure(){await loadScript('platform-cloud-session.js',()=>!!window.PlatformCloudSession);await loadScript('platform-core-engine.js',()=>!!window.PlatformCore);if(window.PlatformCloudSession?.ensure)await window.PlatformCloudSession.ensure();}
async function emit(eventType,title,data={}){try{await ensure();const key=[eventType,title,Math.round(Number(data.progress)||0)].join('|');if(key===lastKey&&Date.now()-lastAt<1800)return;lastKey=key;lastAt=Date.now();const payload={moduleKey,recordType,recordId:String(rid||''),eventType,data:{...data,title,execution_source:'direct_role',page:PAGE,route:location.pathname+location.search}};const res=await window.PlatformCore.emitRecordEvent(payload);window.dispatchEvent(new CustomEvent('platform:record_updated',{detail:{moduleKey,recordType,recordId:rid,eventType,direct:true,result:res}}));window.dispatchEvent(new CustomEvent('platformdashboard:refresh'));return res;}catch(e){console.warn('[SchoolActivity] تعذر توثيق التنفيذ المباشر:',e?.message||e)}}
function progressFromPage(){try{
 if(PAGE==='administrative_employee_execution.html'&&typeof window.currentExecution==='function')return Number(window.currentExecution()?.progress||0);
 const candidates=['progress','executionProgress','completion','rate'];
 for(const id of candidates){const el=document.getElementById(id);if(el){const n=parseFloat(String(el.value||el.textContent||'').replace(/[^0-9.]/g,''));if(Number.isFinite(n))return Math.max(0,Math.min(100,n));}}
 return null;
}catch{return null}}
function schedule(title,eventType='record_updated',extra={}){clearTimeout(timer);timer=setTimeout(()=>{const p=progressFromPage();emit(eventType,title,{...extra,...(p==null?{}:{progress:p})})},500)}
function hook(){
 document.addEventListener('submit',()=>schedule('حفظ نموذج داخل القسم','record_updated'),true);
 document.addEventListener('click',e=>{const b=e.target.closest('button,a,[role="button"]');if(!b)return;const t=(b.textContent||'').trim();if(!t)return;if(/حفظ|تحديث|إضافة|إنشاء|تسجيل|اعتماد|إرسال|تنفيذ|استكمال|توليد/.test(t))schedule('تنفيذ إجراء: '+t.slice(0,80),/اعتماد|إرسال/.test(t)?'record_submitted':'record_updated');},true);
 window.addEventListener('platform:record_saved',e=>schedule(e.detail?.title||'حفظ السجل',e.detail?.completed?'record_completed':'record_updated',e.detail||{}));
 window.addEventListener('schoolactivity:emit',e=>{const d=e.detail||{};schedule(d.title||'تنفيذ داخل المنصة',d.eventType||'record_updated',d.data||{})});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();
window.SchoolActivity={emit:(eventType,title,data)=>emit(eventType,title,data),save:(title='حفظ السجل',data={})=>emit('record_updated',title,data),complete:(title='إكمال السجل',data={})=>emit('record_completed',title,{...data,progress:100})};
})();
