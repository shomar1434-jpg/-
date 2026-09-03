(function(){
  if(window.__SMART_INDEPENDENT_SCHOOL_EXIT_SCOPE_V4__) return;
  window.__SMART_INDEPENDENT_SCHOOL_EXIT_SCOPE_V4__ = true;

  function getParams(){
    try{return new URLSearchParams(location.search || '');}catch(e){return new URLSearchParams('');}
  }

  function readSession(){
    try{
      var raw = localStorage.getItem('smart_school_current_session') || sessionStorage.getItem('smart_school_current_session') || '';
      return raw ? JSON.parse(raw) : null;
    }catch(e){return null;}
  }


  function isFollowPage(){
    var q=getParams();
    var mode=String(q.get('mode')||'').toLowerCase();
    return q.get('follow')==='1' || q.get('readonly')==='1' || mode.indexOf('supervisor')>=0 || !!q.get('viewerRole') || !!q.get('returnRole');
  }

  function isManagerFollowPage(){
    var q=getParams();
    var mode=String(q.get('mode')||'').toLowerCase();
    var viewer=String(q.get('viewerRole')||q.get('viewer')||q.get('returnRole')||'').toLowerCase();
    return (q.get('managerFollow')==='1' || (isFollowPage() && viewer==='manager')) &&
      (mode.indexOf('supervisor')>=0 || q.get('follow')==='1' || q.get('readonly')==='1');
  }

  function roleToFile(role){
    role=String(role||'').toLowerCase();
    if(role==='manager' || role==='leadership') return 'manager.html';
    if(role==='agent' || role==='agency') return 'agent.html';
    if(role==='student_advisor' || role==='advisor') return 'student_advisor.html';
    if(role==='activity_leader' || role==='activity' || role==='activity-leader' || role==='leader') return 'activity_leader.html';
    return 'teacher.html';
  }

  function contextualReturnUrl(){
    var q=getParams();
    var viewer=String(q.get('returnRole') || q.get('viewerRole') || q.get('viewer') || '').trim();
    if(viewer){
      var next=new URLSearchParams();
      var sid=String(q.get('schoolId')||q.get('school_id')||q.get('school')||q.get('schoolCode')||'').trim();
      var email=String(q.get('viewerEmail')||'').trim();
      if(sid) next.set('schoolId',sid);
      if(email) next.set('email',email);
      next.set('returnedFromFollow','1');
      next.set('sectionReturn','1');
      if(viewer==='manager') return 'manager.html?' + next.toString();
      next.set('role', viewer==='agent' ? 'agency' : viewer);
      return roleToFile(viewer) + '?' + next.toString();
    }
    return schoolLoginUrl();
  }

  function isIndependentSchoolPage(){
    if(isManagerFollowPage()) return false;
    var q = getParams();
    var independentFlag = String(q.get('independent') || '').toLowerCase() === 'true';
    var schoolMode = String(q.get('schoolMode') || '').toLowerCase() === 'independent';
    var loginMode = String(q.get('loginMode') || '').toLowerCase() === 'direct';
    var direct = String(q.get('direct') || '').toLowerCase() === '1';
    var schoolId = String(q.get('schoolId') || q.get('school') || q.get('schoolCode') || '').trim();
    var s = readSession();
    var sessionIndependent = !!(s && (s.independentSchool === true || s.loginMode === 'direct') && (s.schoolId || schoolId));
    var sessionFlag = false;
    try{ sessionFlag = sessionStorage.getItem('independent_school_mode') === '1'; }catch(e){}

    /* نطاق آمن: لا يعمل على واجهة مدير/ة النظام إلا إذا كانت الصفحة داخلة صراحة من رابط المدرسة المستقلة */
    return !!schoolId && independentFlag && schoolMode && (loginMode || direct || sessionIndependent || sessionFlag);
  }

  function schoolLoginUrl(){
    var q = getParams();
    var schoolId = String(q.get('schoolId') || q.get('school') || q.get('schoolCode') || '').trim();
    var login = new URLSearchParams();
    if(schoolId) login.set('schoolId', schoolId);
    login.set('return','1');
    return 'school-login.html' + (login.toString() ? '?' + login.toString() : '');
  }

  function clearIndependentSession(){
    try{
      [
        'currentRole','currentUserName','currentUserEmail','smart_school_active_role','smart_school_current_session','independent_school_mode',
        'active_school_id','active_school_name','active_school_code','activeSchoolId','selected_school_id','current_school_id','current_school_name',
        'school_id','school_name','school_code','smart_school_id','smart_school_name','persist_school','smartSchool.currentSchool','smartSchool:activeSchool',
        'smart_school_active_school','smart_school_tab_school_v1','smart_school_tab_role_v1'
      ].forEach(function(k){ localStorage.removeItem(k); sessionStorage.removeItem(k); });
    }catch(e){}
  }

  function goBackToSchoolUsersLogin(){
    if(!isIndependentSchoolPage()) return false;
    try{
      if(window.parent && window.parent !== window && typeof window.parent.backToPortal === 'function'){
        window.parent.backToPortal();
        return true;
      }
    }catch(e){}
    var target = contextualReturnUrl();
    if(!isFollowPage()) clearIndependentSession();
    location.href = target;
    return true;
  }

  function finalClosePage(){
    if(!isIndependentSchoolPage()) return false;
    clearIndependentSession();
    try{ window.open('', '_self'); }catch(e){}
    try{ window.close(); }catch(e){}
    setTimeout(function(){
      try{ location.replace('about:blank'); }
      catch(e){ try{ document.body.innerHTML=''; }catch(_){} }
    }, 120);
    return true;
  }

  function getActionId(target){
    var el = target && target.closest ? target.closest('#ssBack,#ssExit') : null;
    return el ? el.id : '';
  }

  document.addEventListener('click', function(e){
    if(!isIndependentSchoolPage()) return;
    var id = getActionId(e.target);
    if(!id) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if(id === 'ssBack') goBackToSchoolUsersLogin();
    if(id === 'ssExit') finalClosePage();
    return false;
  }, true);


  function installFloatingReturnButton(){
    if(!isIndependentSchoolPage()) return;
    if(document.getElementById('independentSchoolReturnBtn')) return;
    var st = document.getElementById('independentSchoolReturnBtnStyle');
    if(!st){
      st = document.createElement('style');
      st.id = 'independentSchoolReturnBtnStyle';
      st.textContent = '#independentSchoolReturnBtn{position:fixed!important;right:18px!important;bottom:18px!important;width:48px!important;height:48px!important;border:0!important;border-radius:50%!important;background:#0f766e!important;color:#fff!important;font-size:24px!important;font-weight:900!important;z-index:2147483000!important;box-shadow:0 8px 22px rgba(0,0,0,.25)!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important}#independentSchoolReturnBtn:hover{filter:brightness(.95)!important;transform:translateY(-1px)!important}@media print{#independentSchoolReturnBtn{display:none!important}}';
      document.head.appendChild(st);
    }
    var btn = document.createElement('button');
    btn.id = 'independentSchoolReturnBtn';
    btn.type = 'button';
    btn.title = isFollowPage() ? 'الرجوع للقسم السابق' : 'العودة لشاشة دخول المدرسة';
    btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = '↩';
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      goBackToSchoolUsersLogin();
    }, true);
    document.body.appendChild(btn);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', installFloatingReturnButton);
  }else{
    installFloatingReturnButton();
  }

  window.smartIndependentSchoolBackToUsersLogin = goBackToSchoolUsersLogin;
  window.smartIndependentSchoolFinalClose = finalClosePage;
  window.smartManagerFollowReturnUrl = contextualReturnUrl;
})();

/* Light follow-up policy for independent schools only
   Reverts heavy view-only behavior. Keeps only:
   1) Hide "تقرير جديد" in follow/visit context.
   2) Block edit/delete-style actions only inside الأرشيف الرقمي / الأرشيف الذكي. */
(function(){
  if(window.__SMART_INDEPENDENT_LIGHT_FOLLOW_POLICY_V1__) return;
  window.__SMART_INDEPENDENT_LIGHT_FOLLOW_POLICY_V1__ = true;

  function params(){ try{return new URLSearchParams(location.search||'');}catch(e){return new URLSearchParams('');} }
  function readSession(){
    try{
      var raw=localStorage.getItem('smart_school_current_session')||sessionStorage.getItem('smart_school_current_session')||'';
      return raw?JSON.parse(raw):null;
    }catch(e){return null;}
  }
  function isIndependentSchool(){
    var q=params();
    var schoolId=String(q.get('schoolId')||q.get('school')||q.get('schoolCode')||'').trim();
    var independent=String(q.get('independent')||'').toLowerCase()==='true';
    var schoolMode=String(q.get('schoolMode')||'').toLowerCase()==='independent';
    var direct=String(q.get('direct')||'').toLowerCase()==='1' || String(q.get('loginMode')||'').toLowerCase()==='direct';
    var s=readSession();
    var sessionIndependent=!!(s && (s.independentSchool===true || s.loginMode==='direct') && (s.schoolId||schoolId));
    return !!schoolId && independent && schoolMode && (direct || sessionIndependent);
  }
  function isFollowContext(){
    var q=params();
    var mode=String(q.get('mode')||'').toLowerCase();
    return q.get('follow')==='1' || q.get('readonly')==='1' || mode.indexOf('supervisor')>-1 || !!q.get('viewerRole') || !!q.get('returnRole');
  }
  function shouldRun(){ return isIndependentSchool() && isFollowContext(); }
  function textOf(el){ return String((el&&(el.innerText||el.textContent||el.value||el.getAttribute('aria-label')||el.title||el.id||el.className||''))||'').trim(); }
  function metaText(el){
    return [textOf(el), el && el.id, el && el.className, el && el.getAttribute && el.getAttribute('onclick'), el && el.getAttribute && el.getAttribute('href')].join(' ');
  }
  function isNewReportAction(el){ return /تقرير\s*جديد|إنشاء\s*تقرير|إضافة\s*تقرير|new\s*report|create\s*report/i.test(metaText(el)); }
  function isArchiveEditAction(el){ return /حذف|تعديل|تحرير|إزالة|مسح|استرجاع|اعتماد|حفظ|رفع|استيراد|delete|remove|edit|update|save|upload|import|restore/i.test(metaText(el)); }
  function isInsideTargetArchive(el){
    var node=el;
    for(var i=0; node && i<8; i++, node=node.parentElement){
      var t=metaText(node);
      if(/الأرشيف\s*الرقمي|الأرشيف\s*الذكي|digital\s*archive|smart\s*archive|archive/i.test(t)) return true;
    }
    var bodyText='';
    try{ bodyText=(document.body && document.body.innerText || '').slice(0,4000); }catch(e){}
    return /الأرشيف\s*الرقمي|الأرشيف\s*الذكي/.test(bodyText) && /archive|أرشيف/i.test(metaText(el));
  }
  function hideNewReportOnce(){
    if(!shouldRun()) return;
    var nodes=document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],.btn,.button,[onclick]');
    nodes.forEach(function(el){ if(isNewReportAction(el)) el.style.setProperty('display','none','important'); });
  }
  function markArchiveActionsOnce(){
    if(!shouldRun()) return;
    var nodes=document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],.btn,.button,[onclick]');
    nodes.forEach(function(el){
      if(isArchiveEditAction(el) && isInsideTargetArchive(el)){
        el.setAttribute('data-archive-readonly-block','1');
        el.style.setProperty('display','none','important');
      }
    });
  }
  function applyLightPolicy(){ hideNewReportOnce(); markArchiveActionsOnce(); }
  document.addEventListener('click', function(ev){
    if(!shouldRun()) return;
    var el=ev.target && ev.target.closest ? ev.target.closest('button,a,[role="button"],input[type="button"],input[type="submit"],.btn,.button,[onclick]') : null;
    if(!el) return;
    if(isNewReportAction(el) || (isArchiveEditAction(el) && isInsideTargetArchive(el)) || el.getAttribute('data-archive-readonly-block')==='1'){
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      try{ if(typeof window.showToast==='function') window.showToast('وضع المتابعة: لا يسمح بالتعديل هنا'); }catch(e){}
      return false;
    }
    setTimeout(applyLightPolicy,120);
  }, true);
  function start(){ applyLightPolicy(); setTimeout(applyLightPolicy,500); setTimeout(applyLightPolicy,1400); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
