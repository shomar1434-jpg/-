(function(){
'use strict';
const ACTIVE=new Set(['active','in_progress','transferred','pending_approval','returned']);
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function style(){if(document.getElementById('paa-style'))return;const s=document.createElement('style');s.id='paa-style';s.textContent=`
#platformAdditionalAssignments{direction:rtl;margin:10px auto 14px;max-width:min(1500px,calc(100% - 24px));border:1px solid #b9e2dc;border-radius:16px;background:linear-gradient(90deg,#f8fffd,#eef9f7);box-shadow:0 8px 22px #0f766e12;padding:9px 12px;display:flex;align-items:center;gap:10px;min-height:54px;overflow:hidden}.paa-icon{width:34px;height:34px;border-radius:12px;background:#0f766e;color:#fff;display:grid;place-items:center;flex:0 0 auto;font-size:17px}.paa-title{font-weight:900;color:#0b5d56;font-size:14px;white-space:nowrap}.paa-count{background:#0f766e;color:#fff;border-radius:999px;padding:3px 8px;font-weight:900;font-size:11px;white-space:nowrap}.paa-tasks{display:flex;align-items:center;gap:7px;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;flex:1;padding:2px 0;white-space:nowrap}.paa-task{border:1px solid #d7ebe7;background:#fff;color:#234;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:800;cursor:pointer}.paa-task:hover{border-color:#0f766e;color:#0f766e}.paa-open{display:inline-flex;align-items:center;background:#0f766e;color:#fff;border:0;border-radius:11px;padding:8px 12px;font-weight:900;cursor:pointer;white-space:nowrap;font-size:11px;flex:0 0 auto}@media(max-width:700px){#platformAdditionalAssignments{padding:8px;gap:7px}.paa-title{font-size:12px}.paa-count{font-size:10px}.paa-open{padding:7px 9px}.paa-tasks{max-width:48vw}}
`;document.head.appendChild(s)}
function findMount(){return document.querySelector('[data-additional-assignments-mount]')||document.querySelector('main')||document.querySelector('.container')||document.body}
function openCenter(id){location.href='central_task_center.html?mode=assignee'+(id?'&task_id='+encodeURIComponent(id):'')}
function render(assignments){style();let box=document.getElementById('platformAdditionalAssignments');if(!box){box=document.createElement('aside');box.id='platformAdditionalAssignments';box.setAttribute('role','status');const mount=findMount();mount.insertBefore(box,mount.firstChild)}
 const rows=(assignments||[]).filter(x=>ACTIVE.has(x.status));box.hidden=!rows.length;if(!rows.length){box.innerHTML='';return}
 box.innerHTML=`<div class="paa-icon">📌</div><div class="paa-title">تكليفاتي الإضافية</div><div class="paa-count">${rows.length} نشط</div><div class="paa-tasks">${rows.map(t=>`<button class="paa-task" data-open-assignment="${esc(t.id)}" title="فتح ${esc(t.title)}">${esc(t.title)}</button>`).join('')}</div><button class="paa-open" data-open-center>فتح مركز تكليفاتي</button>`;
 box.querySelectorAll('[data-open-assignment]').forEach(b=>b.addEventListener('click',()=>openCenter(b.getAttribute('data-open-assignment'))));
 box.querySelector('[data-open-center]')?.addEventListener('click',()=>openCenter(rows[0]?.id||''));
}
async function load(){if(!window.PlatformCore)return;try{const r=await PlatformCore.myAssignments();render(r.assignments||[])}catch(e){console.warn('تعذر تحميل تنبيه التكليفات:',e.message||e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
window.addEventListener('cloudtasks:changed',load);window.addEventListener('focus',load);
window.MyAdditionalAssignments={load,render};
})();
