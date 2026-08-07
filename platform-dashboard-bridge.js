(function(){
'use strict';
let timer=null,last=null;
const metricAliases={
 total:['total_tasks','total'],active:['active_tasks','active'],pending:['pending_approval','pending'],approved:['approved_tasks','approved'],overdue:['overdue_tasks','overdue'],progress:['operational_execution_progress','average_progress','completion_rate','progress'],operational:['operational_execution_progress'],activity_events:['school_activity_events_30d'],direct_events:['direct_execution_events_30d'],delegated_events:['delegated_execution_events_30d'],active_users:['active_execution_users_30d'],executed_records:['executed_records_30d'],events:['events_30d'],returned:['returned_tasks'],first_pass:['first_pass_approval_rate']
};
function value(summary,key){const keys=metricAliases[key]||[key];for(const k of keys)if(summary&&summary[k]!==undefined&&summary[k]!==null)return summary[k];return 0}
function publish(data){last=data||{};const a=last.activity||{};last.summary={...(last.summary||{}),operational_execution_progress:a.operational_execution_progress??0,school_activity_events_30d:a.total_events??0,direct_execution_events_30d:a.direct_events??0,delegated_execution_events_30d:a.delegated_events??0,active_execution_users_30d:a.active_users??0,executed_records_30d:a.unique_records??0,last_operational_activity_at:a.last_activity_at??null};window.PlatformDashboardData=last;const s=last.summary||{};document.querySelectorAll('[data-core-metric]').forEach(el=>{el.textContent=value(s,el.dataset.coreMetric)});document.querySelectorAll('[data-dashboard-last-update]').forEach(el=>el.textContent=new Date().toLocaleString('ar-SA'));window.dispatchEvent(new CustomEvent('platformdashboard:updated',{detail:last}))}
function auditPage(){const issues=[];document.querySelectorAll('[data-core-metric]').forEach(el=>{if(!el.dataset.coreMetric)issues.push('مؤشر بلا مفتاح')});return {page:location.pathname.split('/').pop(),metrics:document.querySelectorAll('[data-core-metric]').length,issues}}
async function refresh(){if(!window.PlatformCore)return;try{const data=await PlatformCore.dashboard();publish(data);window.PlatformDashboardAudit=auditPage()}catch(e){console.warn('[DashboardBridge] تعذر تحديث المؤشرات:',e.message||e)}}
function start(){refresh();clearInterval(timer);timer=setInterval(refresh,60000);['focus','cloudtasks:changed','platform:record_updated','platformdashboard:refresh'].forEach(x=>window.addEventListener(x,refresh))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.PlatformDashboardBridge={refresh,getLast:()=>last,audit:auditPage,value};
})();
