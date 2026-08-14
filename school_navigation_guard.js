(function(){
'use strict';
if(window.__SCHOOL_NAVIGATION_GUARD_V1__)return;window.__SCHOOL_NAVIGATION_GUARD_V1__=true;
function roleRoot(){
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
function logout(){
 try{window.PlatformCloudSession?.clear?.()}catch(_){}
 try{['smart_school_active_school_id','smart_school_active_membership_id','smart_school_active_role','active_school_id','active_school_name','current_school_id','current_school_name','currentRole','user_role'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k)})}catch(_){}
 location.replace('school-login.html');
}
document.addEventListener('click',function(e){
 const el=e.target?.closest?.('a,button,[role="button"]');if(!el)return;
 const t=String(el.textContent||'').replace(/\s+/g,' ').trim();
 if(el.id==='uwExitHeader'||/^(⏻\s*)?الخروج$/.test(t)||/^تسجيل الخروج$/.test(t)){e.preventDefault();e.stopImmediatePropagation();logout();return}
 if(el.id==='uwHomeHeader'||/^(🏠\s*)?الرئيسية$/.test(t)){e.preventDefault();e.stopImmediatePropagation();location.href=roleRoot();}
},true);
window.SchoolNavigationGuard={roleRoot,logout};
})();