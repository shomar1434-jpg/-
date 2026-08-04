(function(){
'use strict';
const ACTIVE=new Set(['active','in_progress','transferred','pending_approval','returned']);
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function style(){if(document.getElementById('paa-style'))return;const s=document.createElement('style');s.id='paa-style';s.textContent=`
#platformAdditionalAssignments{direction:rtl;margin:18px auto;max-width:1180px;border:1px solid #b9e2dc;border-radius:22px;background:linear-gradient(135deg,#f8fffd,#eef9f7);box-shadow:0 15px 40px #0f766e14;padding:18px}.paa-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.paa-title{font-weight:900;color:#0b5d56;font-size:20px}.paa-count{background:#0f766e;color:#fff;border-radius:999px;padding:5px 11px;font-weight:900}.paa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:14px}.paa-card{background:#fff;border:1px solid #d8ece8;border-radius:17px;padding:15px}.paa-card h4{margin:0 0 8px;color:#123}.paa-meta{font-size:12px;color:#64748b;line-height:1.8}.paa-btn{display:inline-flex;margin-top:10px;background:#0f766e;color:#fff;border:0;border-radius:11px;padding:9px 14px;font-weight:900;cursor:pointer}.paa-empty{color:#64748b;padding:10px 0}.paa-top-link{position:relative;display:inline-flex;align-items:center;gap:6px}.paa-badge{min-width:20px;height:20px;border-radius:999px;background:#dc2626;color:#fff;font-size:11px;font-weight:900;align-items:center;justify-content:center;padding:0 5px}`;document.head.appendChild(s)}
function findMount(){return document.querySelector('[data-additional-assignments-mount]')||document.querySelector('main')||document.querySelector('.container')||document.body}
function render(assignments){style();let box=document.getElementById('platformAdditionalAssignments');if(!box){box=document.createElement('section');box.id='platformAdditionalAssignments';const mount=findMount();mount.insertBefore(box,mount.firstChild)}
 const rows=(assignments||[]).filter(x=>ACTIVE.has(x.status));box.hidden=!rows.length;if(!rows.length)return;
 box.innerHTML=`<div class="paa-head"><div class="paa-title">تكليفاتي الإضافية</div><div class="paa-count">${rows.length} تكليف نشط</div></div><div class="paa-grid">${rows.map(t=>`<article class="paa-card"><h4>${esc(t.title)}</h4><div class="paa-meta">الحالة: ${esc(t.status)} · التقدم: ${Number(t.progress_percent||0)}%<br>${t.due_date?'ينتهي في: '+esc(t.due_date):'دون تاريخ انتهاء محدد'}<br>${t.assignee_role?'صفة التكليف: '+esc(t.assignee_role):''}</div><button class="paa-btn" data-open-assignment="${esc(t.id)}">فتح مساحة التكليف</button></article>`).join('')}</div>`;
 box.querySelectorAll('[data-open-assignment]').forEach(b=>b.addEventListener('click',()=>PlatformCore.openAssignment(b.getAttribute('data-open-assignment'))));
}
async function load(){if(!window.PlatformCore)return;try{const r=await PlatformCore.myAssignments();render(r.assignments||[])}catch(e){console.warn('تعذر تحميل التكليفات الإضافية:',e.message||e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
window.addEventListener('cloudtasks:changed',load);window.addEventListener('focus',load);
window.MyAdditionalAssignments={load,render};
})();
