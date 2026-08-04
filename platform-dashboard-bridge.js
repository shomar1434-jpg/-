(function(){
'use strict';
let timer=null,last=null;
function publish(data){last=data;window.PlatformDashboardData=data;window.dispatchEvent(new CustomEvent('platformdashboard:updated',{detail:data}));document.querySelectorAll('[data-core-metric]').forEach(el=>{const k=el.getAttribute('data-core-metric');if(data?.summary&&k in data.summary)el.textContent=data.summary[k]??0});}
async function refresh(){if(!window.PlatformCore)return;try{publish(await PlatformCore.dashboard())}catch(e){console.warn('تعذر تحديث مؤشرات Platform Core:',e.message||e)}}
function start(){refresh();clearInterval(timer);timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);window.addEventListener('cloudtasks:changed',refresh);window.addEventListener('platform:record_updated',refresh)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.PlatformDashboardBridge={refresh,getLast:()=>last};
})();
