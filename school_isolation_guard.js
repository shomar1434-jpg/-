/* School Isolation Guard - safe additions for independent schools */
(function(){
  'use strict';
  if(window.__SCHOOL_ISOLATION_GUARD_V1__) return;
  window.__SCHOOL_ISOLATION_GUARD_V1__ = true;

  var RAW_GET = Storage.prototype.getItem;
  var RAW_SET = Storage.prototype.setItem;
  var RAW_REMOVE = Storage.prototype.removeItem;
  var RAW_KEY = Storage.prototype.key;
  var RAW_CLEAR = Storage.prototype.clear;

  function norm(v){ return String(v == null ? '' : v).trim(); }
  function parse(v,d){ try{return JSON.parse(v);}catch(e){return d;} }
  function rawGet(k){ try{return RAW_GET.call(localStorage,k);}catch(e){return null;} }
  function rawSet(k,v){ try{return RAW_SET.call(localStorage,k,v);}catch(e){} }
  function rawRemove(k){ try{return RAW_REMOVE.call(localStorage,k);}catch(e){} }
  function q(){ try{return new URLSearchParams(location.search||'');}catch(e){return new URLSearchParams('');} }
  function b64(s){ try{return btoa(unescape(encodeURIComponent(String(s||''))));}catch(e){return String(s||'').replace(/[^a-zA-Z0-9]/g,'_');} }

  function readUser(){
    return parse(rawGet('currentSchoolUser'), null) || parse(rawGet('currentUser'), null) || parse(rawGet('loggedUser'), null) || {};
  }
  function readSchoolObj(){
    return parse(rawGet('smartSchool.currentSchool'), null) || parse(rawGet('active_school'), null) || parse(rawGet('activeSchool'), null) || parse(rawGet('selectedSchool'), null) || {};
  }
  function getSchool(){
    var p=q(), u=readUser(), s=readSchoolObj();
    var id = p.get('schoolId') || p.get('school_id') || p.get('sid') || p.get('school') ||
      rawGet('active_school_id') || rawGet('current_school_id') || rawGet('selected_school_id') || rawGet('school_id') || rawGet('smart_school_id') ||
      u.activeSchoolId || u.schoolId || u.school_id || s.schoolId || s.id || s.school_id || s.code || '';
    var code = p.get('schoolCode') || p.get('school_code') || p.get('school') ||
      rawGet('active_school_code') || rawGet('school_code') || u.schoolCode || u.school_code || s.schoolCode || s.school_code || s.code || '';
    var name = p.get('schoolName') || p.get('school_name') ||
      rawGet('active_school_name') || rawGet('current_school_name') || rawGet('school_name') || rawGet('persist_school') ||
      u.schoolName || u.school_name || s.schoolName || s.school_name || s.name || '';
    var token = p.get('token') || p.get('schoolToken') || p.get('school_token') || rawGet('active_school_token') || rawGet('school_token') || '';
    id = norm(id || code || name);
    return { schoolId:id, id:id, schoolCode:norm(code), code:norm(code), schoolName:norm(name), name:norm(name), token:norm(token) };
  }
  function persistSchool(s){
    if(!s || !s.schoolId) return;
    rawSet('active_school_id', s.schoolId); rawSet('current_school_id', s.schoolId); rawSet('selected_school_id', s.schoolId); rawSet('school_id', s.schoolId); rawSet('smart_school_id', s.schoolId);
    if(s.schoolName){ rawSet('active_school_name', s.schoolName); rawSet('current_school_name', s.schoolName); rawSet('school_name', s.schoolName); rawSet('persist_school', s.schoolName); }
    if(s.schoolCode){ rawSet('active_school_code', s.schoolCode); rawSet('school_code', s.schoolCode); }
    if(s.token){ rawSet('active_school_token', s.token); rawSet('school_token', s.token); }
    rawSet('smartSchool.currentSchool', JSON.stringify({id:s.schoolId, schoolId:s.schoolId, schoolName:s.schoolName, schoolCode:s.schoolCode, token:s.token}));
  }
  function scopedKey(k){ var s=getSchool(); return s.schoolId ? ('schoolScope:'+b64(s.schoolId)+':'+k) : k; }
  function itemSchool(item){
    if(!item || typeof item !== 'object') return '';
    var v = item.schoolId || item.school_id || item.activeSchoolId || item.targetSchoolId || item.sourceSchoolId || item.smart_school_id || item.schoolCode || item.school_code || '';
    if(!v && item.school && typeof item.school === 'object') v = item.school.schoolId || item.school.id || item.school.code || '';
    return norm(v);
  }
  function stamp(item){
    var s=getSchool();
    if(!s.schoolId || !item || typeof item !== 'object') return item;
    if(!item.schoolId && !item.school_id) item.schoolId = s.schoolId;
    if(!item.schoolName && s.schoolName) item.schoolName = s.schoolName;
    if(!item.schoolCode && s.schoolCode) item.schoolCode = s.schoolCode;
    item.__schoolScoped = true;
    return item;
  }
  function same(item){ var s=getSchool(); var sid=s.schoolId; if(!sid || !item || typeof item !== 'object') return true; var x=itemSchool(item); return !x || String(x)===String(sid); }

  var EXACT_SCOPED = new Set([
    'school_reports','reports_archive','enhancedReportsArchive','records_archive','recordsArchive','savedRecords','archive_folder_goals','category_goals',
    'studentAdvisorAnalysisData','student_advisor_analysis_data','advisorAnalysisRecords','teacherDataAnalysisRecords','teacher_analysis_entries','teacher_form_entries',
    'teacherSubmissions','teacher_form_submissions','teacherPortalSubmissions','teacher_input_submissions','student_followup_analysis','studentFollowupAnalysis',
    'diagnosticTests','periodicTests','remedialPlans','performanceGapRecords','learningLossRecords','studentRiskRecords','studentSmartFiles',
    'exam_records_archive','examSavedRecords','exam_committees_records','examFormsArchive','examIdentitySettings','exam_identity_settings',
    'examEduDept','examSchoolName','examAcademicYear','examSemester','examManagerName','examAgentName','examManagerSign','examAgentSign','examSchoolStamp',
    'persist_region','persist_school','persist_name_m','persist_name_p','persist_sig_data','persist_stamp_data','setting_region','setting_school','setting_sig','setting_stamp','def_m','def_p',
    'ss_meeting_template_html','meetingMinutesArchive','meetingsArchive','smartSchoolUnifiedOpsV2_meetings','smartSchoolUnifiedOpsV2_minutes',
    'administrative_employee_plans','administrative_employee_improvement_plans'
  ]);
  function shouldScopeKey(k){
    k=String(k||'');
    if(EXACT_SCOPED.has(k)) return true;
    if(/^administrative_employee_eval_/.test(k)) return true;
    if(/^smartSchoolUnifiedOpsV2_(notifications|archive|records|reports|teacher|advisor|analysis|exam|meeting|minutes)/.test(k)) return true;
    return /(archive|records|reports|analysis|advisor|teacher.*data|teacher.*form|diagnostic|periodic|remedial|performanceGap|learningLoss|exam.*record|exam.*identity|signature|stamp|meeting|minutes|followup|student.*risk)/i.test(k) && !/(theme|activation|device|license|api|token)$/i.test(k);
  }
  function shouldPrimitiveScope(k){
    k=String(k||'');
    return EXACT_SCOPED.has(k) || /^administrative_employee_eval_/.test(k) || /(sig|stamp|identity|schoolName|managerName|agentName|template_html|setting_|persist_|def_)/i.test(k);
  }
  function processForRead(k,v){
    if(!shouldScopeKey(k) || v == null) return v;
    var scoped = rawGet(scopedKey(k));
    if(scoped != null) v = scoped;
    var parsed = parse(v, undefined);
    if(Array.isArray(parsed)) return JSON.stringify(parsed.filter(same));
    if(parsed && typeof parsed === 'object'){
      if(parsed.__schoolScoped && !same(parsed)) return JSON.stringify({});
      if(!parsed.__schoolScoped && scoped != null && !same(parsed)) return JSON.stringify({});
    }
    return v;
  }
  function processForWrite(k,v){
    if(!shouldScopeKey(k)) return {key:k, value:v, scoped:false};
    var parsed = parse(v, undefined);
    if(Array.isArray(parsed)){
      v = JSON.stringify(parsed.map(stamp));
      return {key:k, value:v, scoped:false};
    }
    if(parsed && typeof parsed === 'object'){
      v = JSON.stringify(stamp(parsed));
      return {key:k, value:v, scoped:false};
    }
    if(shouldPrimitiveScope(k)) return {key:scopedKey(k), value:v, scoped:true};
    return {key:k, value:v, scoped:false};
  }

  function patchStorage(){
    if(Storage.prototype.__schoolIsolationGuardPatched) return;
    Storage.prototype.__schoolIsolationGuardPatched = true;
    Storage.prototype.getItem = function(k){
      var val = RAW_GET.call(this,k);
      if(this === localStorage) return processForRead(k,val);
      return val;
    };
    Storage.prototype.setItem = function(k,v){
      if(this === localStorage){
        var r = processForWrite(k,String(v));
        if(r.scoped) return RAW_SET.call(this,r.key,r.value);
        return RAW_SET.call(this,r.key,r.value);
      }
      return RAW_SET.call(this,k,v);
    };
    Storage.prototype.removeItem = function(k){
      if(this === localStorage && shouldScopeKey(k)){
        RAW_REMOVE.call(this, scopedKey(k));
      }
      return RAW_REMOVE.call(this,k);
    };
  }

  function appendSchoolParams(url){
    try{
      var s=getSchool(); if(!s.schoolId) return url;
      var u = new URL(url, location.href);
      if(u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'file:') return url;
      if(!u.searchParams.get('schoolId')) u.searchParams.set('schoolId', s.schoolId);
      if(s.schoolCode && !u.searchParams.get('schoolCode')) u.searchParams.set('schoolCode', s.schoolCode);
      if(s.schoolName && !u.searchParams.get('schoolName')) u.searchParams.set('schoolName', s.schoolName);
      if(s.token && !u.searchParams.get('token')) u.searchParams.set('token', s.token);
      return u.href;
    }catch(e){ return url; }
  }
  function patchOpenAndLinks(){
    if(!window.__schoolGuardOpenPatched){
      window.__schoolGuardOpenPatched = true;
      var oldOpen = window.open;
      window.open = function(url, target, features){
        if(typeof url === 'string' && /\.html(\?|#|$)/i.test(url)) url = appendSchoolParams(url);
        return oldOpen.call(window, url, target, features);
      };
    }
    document.querySelectorAll('a[href$=".html"],a[href*=".html?"],button[data-external],button[data-url],[data-link]').forEach(function(el){
      var attr = el.getAttribute('href') != null ? 'href' : (el.getAttribute('data-external') != null ? 'data-external' : (el.getAttribute('data-url') != null ? 'data-url' : 'data-link'));
      var val = el.getAttribute(attr); if(!val || !/\.html(\?|#|$)/i.test(val)) return;
      el.setAttribute(attr, appendSchoolParams(val));
    });
    document.addEventListener('click', function(ev){
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-external],a[href]') : null;
      if(!el) return;
      var val = el.getAttribute('data-external') || el.getAttribute('href');
      if(val && /\.html(\?|#|$)/i.test(val)){
        var fixed = appendSchoolParams(val);
        if(el.hasAttribute('data-external')) el.setAttribute('data-external', fixed);
        else el.setAttribute('href', fixed);
      }
    }, true);
  }
  function markSchool(){
    var s=getSchool();
    if(!s.schoolId) return;
    document.documentElement.setAttribute('data-school-id', s.schoolId);
    document.documentElement.setAttribute('data-school-name', s.schoolName||'');
    document.querySelectorAll('[data-school-id]').forEach(function(el){
      var sid=el.getAttribute('data-school-id');
      if(sid && String(sid)!==String(s.schoolId)) el.style.display='none';
    });
  }
  function secureExternalForm(){
    /*
      تصحيح نهائي: لا يتم حجب الصفحات الخارجية للمدارس المستقلة.
      بعض الصفحات مثل تحليل بيانات الموجه ومحاضر ولجان الاختبارات تُفتح من داخل حساب المدرسة
      وقد لا يصلها schoolId في الرابط رغم أن جلسة المدرسة موجودة في localStorage.
      لذلك يتم ترك الصفحة تعمل دائماً، مع استمرار عزل البيانات عند توفر سياق المدرسة.
    */
    var s=getSchool();
    var isExternal = /exam_committees_forms|teacher_data_analysis|student_advisor_analysis_tool|student_followup_analysis|manager_exams_management|agent_exams_management/i.test(location.pathname);
    if(isExternal && !s.schoolId){
      document.documentElement.setAttribute('data-school-context','missing-nonblocking');
      try{ console.warn('SchoolIsolationGuard: missing school context, page allowed without blocking.'); }catch(e){}
    }
  }
  function install(){
    var s=getSchool();
    if(s.schoolId) persistSchool(s);
    patchStorage();
    patchOpenAndLinks();
    markSchool();
    secureExternalForm();
  }
  window.SchoolIsolationGuard = { getSchool:getSchool, appendSchoolParams:appendSchoolParams, stamp:stamp, sameSchool:same };
  install();
  document.addEventListener('DOMContentLoaded', install);
  setTimeout(install,300); setTimeout(install,1200); setInterval(patchOpenAndLinks,2500);
})();
