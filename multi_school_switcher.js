
(function(){
  'use strict';
  if(window.__MULTI_SCHOOL_SWITCHER_PHASE1__) return;
  window.__MULTI_SCHOOL_SWITCHER_PHASE1__ = true;

  var NS = 'smartSchoolUnifiedOpsV2';

  function read(k,d){ try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d));}catch(e){return d;} }
  function write(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function norm(s){ return String(s||'').trim().toLowerCase(); }

  function currentUser(){
    return read('currentSchoolUser', null) || read('currentUser', null) || {};
  }

  function isManager(){
    var u = currentUser();
    var role = norm(u.role || u.dbRole || localStorage.getItem('currentRole') || '');
    return role === 'leadership' || role === 'manager' || /مدير/.test(role);
  }

  function collectLocalSchoolsForManager(email){
    var schools = read('smart_school_schools', []);
    var u = currentUser();
    var managed = Array.isArray(u.managedSchools) ? u.managedSchools : [];
    var ids = Array.isArray(u.schoolIds) ? u.schoolIds.map(String) : [];
    var out = [];

    managed.forEach(function(s){
      if(s) out.push({
        id: s.id || s.schoolId,
        schoolId: s.schoolId || s.id,
        schoolName: s.schoolName || s.school_name || '',
        schoolCode: s.schoolCode || s.school_code || ''
      });
    });

    schools.forEach(function(s){
      var sid = String(s.id || s.schoolId || '');
      var managerEmail = norm(s.managerEmail || s.manager_email || '');
      if((email && managerEmail === email) || (sid && ids.indexOf(sid) >= 0)){
        out.push({
          id: s.id || s.schoolId,
          schoolId: s.schoolId || s.id,
          schoolName: s.schoolName || s.school_name || '',
          schoolCode: s.schoolCode || s.school_code || '',
          registrationLink: s.registrationLink || s.registration_link || '',
          loginLink: s.loginLink || s.login_link || ''
        });
      }
    });

    var seen = {};
    return out.filter(function(s){
      var id = String(s.schoolId || s.id || s.schoolCode || s.schoolName || '');
      if(!id || seen[id]) return false;
      seen[id]=true;
      return true;
    });
  }

  async function fetchSupabaseSchools(email){
    var out = [];
    try{
      if(!window.SmartSchoolSupabase || !window.SmartSchoolSupabase.getClient) return out;
      var sb = window.SmartSchoolSupabase.getClient();
      if(!sb) return out;

      try{
        var memberRows = await sb.from('school_members').select('school_id,email,role,status').eq('email', email).eq('role','manager');
        if(memberRows && memberRows.data && memberRows.data.length){
          var ids = memberRows.data.map(function(r){return r.school_id;}).filter(Boolean);
          if(ids.length){
            var q = await sb.from('schools').select('*').in('id', ids);
            if(q && q.data) out = out.concat(q.data);
          }
        }
      }catch(e){}

      try{
        var q2 = await sb.from('schools').select('*').eq('manager_email', email);
        if(q2 && q2.data) out = out.concat(q2.data);
      }catch(e){}
    }catch(e){}

    var seen = {};
    return out.map(function(s){
      return window.SmartSchoolSupabase && window.SmartSchoolSupabase.normalizeSchool ? window.SmartSchoolSupabase.normalizeSchool(s) : {
        id:s.id, schoolId:s.id, schoolName:s.school_name || s.schoolName || '', schoolCode:s.school_code || s.schoolCode || ''
      };
    }).filter(function(s){
      var id = String(s.schoolId || s.id || '');
      if(!id || seen[id]) return false;
      seen[id]=true;
      return true;
    });
  }

  async function getManagerSchools(){
    var u = currentUser();
    var email = norm(u.email || localStorage.getItem('currentUserEmail') || '');
    var local = collectLocalSchoolsForManager(email);
    var remote = await fetchSupabaseSchools(email);
    var all = local.concat(remote);
    var seen = {};
    return all.filter(function(s){
      var id = String(s.schoolId || s.id || '');
      if(!id || seen[id]) return false;
      seen[id]=true;
      return true;
    });
  }

  function setActiveSchool(school){
    if(!school) return;
    var sid = school.schoolId || school.id || '';
    var sname = school.schoolName || school.school_name || '';
    var scode = school.schoolCode || school.school_code || '';

    localStorage.setItem('active_school_id', sid);
    localStorage.setItem('current_school_id', sid);
    localStorage.setItem('school_id', sid);
    localStorage.setItem('smart_school_id', sid);
    localStorage.setItem('active_school_name', sname);
    localStorage.setItem('current_school_name', sname);
    localStorage.setItem('school_name', sname);
    localStorage.setItem('persist_school', sname);
    if(scode){
      localStorage.setItem('active_school_code', scode);
      localStorage.setItem('school_code', scode);
    }
    write('smartSchool.currentSchool', school);

    var u = currentUser();
    if(u && u.email){
      u.schoolId = sid;
      u.activeSchoolId = sid;
      u.schoolName = sname;
      u.schoolCode = scode;
      localStorage.setItem('currentSchoolUser', JSON.stringify(u));
      localStorage.setItem('currentUser', JSON.stringify(u));
    }
  }

  function ensureStyle(){
    if(document.getElementById('multiSchoolSwitcherStyle')) return;
    var st = document.createElement('style');
    st.id = 'multiSchoolSwitcherStyle';
    st.textContent =
      '#multiSchoolSwitchBtn{position:fixed;top:12px;right:calc(50% + 8px);transform:translateX(0);max-width:220px;white-space:nowrap;z-index:2147482500;border:0;border-radius:999px;background:#0f766e;color:#fff;padding:10px 15px;font:900 12px Cairo,Tahoma,Arial;box-shadow:0 10px 24px rgba(0,0,0,.22);cursor:pointer}' +
      '#multiSchoolModal{position:fixed;inset:0;z-index:2147483600;font-family:Cairo,Tahoma,Arial,sans-serif;direction:rtl}' +
      '#multiSchoolModal .msShade{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(3px)}' +
      '#multiSchoolModal .msBox{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(720px,calc(100vw - 28px));max-height:85vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 25px 80px rgba(0,0,0,.35);padding:22px}' +
      '#multiSchoolModal h2{margin:0;color:#064e3b;font-size:22px;font-weight:900}' +
      '#multiSchoolModal p{margin:8px 0 18px;color:#64748b;font-size:13px;font-weight:700}' +
      '#multiSchoolModal .msGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}' +
      '#multiSchoolModal .msCard{border:1px solid #d1fae5;background:linear-gradient(135deg,#f0fdfa,#fff);border-radius:18px;padding:16px;text-align:right;cursor:pointer;box-shadow:0 8px 20px rgba(15,118,110,.08)}' +
      '#multiSchoolModal .msCard:hover{outline:2px solid #0f766e}' +
      '#multiSchoolModal .msCard b{display:block;color:#0f766e;font-size:15px;margin-bottom:5px}' +
      '#multiSchoolModal .msCard span{display:block;color:#64748b;font-size:11px;font-weight:800;direction:ltr;text-align:right}' +
      '#multiSchoolModal .msActions{display:flex;justify-content:flex-end;margin-top:18px;gap:8px}' +
      '#multiSchoolModal button{border:0;border-radius:12px;padding:9px 14px;font-weight:900;font-family:inherit;cursor:pointer}' +
      '#multiSchoolModal .close{background:#991b1b;color:#fff}' +
      '@media print{#multiSchoolSwitchBtn,#multiSchoolModal{display:none!important}}';
    document.head.appendChild(st);
  }

  function openModal(schools, force){
    ensureStyle();
    var old = document.getElementById('multiSchoolModal');
    if(old) old.remove();

    var active = localStorage.getItem('current_school_id') || localStorage.getItem('active_school_id') || '';
    var modal = document.createElement('div');
    modal.id = 'multiSchoolModal';
    modal.innerHTML =
      '<div class="msShade"></div><div class="msBox">' +
      '<h2>اختيار المدرسة</h2>' +
      '<p>هذا الحساب مرتبط بأكثر من مدرسة. اختر المدرسة التي تريد العمل عليها الآن.</p>' +
      '<div class="msGrid">' +
      schools.map(function(s){
        var sid = s.schoolId || s.id || '';
        var activeMark = String(sid) === String(active) ? ' — النشطة الآن' : '';
        return '<div class="msCard" data-school-id="'+esc(sid)+'"><b>'+esc(s.schoolName || s.school_name || 'مدرسة بدون اسم')+esc(activeMark)+'</b><span>'+esc(s.schoolCode || s.school_code || sid)+'</span></div>';
      }).join('') +
      '</div><div class="msActions"><button type="button" class="close">إغلاق</button></div></div>';

    document.body.appendChild(modal);

    modal.querySelector('.close').onclick = function(){
      if(force && schools.length > 1 && !active){ return; }
      modal.remove();
    };
    Array.prototype.forEach.call(modal.querySelectorAll('.msCard'), function(card){
      card.onclick = function(){
        var sid = card.getAttribute('data-school-id');
        var school = schools.find(function(s){ return String(s.schoolId || s.id) === String(sid); });
        setActiveSchool(school);
        modal.remove();
        try{ localStorage.setItem(NS+'_last_school_switch_at', new Date().toISOString()); }catch(e){}
        location.href = 'manager.html?role=leadership&schoolId=' + encodeURIComponent(sid) + '&school_name=' + encodeURIComponent(school.schoolName || school.school_name || '') + '&schoolMode=independent&independent=true';
      };
    });
  }

  async function addButtonAndMaybePrompt(){
    if(!isManager()) return;
    var schools = await getManagerSchools();
    if(!schools || schools.length <= 1) return;

    ensureStyle();
    if(!document.getElementById('multiSchoolSwitchBtn')){
      var btn = document.createElement('button');
      btn.id = 'multiSchoolSwitchBtn';
      btn.type = 'button';
      btn.textContent = '🏫 تبديل المدرسة';
      btn.onclick = function(){ openModal(schools, false); };
      document.body.appendChild(btn);
    }

    var active = localStorage.getItem('current_school_id') || localStorage.getItem('active_school_id') || '';
    var prompted = sessionStorage.getItem(NS+'_school_switcher_prompted');
    if(!active || !prompted){
      sessionStorage.setItem(NS+'_school_switcher_prompted', '1');
      setTimeout(function(){ openModal(schools, !active); }, 450);
    }
  }

  document.addEventListener('DOMContentLoaded', addButtonAndMaybePrompt);
  setTimeout(addButtonAndMaybePrompt, 800);
  setTimeout(addButtonAndMaybePrompt, 2000);

  window.MultiSchoolSwitcher = {
    open: async function(){ openModal(await getManagerSchools(), false); },
    getSchools: getManagerSchools,
    setActiveSchool: setActiveSchool
  };
})();
