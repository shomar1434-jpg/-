(function(){
  'use strict';
  if(window.__SYSTEM_ADMIN_CONTEXT_GUARD_V2__) return;
  window.__SYSTEM_ADMIN_CONTEXT_GUARD_V2__=true;
  function q(){try{return new URLSearchParams(location.search||'')}catch(e){return new URLSearchParams()}}
  function isAdmin(){var p=q();try{return p.get('systemAdmin')==='1'||sessionStorage.getItem('system_admin_context')==='1'||sessionStorage.getItem('system_admin_verified')==='true'}catch(e){return p.get('systemAdmin')==='1'}}
  if(!isAdmin()) return;
  try{
    sessionStorage.setItem('system_admin_context','1');sessionStorage.setItem('smart_school_tab_role_v1','system_admin');
    document.documentElement.setAttribute('data-system-admin-context','1');
  }catch(e){}
  // فصل صارم: مدير النظام يتجاهل سياق المدرسة، ولا يحذف مفاتيح localStorage المشتركة بين التبويبات.
  // الحذف السابق كان يقطع جلسة مدرسة مستقلة مفتوحة في تبويب آخر.
  try{
    ['smart_school_current_session','independent_school_mode','active_school_id','active_school_name','current_school_id','current_school_name']
      .forEach(function(k){sessionStorage.removeItem(k)});
  }catch(e){}
  function home(){location.href='index.html?systemAdminReturn=1'}
  try{
    var st=document.createElement('style');
    st.id='systemAdminEarlyHide';
    st.textContent='html[data-system-admin-context="1"] #activeSchoolLabel{display:none!important;visibility:hidden!important} .els-generic-source-btn[data-els-orphan="1"]{display:none!important}';
    (document.head||document.documentElement).appendChild(st);
  }catch(e){}
  window.returnToSystemAdminHome=home;
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('#ssBack,#ssExit,[data-system-admin-home]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();home()},true);
})();
