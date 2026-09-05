(function(){
'use strict';
if(window.__PLATFORM_PAGE_NAVIGATION_V2__) return;
window.__PLATFORM_PAGE_NAVIGATION_V2__=true;

const ROOT_PAGES=new Set([
  'index.html','manager.html','agent.html','student_advisor.html','health_advisor.html',
  'teacher.html','kindergarten_teacher.html','activity_leader.html','administrative_employee_portal.html',
  'school-login.html','register.html','administrative_employee_login.html'
]);
const ROLE_ROOTS=new Set([
  'manager.html','agent.html','student_advisor.html','health_advisor.html','teacher.html',
  'kindergarten_teacher.html','activity_leader.html','administrative_employee_portal.html'
]);
const VISIT_PAGES=new Set(['supervisor_visit.html','supervisor_visit_form.html']);
const q=()=>new URLSearchParams(location.search||'');
function fileName(){return (location.pathname.split('/').pop()||'index.html').toLowerCase()}
function isRootPage(){return ROOT_PAGES.has(fileName())}
function cleanFile(v){
  try{
    const s=String(v||'').trim(); if(!s)return '';
    const u=new URL(s,location.href); return (u.pathname.split('/').pop()||'').toLowerCase();
  }catch(_){return String(v||'').split(/[?#]/)[0].split('/').pop().toLowerCase()}
}
function specialContext(){
  const p=q(), f=fileName();
  if(VISIT_PAGES.has(f)) return true;
  if(p.get('systemAdmin')==='1'||p.get('systemAdminReturn')==='1'||p.get('accessMode')==='system_admin') return true;
  const follow=p.get('follow')==='1'||/supervisor_readonly/i.test(p.get('mode')||'');
  const viewer=String(p.get('viewer')||p.get('viewerRole')||p.get('returnRole')||'').toLowerCase();
  if(follow&&/(manager|agent|وكيل|مدير)/.test(viewer)) return true;
  return false;
}
function roleRoot(){
  const p=q();
  const explicit=cleanFile(p.get('return_to')||p.get('returnTo')||'');
  if(ROLE_ROOTS.has(explicit)) return explicit;
  const ref=(()=>{try{if(!document.referrer)return '';const u=new URL(document.referrer);if(u.origin!==location.origin)return '';return cleanFile(u.href)}catch(_){return ''}})();
  const f=fileName();
  if(f!=='admin_employee_management.html'&&ROLE_ROOTS.has(ref)) return ref;
  if(f==='admin_employee_management.html'){
    try{
      const s=String(p.get('supervisor')||p.get('viewerRole')||p.get('viewer')||p.get('returnRole')||'').toLowerCase();
      if(/agent|wakil|deputy|agency|وكيل/.test(s)) return 'agent.html';
      if(/manager|principal|leadership|مدير/.test(s)) return 'manager.html';
    }catch(_){}
  }
  const byFile=[
    [/decisions|manager|school_command_center|manager_records|manager_library|performance_evaluation|school_readiness|self_evaluation|staff_discipline|academic_year|central_task_center|external_evaluation/,'manager.html'],
    [/agent|wakil|deputy|exam_committees|student_affairs/,'agent.html'],
    [/student_advisor/,'student_advisor.html'],[/health_advisor|school_health/,'health_advisor.html'],
    [/kindergarten_teacher/,'kindergarten_teacher.html'],[/activity_leader/,'activity_leader.html'],
    [/administrative_employee|admin_employee/,'administrative_employee_portal.html'],[/teacher/,'teacher.html']
  ];
  for(const [re,root] of byFile) if(re.test(f)) return root;
  const r=String(sessionStorage.getItem('smart_school_tab_role_v1')||localStorage.getItem('smart_school_active_role')||localStorage.getItem('platform_file_session_role')||'').toLowerCase();
  if(/manager|principal|leadership|مدير/.test(r)) return 'manager.html';
  if(/agent|wakil|deputy|agency|وكيل/.test(r)) return 'agent.html';
  if(/student_advisor|counselor|موجه/.test(r)) return 'student_advisor.html';
  if(/health|صحي/.test(r)) return 'health_advisor.html';
  if(/kindergarten|رياض/.test(r)) return 'kindergarten_teacher.html';
  if(/activity|نشاط/.test(r)) return 'activity_leader.html';
  if(/administrative|admin_staff|إداري/.test(r)) return 'administrative_employee_portal.html';
  if(/teacher|معلم/.test(r)) return 'teacher.html';
  return 'manager.html';
}
function sectionHomeUrl(){
  const root=roleRoot();
  if(!ROLE_ROOTS.has(root))return root;
  const u=new URL(root,location.href);
  u.searchParams.set('return_to','sections');
  const sid=q().get('schoolId')||q().get('school_id')||'';
  if(sid)u.searchParams.set('schoolId',sid);
  return u.pathname.split('/').pop()+u.search;
}
function norm(el){
  return String(el?.textContent||el?.getAttribute?.('aria-label')||el?.getAttribute?.('title')||'').replace(/\s+/g,' ').trim();
}
function isCandidate(el){
  if(!el||!el.matches?.('a,button,[role="button"]'))return false;
  if(el.closest('[data-platform-nav-ignore="1"]'))return false;
  if(el.id==='platformContextBackBtn'||el.hasAttribute('data-platform-back'))return true;
  const idc=((el.id||'')+' '+(el.className||'')).toLowerCase();
  const t=norm(el);
  const oc=String(el.getAttribute('onclick')||'');
  const href=String(el.getAttribute('href')||'');
  if(/(?:^|[-_\s])(back|return)(?:[-_\s]|$)/.test(idc))return true;
  if(/history\s*\.\s*(?:back\s*\(|go\s*\(\s*-1)/i.test(oc))return true;
  if(/(?:^|\s)(?:رجوع|عودة|العودة)(?:\s|$)/.test(t))return true;
  if(/^(?:←|↩|↪|⬅|⬅️|❮|‹)\s*$/.test(t))return true;
  if(/^(?:🏠\s*)?(?:الرئيسية|الصفحة الرئيسية|القائمة الرئيسية|واجهة القسم|الأقسام الرئيسية)\s*$/.test(t))return true;
  if(/(?:manager|agent|teacher|student_advisor|health_advisor|activity_leader|kindergarten_teacher|administrative_employee_portal)\.html/i.test(href)&&/←|رجوع|عودة|الرئيسية/.test(t))return true;
  return false;
}
function score(el){
  let s=0; const t=norm(el), idc=((el.id||'')+' '+(el.className||'')).toLowerCase();
  if(el.id==='platformContextBackBtn')s+=100;
  if(el.hasAttribute('data-platform-back'))s+=90;
  if(/manager-return-btn|platform.*back|return-btn|back-btn/.test(idc))s+=60;
  if(el.closest('header,.topbar,.top-bar,.header,.page-header,.toolbar,nav'))s+=35;
  if(/رجوع|العودة|عودة/.test(t))s+=20;
  if(/^(?:←|↩|⬅|⬅️|❮|‹)$/.test(t))s+=10;
  return s;
}
function candidates(){return [...document.querySelectorAll('a,button,[role="button"]')].filter(isCandidate)}
function ensureStyle(){
  if(document.getElementById('platformPageNavigationStyleV2'))return;
  const s=document.createElement('style');s.id='platformPageNavigationStyleV2';
  s.textContent='[data-platform-nav-dedup-hidden="1"]{display:none!important}.platform-context-back{position:fixed;top:14px;left:16px;z-index:2147482500;display:inline-flex;align-items:center;gap:7px;border:1px solid #d7e5e4;border-radius:13px;padding:9px 13px;background:#f5f8fa;color:#334155;font:800 12px Tajawal,Cairo,Tahoma,Arial,sans-serif;box-shadow:0 5px 18px rgba(15,23,42,.08);cursor:pointer}.platform-context-back:hover{background:#eaf4f2;color:#0f766e}.platform-context-back span:first-child{font-size:17px;line-height:1}@media(max-width:700px){.platform-context-back{top:10px;left:10px;padding:8px 10px}.platform-context-back span:last-child{display:none}}@media print{.platform-context-back,[data-platform-nav-primary="1"]{display:none!important}}';
  document.head.appendChild(s);
}
function createBack(){
  const b=document.createElement('button');
  b.id='platformContextBackBtn';b.type='button';b.className='platform-context-back';b.setAttribute('data-platform-back','1');
  b.innerHTML='<span aria-hidden="true">←</span><span>رجوع</span>';
  b.setAttribute('aria-label','العودة إلى واجهة القسم الرئيسية');b.title='العودة إلى واجهة القسم الرئيسية';
  document.body.appendChild(b);return b;
}
let primary=null;
function normalizeBackTools(){
  if(isRootPage()||specialContext())return;
  ensureStyle();
  let list=candidates();
  if(!list.length)list=[createBack()];
  list.sort((a,b)=>score(b)-score(a));
  primary=list[0];
  list.forEach((el,i)=>{
    if(i===0){
      el.removeAttribute('data-platform-nav-dedup-hidden');el.setAttribute('data-platform-nav-primary','1');
      el.setAttribute('aria-label','العودة إلى واجهة القسم الرئيسية');el.setAttribute('title','العودة إلى واجهة القسم الرئيسية');
      if(el.tagName==='A')el.setAttribute('href',sectionHomeUrl());
    }else{
      el.removeAttribute('data-platform-nav-primary');el.setAttribute('data-platform-nav-dedup-hidden','1');el.setAttribute('aria-hidden','true');el.setAttribute('tabindex','-1');
    }
  });
}
function intercept(e){
  if(isRootPage()||specialContext())return;
  const el=e.target?.closest?.('a,button,[role="button"]');
  if(!el||el!==primary)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  location.href=sectionHomeUrl();
}
function directSectionHomeIfRequested(){
  if(!isRootPage()||specialContext()||q().get('return_to')!=='sections')return;
  const f=fileName();
  const run=async()=>{
    try{if(window.__PLATFORM_ACCESS_READY__&&typeof window.__PLATFORM_ACCESS_READY__.then==='function')await window.__PLATFORM_ACCESS_READY__;}catch(_){ }
    try{
      if(f==='manager.html'&&typeof window.showManagerSectionsHome==='function')window.showManagerSectionsHome();
      else if(typeof window.enterApp==='function')window.enterApp();
      else{
        const gate=document.getElementById('welcome-gate'),dash=document.getElementById('welcome-dashboard');
        if(gate)gate.style.display='none'; if(dash)dash.style.display='block';
      }
      const u=new URL(location.href);u.searchParams.delete('return_to');history.replaceState(null,'',u.pathname+u.search+u.hash);
    }catch(e){console.warn('[navigation] section-home handoff failed',e)}
  };
  if(document.readyState==='complete')setTimeout(run,80);else window.addEventListener('load',()=>setTimeout(run,80),{once:true});
}
function apply(){directSectionHomeIfRequested();normalizeBackTools()}
document.addEventListener('click',intercept,true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
let queued=false;
new MutationObserver(()=>{if(queued||isRootPage()||specialContext())return;queued=true;requestAnimationFrame(()=>{queued=false;normalizeBackTools()})}).observe(document.documentElement,{childList:true,subtree:true});
})();
