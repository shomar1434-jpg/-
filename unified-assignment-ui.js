(function(){
'use strict';
const ACTIVE=new Set(['active','in_progress','transferred','pending_approval','returned']);
const ROOT_ID='platformUnifiedAssignmentBar';
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function injectStyle(){if(document.getElementById('pua-style'))return;const s=document.createElement('style');s.id='pua-style';s.textContent=`
#${ROOT_ID}{direction:rtl;display:flex;align-items:center;gap:9px;width:min(1500px,calc(100% - 24px));margin:8px auto 12px;padding:8px 11px;min-height:48px;border:1px solid #b8ddd8;border-radius:14px;background:linear-gradient(90deg,#f8fffd,#eef9f7);box-shadow:0 6px 18px rgba(15,118,110,.08);overflow:hidden}
#${ROOT_ID}[hidden]{display:none!important}.pua-pin{width:31px;height:31px;display:grid;place-items:center;border-radius:10px;background:#0f766e;color:#fff;flex:0 0 auto}.pua-label{font-size:13px;font-weight:900;color:#0b5d56;white-space:nowrap}.pua-count{font-size:10px;font-weight:900;background:#0f766e;color:#fff;padding:3px 7px;border-radius:999px;white-space:nowrap}.pua-list{display:flex;gap:6px;align-items:center;overflow-x:auto;overflow-y:hidden;white-space:nowrap;flex:1;padding:1px 0;scrollbar-width:thin}.pua-item{border:1px solid #d1e8e4;background:#fff;border-radius:999px;padding:6px 10px;color:#244;font-size:11px;font-weight:800;cursor:pointer}.pua-item:hover{border-color:#0f766e;color:#0f766e}.pua-center{border:0;border-radius:10px;background:#0f766e;color:#fff;padding:7px 11px;font-size:11px;font-weight:900;white-space:nowrap;cursor:pointer;flex:0 0 auto}@media(max-width:680px){#${ROOT_ID}{width:calc(100% - 12px);gap:6px}.pua-label{display:none}.pua-list{max-width:58vw}.pua-center{padding:7px 8px}}
`;document.head.appendChild(s)}
function mount(){return document.querySelector('[data-assignment-bar-mount]')||document.querySelector('main')||document.querySelector('.container')||document.body}
function center(taskId){location.href='central_task_center.html?mode=assignee'+(taskId?'&task_id='+encodeURIComponent(taskId):'')}
function removeLegacy(){['platformAdditionalAssignments','additionalRolesSection','teacherExtraRoles','extraAssignmentsSection'].forEach(id=>{const n=document.getElementById(id);if(n&&id!==ROOT_ID)n.remove()});document.querySelectorAll('[data-legacy-additional-assignments]').forEach(n=>n.remove())}
function render(rows){injectStyle();removeLegacy();let bar=document.getElementById(ROOT_ID);if(!bar){bar=document.createElement('aside');bar.id=ROOT_ID;bar.setAttribute('role','status');const m=mount();m.insertBefore(bar,m.firstChild)}
 const active=(rows||[]).filter(x=>ACTIVE.has(String(x.status||'active')));bar.hidden=!active.length;if(!active.length){bar.innerHTML='';return}
 bar.innerHTML=`<div class="pua-pin">📌</div><div class="pua-label">تكليفاتي الإضافية</div><div class="pua-count">${active.length} نشط</div><div class="pua-list">${active.map(t=>`<button class="pua-item" data-task="${esc(t.id||t.task_id)}">${esc(t.title||'تكليف')}</button>`).join('')}</div><button class="pua-center">فتح مركز تكليفاتي</button>`;
 bar.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>center(b.dataset.task));bar.querySelector('.pua-center').onclick=()=>center(active[0]?.id||active[0]?.task_id||'')
}
async function load(){if(!window.PlatformCore)return;try{const r=await PlatformCore.myAssignments();render(r.assignments||[])}catch(e){console.warn('[UnifiedAssignments] تعذر التحميل:',e.message||e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
['cloudtasks:changed','platformcore:ready','platform:record_updated'].forEach(x=>window.addEventListener(x,load));window.addEventListener('focus',load);
window.UnifiedAssignmentUI={load,render,open:center};
})();
