(function(){
'use strict';
let timer=null,last=null;
const metricAliases={
 total:['total_tasks','total'],active:['active_tasks','active'],pending:['pending_approval','pending'],approved:['approved_tasks','approved'],overdue:['overdue_tasks','overdue'],progress:['average_progress','completion_rate','progress'],events:['events_30d'],returned:['returned_tasks'],first_pass:['first_pass_approval_rate']
};
function value(summary,key){const keys=metricAliases[key]||[key];for(const k of keys)if(summary&&summary[k]!==undefined&&summary[k]!==null)return summary[k];return 0}
function publish(data){last=data||{};window.PlatformDashboardData=last;const s=last.summary||{};document.querySelectorAll('[data-core-metric]').forEach(el=>{el.textContent=value(s,el.dataset.coreMetric)});document.querySelectorAll('[data-dashboard-last-update]').forEach(el=>el.textContent=new Date().toLocaleString('ar-SA'));window.dispatchEvent(new CustomEvent('platformdashboard:updated',{detail:last}))}
function auditPage(){const issues=[];document.querySelectorAll('[data-core-metric]').forEach(el=>{if(!el.dataset.coreMetric)issues.push('مؤشر بلا مفتاح')});return {page:location.pathname.split('/').pop(),metrics:document.querySelectorAll('[data-core-metric]').length,issues}}
async function refresh(){if(!window.PlatformCore)return;try{const data=await PlatformCore.dashboard();publish(data);window.PlatformDashboardAudit=auditPage()}catch(e){console.warn('[DashboardBridge] تعذر تحديث المؤشرات:',e.message||e)}}
function start(){refresh();clearInterval(timer);timer=setInterval(refresh,60000);['focus','cloudtasks:changed','platform:record_updated','platformdashboard:refresh'].forEach(x=>window.addEventListener(x,refresh))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.PlatformDashboardBridge={refresh,getLast:()=>last,audit:auditPage,value};
})();
