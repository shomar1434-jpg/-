(function(){
'use strict';
if(window.__SCHOOL_NAVIGATION_GUARD_V3__)return;window.__SCHOOL_NAVIGATION_GUARD_V3__=true;

function isSystemAdminContext(){
 try{
   var q=new URLSearchParams(location.search||'');
   if(q.get('systemAdmin')==='1'||q.get('systemAdminReturn')==='1')return true;
   if(q.get('returnHome')&&/index\.html/i.test(q.get('returnHome')))return true;
   if(sessionStorage.getItem('system_admin_context')==='1'||sessionStorage.getItem('system_admin_verified')==='true')return true;
   var u=window.currentUser||window.SmartSchoolCurrentUser||null;
   if(u&&(u.isRootAdmin===true||u.isSystemAdmin===true||u.role==='system_admin'))return true;
 }catch(_){}
 return false;
}

function ownerHome(){
 try{
   var q=new URLSearchParams(location.search||'');
   var r=q.get('returnHome');
   if(r&&/index\.html/i.test(r))return r;
 }catch(_){}
 return 'index.html?systemAdminReturn=1';
}

function roleRoot(){
 if(isSystemAdminContext())return ownerHome();
 const f=(location.pathname.split('/').pop()||'').toLowerCase();
 if(/manager/.test(f))return'manager.html';if(/agent|wakil|deputy/.test(f))return'agent.html';
 if(/student_advisor/.test(f))return'student_advisor.html';if(/health_advisor/.test(f))return'health_advisor.html';
 if(/kindergarten_teacher/.test(f))return'kindergarten_teacher.html';if(/activity_leader/.test(f))return'activity_leader.html';
 if(/administrative_employee|admin_employee/.test(f))return'administrative_employee_portal.html';if(/teacher/.test(f))return'teacher.html';
 const r=String(sessionStorage.getItem('smart_school_tab_role_v1')||localStorage.getItem('smart_school_active_role')||localStorage.getItem('platform_file_session_role')||'').toLowerCase();
 if(/leadership|manager|principal|مدير/.test(r))return'manager.html';if(/agency|agent|wakil|deputy|وكيل/.test(r))return'agent.html';
 if(/student_advisor|counselor/.test(r))return'student_advisor.html';if(/health/.test(r))return'health_advisor.html';
 if(/kindergarten/.test(r))return'kindergarten_teacher.html';if(/activity/.test(r))return'activity_leader.html';
 if(/administrative|admin_staff/.test(r))return'administrative_employee_portal.html';if(/teacher|performance/.test(r))return'teacher.html';
 return'school-login.html';
}

async function ownerLogout(){
 try{
   var sb=window.SmartSchoolSupabase?.getClient?.();
   if(sb?.auth?.signOut)await sb.auth.signOut();
 }catch(_){}
 try{
   ['system_admin_context','system_admin_verified'].forEach(k=>sessionStorage.removeItem(k));
   ['is_admin_session','admin_verified'].forEach(k=>localStorage.removeItem(k));
 }catch(_){}
 location.replace('index.html');
}

function currentSchoolRef(){
 try{
   var q=new URLSearchParams(location.search||'');
   var session=null;try{session=JSON.parse(localStorage.getItem('smart_school_current_session')||sessionStorage.getItem('smart_school_current_session')||'null')}catch(_){}
   var current=null;try{current=JSON.parse(localStorage.getItem('smartSchool.currentSchool')||'null')}catch(_){}
   return String(
     q.get('schoolId')||q.get('school_id')||q.get('school')||q.get('schoolCode')||
     sessionStorage.getItem('smart_school_tab_school_v1')||sessionStorage.getItem('current_school_id')||
     localStorage.getItem('active_school_id')||localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||localStorage.getItem('smart_school_id')||
     (session&&(session.schoolId||session.school_id))||(current&&(current.schoolId||current.school_id||current.id||current.schoolCode||current.school_code))||''
   ).trim();
 }catch(_){return ''}
}
function clearSchoolContext(){
 try{window.PlatformCloudSession?.clear?.()}catch(_){}
 const keys=[
   'smart_school_active_school_id','smart_school_active_school_name','smart_school_active_membership_id','smart_school_active_role',
   'active_school_id','active_school_name','active_school_code','activeSchoolId','selected_school_id',
   'current_school_id','current_school_name','school_id','school_name','school_code','smart_school_id','smart_school_name','persist_school',
   'smartSchool.currentSchool','smartSchool:activeSchool','smart_school_active_school','smart_school_current_session','independent_school_mode',
   'currentRole','user_role','platform_file_session_school_id','platform_file_session_role','administrative_employee_tab_session_v1',
   'smart_school_tab_school_v1','smart_school_tab_role_v1','platform_tab_session_token_v1','platform_tab_session_school_id_v1','platform_tab_session_role_v1'
 ];
 try{keys.forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k)})}catch(_){}
}
function schoolLogout(){
 const sid=currentSchoolRef();
 clearSchoolContext();
 const q=new URLSearchParams();
 if(sid)q.set('schoolId',sid);
 q.set('logout','1');
 location.replace('school-login.html?'+q.toString());
}

function logout(){return isSystemAdminContext()?ownerLogout():schoolLogout()}

document.addEventListener('click',function(e){
 const el=e.target?.closest?.('a,button,[role="button"]');if(!el)return;
 const t=String(el.textContent||'').replace(/\s+/g,' ').trim();
 if(el.id==='uwExitHeader'||/^(⏻\s*)?الخروج$/.test(t)||/^تسجيل الخروج$/.test(t)){
   e.preventDefault();e.stopImmediatePropagation();logout();return;
 }
 if(el.id==='uwHomeHeader'||/^(🏠\s*)?الرئيسية$/.test(t)){
   e.preventDefault();e.stopImmediatePropagation();location.href=roleRoot();
 }
},true);

window.SchoolNavigationGuard={roleRoot,logout,isSystemAdminContext,ownerHome};
})();

/* =========================================================
   Independent School Role Flow V1
   - يحافظ على جلسة المدرسة الحالية ولا ينشئ جلسة جديدة.
   - يفتح واجهة الأقسام مباشرة عند العودة من صفحة داخلية.
   - يمنع بقاء طبقة الترحيب/التنشيط فوق بطاقات الأقسام.
   - لا يفرض دورًا جديدًا حتى لا يكسر نظام التفويض والتكليف.
   ========================================================= */
(function(){
'use strict';
if(window.__INDEPENDENT_SCHOOL_ROLE_FLOW_V1__) return;
window.__INDEPENDENT_SCHOOL_ROLE_FLOW_V1__=true;
const ROOTS=new Set(['manager.html','agent.html','teacher.html','student_advisor.html','health_advisor.html','kindergarten_teacher.html','activity_leader.html','administrative_employee_portal.html']);
function file(){return (location.pathname.split('/').pop()||'').toLowerCase()}
function wantsSectionHome(){try{return new URLSearchParams(location.search||'').get('sectionHome')==='1'}catch(_){return false}}
function hasSchoolContext(){try{return !!(sessionStorage.getItem('platform_tab_session_token_v1')||localStorage.getItem('platform_session_token_v1')||sessionStorage.getItem('smart_school_tab_school_v1')||localStorage.getItem('active_school_id')||localStorage.getItem('smart_school_current_session'))}catch(_){return false}}
function revealSectionsHome(){
  const activation=document.getElementById('activation-overlay');
  if(activation){activation.style.setProperty('display','none','important');activation.style.setProperty('visibility','hidden','important');activation.style.setProperty('pointer-events','none','important')}
  const gate=document.getElementById('welcome-gate');
  if(gate){gate.style.setProperty('display','none','important');gate.style.setProperty('visibility','hidden','important');gate.style.setProperty('pointer-events','none','important')}
  const dash=document.getElementById('welcome-dashboard');
  if(dash){dash.classList.remove('hidden');dash.style.setProperty('display','block','important');dash.style.setProperty('visibility','visible','important');dash.style.setProperty('opacity','1','important');dash.style.setProperty('pointer-events','auto','important')}
  try{document.documentElement.removeAttribute('data-role-entry-blocked')}catch(_){}
}
async function boot(){
  if(!ROOTS.has(file())||isSystemAdminContext()) return;
  if(!hasSchoolContext()&&!wantsSectionHome()) return; // يحافظ على الاستخدام القديم خارج المدرسة المستقلة
  try{
    if(window.PlatformCloudSession&&typeof PlatformCloudSession.ensure==='function') await PlatformCloudSession.ensure();
    // manager.html لديه حارس أمني مستقل؛ لا نتجاوزه، بل نصلح حالة الواجهة فقط بعد وجود الجلسة.
    revealSectionsHome();
    requestAnimationFrame(revealSectionsHome);
    setTimeout(revealSectionsHome,120);
  }catch(e){
    console.warn('[independent-school-role-flow] session not ready',e);
    // لا نمسح الجلسة ولا نعيد توجيه المستخدم من هنا؛ الحارس الأمني المختص يتولى ذلك.
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('pageshow',function(){if(ROOTS.has(file())&&(wantsSectionHome()||hasSchoolContext()))boot()});
})();
