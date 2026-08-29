(function(){
'use strict';
if(window.__PLATFORM_PAGE_NAVIGATION_V2__) return;
window.__PLATFORM_PAGE_NAVIGATION_V2__=true;

const ROOT_PAGES=new Set([
  'index.html','manager.html','agent.html','student_advisor.html','health_advisor.html',
  'teacher.html','kindergarten_teacher.html','activity_leader.html','administrative_employee_portal.html',
  'school-login.html','register.html'
]);
function fileName(){return (location.pathname.split('/').pop()||'index.html').toLowerCase()}
function isRootPage(){return ROOT_PAGES.has(fileName())}
function roleRoot(){
  const f=fileName();
  if(f==='index.html'||f==='school-login.html'||f==='register.html') return 'index.html';
  const byFile=[
    [/manager|school_command_center|manager_records|manager_library|performance_evaluation|school_readiness|self_evaluation|staff_discipline|academic_year|supervisor_visit|central_task_center/,'manager.html'],
    [/agent|wakil|deputy|exam_committees/,'agent.html'],
    [/student_advisor/,'student_advisor.html'],[/health_advisor|school_health/,'health_advisor.html'],
    [/kindergarten_teacher/,'kindergarten_teacher.html'],[/activity_leader/,'activity_leader.html'],
    [/administrative_employee|admin_employee/,'administrative_employee_portal.html'],[/teacher/,'teacher.html']
  ];
  for(const [re,root] of byFile) if(re.test(f)) return root;
  const r=String(sessionStorage.getItem('smart_school_tab_role_v1')||localStorage.getItem('smart_school_active_role')||localStorage.getItem('platform_file_session_role')||'').toLowerCase();
  if(/manager|principal|leadership|مدير/.test(r)) return 'manager.html';
  if(/agent|wakil|deputy|agency|وكيل/.test(r)) return 'agent.html';
  if(/student_advisor|counselor/.test(r)) return 'student_advisor.html';
  if(/health/.test(r)) return 'health_advisor.html';
  if(/kindergarten/.test(r)) return 'kindergarten_teacher.html';
  if(/activity/.test(r)) return 'activity_leader.html';
  if(/administrative|admin_staff/.test(r)) return 'administrative_employee_portal.html';
  if(/teacher/.test(r)) return 'teacher.html';
  return 'school-login.html';
}
function norm(el){return String(el?.textContent||el?.getAttribute?.('aria-label')||el?.title||'').replace(/\s+/g,' ').trim()}
function topContext(el){
  if(!el) return false;
  if(el.id==='uwHomeHeader'||el.id==='uwExitHeader'||el.id==='ssBack'||el.id==='ssExit') return true;
  return !!el.closest('header,.topbar,.top-bar,.header,#ssFinalBar,.ss-final-bar,#uwHeaderActionsCluster,.uw-header-actions-cluster');
}
function homeControl(el){const t=norm(el);return topContext(el)&&(el.id==='uwHomeHeader'||el.id==='ssBack'||/^(🏠\s*)?(الرئيسية|الصفحة الرئيسية|العودة للقائمة|العودة للرئيسية)$/.test(t))}
function exitControl(el){const t=norm(el);return topContext(el)&&(el.id==='uwExitHeader'||el.id==='ssExit'||/^(⏻\s*)?(الخروج|تسجيل الخروج)$/.test(t))}
function cleanInternalHomeExit(){
  if(isRootPage()) return;
  document.querySelectorAll('a,button,[role="button"]').forEach(el=>{if(homeControl(el)||exitControl(el)) el.remove()});
  const c=document.getElementById('uwHeaderActionsCluster');
  if(c&&!c.children.length)c.remove();
}
function hasBack(){
  const els=[...document.querySelectorAll('a,button,[role="button"]')];
  return els.some(el=>{
    if(el.id==='platformContextBackBtn') return true;
    const t=norm(el);
    if(/(^|\s)(رجوع|عودة|العودة)(\s|$)/.test(t)&&!/(الرئيسية|القائمة|تسجيل الدخول|الخروج)/.test(t)) return true;
    const oc=String(el.getAttribute?.('onclick')||'');
    return /history\.(back|go\s*\(\s*-1)/.test(oc);
  });
}
function addBack(){
  if(isRootPage()||hasBack()||document.getElementById('platformContextBackBtn')) return;
  const b=document.createElement('button');
  b.id='platformContextBackBtn';b.type='button';b.className='platform-context-back';
  b.innerHTML='<span aria-hidden="true">←</span><span>رجوع</span>';
  b.setAttribute('aria-label','العودة للصفحة السابقة');b.title='العودة للصفحة السابقة';
  b.addEventListener('click',function(){
    try{
      const ref=document.referrer?new URL(document.referrer):null;
      if(ref&&ref.origin===location.origin){ location.href=roleRoot() + (roleRoot().includes('?')?'&':'?') + 'sectionHome=1'; return }
    }catch(_){ }
    location.href=roleRoot() + (roleRoot().includes('?')?'&':'?') + 'sectionHome=1';
  });
  document.body.appendChild(b);
}
function style(){
  if(document.getElementById('platformPageNavigationStyle'))return;
  const s=document.createElement('style');s.id='platformPageNavigationStyle';
  s.textContent=`.platform-context-back{position:fixed;top:14px;left:16px;z-index:2147482500;display:inline-flex;align-items:center;gap:7px;border:1px solid #d7e5e4;border-radius:13px;padding:9px 13px;background:#f5f8fa;color:#334155;font:800 12px Tajawal,Cairo,Tahoma,Arial,sans-serif;box-shadow:0 5px 18px rgba(15,23,42,.08);cursor:pointer}.platform-context-back:hover{background:#eaf4f2;color:#0f766e}.platform-context-back span:first-child{font-size:17px;line-height:1}@media(max-width:700px){.platform-context-back{top:10px;left:10px;padding:8px 10px}.platform-context-back span:last-child{display:none}}@media print{.platform-context-back{display:none!important}}`;
  document.head.appendChild(s);
}
function apply(){style();cleanInternalHomeExit();addBack()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;cleanInternalHomeExit();addBack()})}).observe(document.documentElement,{childList:true,subtree:true});
})();
