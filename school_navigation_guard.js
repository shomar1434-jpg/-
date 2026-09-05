(function(){
'use strict';
if(window.__SCHOOL_NAVIGATION_GUARD_V4__)return;window.__SCHOOL_NAVIGATION_GUARD_V4__=true;

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
 const r=String(sessionStorage.getItem('smart_school_tab_role_v1')||sessionStorage.getItem('currentRole')||'').toLowerCase();
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
   var session=null;try{session=JSON.parse(sessionStorage.getItem('smart_school_current_session')||'null')}catch(_){}
   var tab=String(sessionStorage.getItem('smart_school_tab_school_v1')||sessionStorage.getItem('platform_tab_session_school_id_v1')||sessionStorage.getItem('current_school_id')||(session&&(session.schoolId||session.school_id))||'').trim();
   if(tab)return tab;
   // RL33 fail-closed: school pages must not inherit another tab's localStorage identity.
   return String(q.get('schoolId')||q.get('school_id')||q.get('school')||q.get('schoolCode')||'').trim();
 }catch(_){return ''}
}
function clearSchoolContext(){
 try{window.PlatformCloudSession?.clear?.()}catch(_){}
 const tabKeys=[
   'smart_school_active_school_id','smart_school_active_school_name','smart_school_active_membership_id','smart_school_active_role',
   'active_school_id','active_school_name','active_school_code','activeSchoolId','selected_school_id',
   'current_school_id','current_school_name','school_id','school_name','school_code','smart_school_id','smart_school_name','persist_school',
   'smartSchool.currentSchool','smartSchool:activeSchool','smart_school_active_school','smart_school_current_session','independent_school_mode',
   'currentRole','user_role','currentUser','currentSchoolUser','currentUserId','currentUserEmail','currentUserName',
   'platform_file_session_token','platform_file_session_expires_at','platform_file_session_user_id','platform_file_session_school_id','platform_file_session_role','administrative_employee_tab_session_v1',
   'smart_school_tab_school_v1','smart_school_tab_role_v1','smart_school_tab_membership_v1','platform_tab_session_token_v1','platform_tab_session_expires_at_v1','platform_tab_session_user_id_v1','platform_tab_session_school_id_v1','platform_tab_session_role_v1'
 ];
 // RL33: logout is tab-scoped. Never erase shared localStorage identity/data used by another open account/tab.
 try{tabKeys.forEach(k=>sessionStorage.removeItem(k))}catch(_){}
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
   Independent School Role Flow V2
   State contract:
   1) first role entry => preserve original welcome gate;
   2) enterApp() => original page opens role sections;
   3) internal Back => ?sectionHome=1 => sections home directly.
   School/session validation NEVER chooses the visual stage.
   ========================================================= */
(function(){
'use strict';
if(window.__INDEPENDENT_SCHOOL_ROLE_FLOW_V2__) return;
window.__INDEPENDENT_SCHOOL_ROLE_FLOW_V2__=true;
const ROOTS=new Set(['manager.html','agent.html','teacher.html','student_advisor.html','health_advisor.html','kindergarten_teacher.html','activity_leader.html','administrative_employee_portal.html']);
function file(){return (location.pathname.split('/').pop()||'').toLowerCase()}
function wantsSectionHome(){try{return new URLSearchParams(location.search||'').get('sectionHome')==='1'}catch(_){return false}}
function hasSchoolContext(){try{return !!(sessionStorage.getItem('platform_tab_session_token_v1')||sessionStorage.getItem('smart_school_tab_school_v1')||sessionStorage.getItem('smart_school_current_session'))}catch(_){return false}}
function clearTransientLayers(){
  const activation=document.getElementById('activation-overlay');
  if(activation){activation.style.setProperty('display','none','important');activation.style.setProperty('visibility','hidden','important');activation.style.setProperty('pointer-events','none','important')}
  try{document.documentElement.removeAttribute('data-role-entry-blocked')}catch(_){}
}
function showSectionsHome(){
  clearTransientLayers();
  const gate=document.getElementById('welcome-gate');
  if(gate){gate.style.setProperty('display','none','important');gate.style.setProperty('visibility','hidden','important');gate.style.setProperty('pointer-events','none','important')}
  const dash=document.getElementById('welcome-dashboard');
  if(dash){dash.classList.remove('hidden');dash.style.setProperty('display','block','important');dash.style.setProperty('visibility','visible','important');dash.style.setProperty('opacity','1','important');dash.style.setProperty('pointer-events','auto','important')}
}
function preserveOriginalEntry(){
  clearTransientLayers();
  // Important: do NOT force gate/dashboard state here. The role page's original
  // activation/welcome boot and enterApp() own the initial visual transition.
}
async function boot(){
  if(!ROOTS.has(file())||isSystemAdminContext()) return;
  const directHome=wantsSectionHome();
  if(!hasSchoolContext()&&!directHome) return;
  try{
    if(window.PlatformCloudSession&&typeof PlatformCloudSession.ensure==='function') await PlatformCloudSession.ensure();
    if(directHome){
      showSectionsHome();
      requestAnimationFrame(showSectionsHome);
      setTimeout(showSectionsHome,80);
    }else{
      preserveOriginalEntry();
    }
  }catch(e){
    console.warn('[independent-school-role-flow-v2] session not ready',e);
    // Fail closed is handled by each page's dedicated auth/session guard.
    // This UI helper never clears session and never redirects.
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('pageshow',function(){if(ROOTS.has(file())&&wantsSectionHome())boot()});
})();
