(function(){
'use strict';
if(window.__SCHOOL_NAVIGATION_GUARD_V2__)return;window.__SCHOOL_NAVIGATION_GUARD_V2__=true;

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
 const r=String(localStorage.getItem('smart_school_active_role')||localStorage.getItem('platform_file_session_role')||'').toLowerCase();
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

function schoolLogout(){
 try{window.PlatformCloudSession?.clear?.()}catch(_){}
 try{
   ['smart_school_active_school_id','smart_school_active_membership_id','smart_school_active_role','active_school_id','active_school_name',
    'current_school_id','current_school_name','currentRole','user_role','platform_file_session_school_id','platform_file_session_role','administrative_employee_tab_session_v1']
    .forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k)});
 }catch(_){}
 location.replace('school-login.html');
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