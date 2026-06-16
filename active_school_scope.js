
(function(){
  'use strict';
  if(window.__ACTIVE_SCHOOL_SCOPE_ALL_SECTIONS__) return;
  window.__ACTIVE_SCHOOL_SCOPE_ALL_SECTIONS__ = true;

  var NS = 'smartSchoolUnifiedOpsV2';

  function read(k,d){ try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d));}catch(e){return d;} }
  function write(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} }
  function qs(){ return new URLSearchParams(location.search || ''); }
  function norm(v){ return String(v||'').trim(); }

  // لا تظهر لوحة المدرسة النشطة ولا يتم اعتماد بيانات المدرسة المحفوظة محليًا
  // إلا عند فتح مدرسة مستقلة من النسخة السحابية. هذا يمنع ظهور آخر مدرسة
  // محفوظة في المتصفح عند تجربة النسخة المحلية أو فتح الملفات مباشرة.
  function isLocalRuntime(){
    var host = (location.hostname || '').toLowerCase();
    return location.protocol === 'file:' || !host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local');
  }

  function hasIndependentSchoolSignal(){
    var q = qs();
    var user = getCurrentUser();
    var stored = getStoredSchool();
    return !!(
      q.get('schoolId') || q.get('school_id') || q.get('school') || q.get('schoolCode') || q.get('school_code') ||
      user.activeSchoolId || user.schoolId ||
      stored.schoolId || stored.id
    );
  }

  function isCloudIndependentSchoolContext(){
    if(isLocalRuntime()) return false;
    if(!(location.protocol === 'https:' || location.protocol === 'http:')) return false;
    return hasIndependentSchoolSignal();
  }

  function getCurrentUser(){
    return read('currentSchoolUser', null) || read('currentUser', null) || {};
  }

  function getStoredSchool(){
    return read('smartSchool.currentSchool', null) || {};
  }

  function activeSchool(){
    if(!isCloudIndependentSchoolContext()) return {id:'', schoolId:'', name:'', schoolName:'', code:'', schoolCode:'', isIndependent:false};
    var q = qs();
    var user = getCurrentUser();
    var stored = getStoredSchool();

    var id =
      q.get('schoolId') || q.get('school_id') ||
      localStorage.getItem('active_school_id') ||
      localStorage.getItem('current_school_id') ||
      localStorage.getItem('school_id') ||
      localStorage.getItem('smart_school_id') ||
      user.activeSchoolId || user.schoolId ||
      stored.schoolId || stored.id || '';

    var name =
      q.get('school_name') || q.get('schoolName') ||
      localStorage.getItem('active_school_name') ||
      localStorage.getItem('current_school_name') ||
      localStorage.getItem('school_name') ||
      localStorage.getItem('persist_school') ||
      user.schoolName ||
      stored.schoolName || stored.school_name || '';

    var code =
      q.get('school') || q.get('schoolCode') || q.get('school_code') ||
      localStorage.getItem('active_school_code') ||
      localStorage.getItem('school_code') ||
      user.schoolCode ||
      stored.schoolCode || stored.school_code || '';

    return {id:norm(id), schoolId:norm(id), name:norm(name), schoolName:norm(name), code:norm(code), schoolCode:norm(code), isIndependent:true};
  }

  function persistActiveSchool(s){
    if(!s || !s.schoolId) return;
    localStorage.setItem('active_school_id', s.schoolId);
    localStorage.setItem('current_school_id', s.schoolId);
    localStorage.setItem('school_id', s.schoolId);
    localStorage.setItem('smart_school_id', s.schoolId);

    if(s.schoolName){
      localStorage.setItem('active_school_name', s.schoolName);
      localStorage.setItem('current_school_name', s.schoolName);
      localStorage.setItem('school_name', s.schoolName);
      localStorage.setItem('persist_school', s.schoolName);
    }

    if(s.schoolCode){
      localStorage.setItem('active_school_code', s.schoolCode);
      localStorage.setItem('school_code', s.schoolCode);
    }

    write('smartSchool.currentSchool', {
      id:s.schoolId,
      schoolId:s.schoolId,
      schoolName:s.schoolName,
      schoolCode:s.schoolCode
    });

    var user = getCurrentUser();
    if(user && user.email){
      user.schoolId = s.schoolId;
      user.activeSchoolId = s.schoolId;
      user.schoolName = s.schoolName || user.schoolName || '';
      user.schoolCode = s.schoolCode || user.schoolCode || '';
      localStorage.setItem('currentSchoolUser', JSON.stringify(user));
      localStorage.setItem('currentUser', JSON.stringify(user));
    }
  }

  function sameSchool(item, sid){
    if(!sid) return true;
    if(!item || typeof item !== 'object') return true;

    var itemSchool =
      item.schoolId || item.school_id || item.activeSchoolId ||
      item.targetSchoolId || item.sourceSchoolId ||
      item.school || item.smart_school_id || '';

    if(!itemSchool && item.school && typeof item.school === 'object'){
      itemSchool = item.school.id || item.school.schoolId || '';
    }

    // السجلات القديمة التي لا تحمل schoolId تبقى ظاهرة حتى لا تختفي بيانات قديمة.
    if(!itemSchool) return true;

    return String(itemSchool) === String(sid);
  }

  function stampItem(item, s){
    if(!item || typeof item !== 'object' || !s || !s.schoolId) return item;
    if(!item.schoolId && !item.school_id) item.schoolId = s.schoolId;
    if(!item.schoolName && s.schoolName) item.schoolName = s.schoolName;
    if(!item.schoolCode && s.schoolCode) item.schoolCode = s.schoolCode;
    return item;
  }

  function shouldScopeKey(key){
    return (
      key === 'offline_users_backup' ||
      key === NS + '_users' ||
      key === 'smart_school_users' ||
      key === 'reports_archive' ||
      key === 'enhancedReportsArchive' ||
      key === NS + '_notifications_manager' ||
      key === NS + '_notifications_agent' ||
      key === NS + '_notifications_teacher' ||
      key === NS + '_notifications_student_advisor' ||
      key === NS + '_notifications_activity_leader'
    );
  }

  function scopeArrayForRead(key, value){
    var s = activeSchool();
    if(!s.schoolId || !Array.isArray(value) || !shouldScopeKey(key)) return value;
    return value.filter(function(item){ return sameSchool(item, s.schoolId); });
  }

  function stampArrayForWrite(key, value){
    var s = activeSchool();
    if(!s.schoolId || !Array.isArray(value) || !shouldScopeKey(key)) return value;
    return value.map(function(item){ return stampItem(item, s); });
  }

  function patchLocalStorage(){
    if(localStorage.__activeSchoolScopePatched) return;
    try{ localStorage.__activeSchoolScopePatched = '1'; }catch(e){}

    var rawGet = Storage.prototype.getItem;
    var rawSet = Storage.prototype.setItem;

    Storage.prototype.getItem = function(key){
      var val = rawGet.call(this, key);
      if(!val || !shouldScopeKey(key)) return val;
      try{
        var parsed = JSON.parse(val);
        var scoped = scopeArrayForRead(key, parsed);
        return JSON.stringify(scoped);
      }catch(e){
        return val;
      }
    };

    Storage.prototype.setItem = function(key, value){
      if(shouldScopeKey(key)){
        try{
          var parsed = JSON.parse(value);
          value = JSON.stringify(stampArrayForWrite(key, parsed));
        }catch(e){}
      }
      return rawSet.call(this, key, value);
    };
  }

  function filterVisibleUsers(){
    var s = activeSchool();
    if(!s.schoolId) return;
    // دعم الجداول التي يعرضها المدير بعد التبديل: يتم إخفاء أي صف يحمل مدرسة أخرى.
    document.querySelectorAll('[data-school-id]').forEach(function(el){
      var sid = el.getAttribute('data-school-id');
      if(sid && String(sid) !== String(s.schoolId)){
        el.style.display = 'none';
      }
    });
  }

  function updateSchoolLabels(){
    var s = activeSchool();
    if(!s.schoolId){
      var old = document.getElementById('activeSchoolLabel');
      if(old && old.parentNode) old.parentNode.removeChild(old);
      document.documentElement.removeAttribute('data-active-school-id');
      document.documentElement.removeAttribute('data-active-school-name');
      return;
    }
    document.documentElement.setAttribute('data-active-school-id', s.schoolId);
    document.documentElement.setAttribute('data-active-school-name', s.schoolName || '');

    var label = document.getElementById('activeSchoolLabel');
    if(!label){
      label = document.createElement('div');
      label.id = 'activeSchoolLabel';
      label.dir = 'rtl';
      label.style.cssText = 'position:fixed;top:12px;left:calc(50% + 8px);z-index:2147482000;background:rgba(15,118,110,.95);color:#fff;border-radius:999px;padding:8px 13px;font:900 11px Cairo,Tahoma,Arial;box-shadow:0 8px 20px rgba(0,0,0,.18);max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      document.body.appendChild(label);
    }
    label.textContent = 'المدرسة النشطة: ' + (s.schoolName || s.schoolId);
  }

  function install(){
    var s = activeSchool();
    if(s.schoolId) persistActiveSchool(s);
    patchLocalStorage();
    updateSchoolLabels();
    filterVisibleUsers();
    setTimeout(filterVisibleUsers, 500);
    setTimeout(filterVisibleUsers, 1500);
  }

  document.addEventListener('DOMContentLoaded', install);
  setTimeout(install, 300);
  setTimeout(install, 1200);

  window.ActiveSchoolScope = {
    get: activeSchool,
    set: persistActiveSchool,
    sameSchool: sameSchool,
    stampItem: function(item){ return stampItem(item, activeSchool()); },
    isLocalRuntime: isLocalRuntime,
    isCloudIndependentSchoolContext: isCloudIndependentSchoolContext,
    clearLocalSchoolContext: function(){
      ['active_school_id','current_school_id','school_id','smart_school_id','active_school_name','current_school_name','school_name','persist_school','active_school_code','school_code','smartSchool.currentSchool'].forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
      updateSchoolLabels();
    }
  };
})();
