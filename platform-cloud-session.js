(function(){
  'use strict';

  const TOKEN_KEY = 'platform_file_session_token';
  const EXPIRES_KEY = 'platform_file_session_expires_at';
  const USER_KEY = 'platform_file_session_user_id';
  const SCHOOL_KEY = 'platform_file_session_school_id';
  const ROLE_KEY = 'platform_file_session_role';
  const TAB_TOKEN_KEY='platform_tab_session_token_v1';
  const TAB_EXPIRES_KEY='platform_tab_session_expires_v1';
  const TAB_USER_KEY='platform_tab_session_user_v1';
  const TAB_SCHOOL_KEY='platform_tab_session_school_v1';
  const TAB_ROLE_KEY='smart_school_tab_role_v1';

  /* RL33 — Tab Identity Firewall
     Identity/session compatibility keys are tab-scoped. Once a verified tab
     context exists, legacy localStorage reads/writes are transparently
     redirected to sessionStorage so another account in the same browser
     cannot overwrite this tab's school/user/role. */
  const LEGACY_IDENTITY_KEYS=new Set([
    'currentUser','currentSchoolUser','currentRole','smart_school_active_role',
    'currentUserId','currentUserEmail','currentUserName','smart_school_current_session',
    'platform_file_session_token','platform_file_session_expires_at',
    'platform_file_session_user_id','platform_file_session_school_id','platform_file_session_role',
    'activeSchoolId','active_school_id','current_school_id','school_id','smart_school_id',
    'current_school_name','school_name','active_school_name'
  ]);
  const LEGACY_TO_TAB={
    platform_file_session_token:TAB_TOKEN_KEY,
    platform_file_session_expires_at:TAB_EXPIRES_KEY,
    platform_file_session_user_id:TAB_USER_KEY,
    platform_file_session_school_id:TAB_SCHOOL_KEY,
    platform_file_session_role:TAB_ROLE_KEY,
    currentRole:TAB_ROLE_KEY,
    smart_school_active_role:TAB_ROLE_KEY,
    currentUserId:TAB_USER_KEY,
    activeSchoolId:TAB_SCHOOL_KEY,
    active_school_id:TAB_SCHOOL_KEY,
    current_school_id:TAB_SCHOOL_KEY,
    school_id:TAB_SCHOOL_KEY,
    smart_school_id:TAB_SCHOOL_KEY
  };
  function installTabIdentityFirewall(){
    if(window.__PLATFORM_TAB_IDENTITY_FIREWALL_RL33__)return;
    window.__PLATFORM_TAB_IDENTITY_FIREWALL_RL33__=true;
    const proto=Storage.prototype, originalGet=proto.getItem, originalSet=proto.setItem, originalRemove=proto.removeItem;
    const isLocal=(store)=>{try{return store===window.localStorage}catch(_){return false}};
    const tabValue=(key)=>{
      const mapped=LEGACY_TO_TAB[key];
      if(mapped){const v=originalGet.call(sessionStorage,mapped);if(v!==null&&v!=='')return v}
      const v=originalGet.call(sessionStorage,key);
      return v!==null?v:null;
    };
    proto.getItem=function(key){
      key=String(key);
      if(isLocal(this)&&LEGACY_IDENTITY_KEYS.has(key)){
        const tv=tabValue(key);
        if(tv!==null)return tv;
        if(hasTabIdentity())return null;
      }
      return originalGet.call(this,key);
    };
    proto.setItem=function(key,value){
      key=String(key);
      if(isLocal(this)&&LEGACY_IDENTITY_KEYS.has(key)&&hasTabIdentity()){
        const mapped=LEGACY_TO_TAB[key];
        if(mapped)originalSet.call(sessionStorage,mapped,String(value));
        originalSet.call(sessionStorage,key,String(value));
        return;
      }
      return originalSet.call(this,key,String(value));
    };
    proto.removeItem=function(key){
      key=String(key);
      if(isLocal(this)&&LEGACY_IDENTITY_KEYS.has(key)&&hasTabIdentity()){
        const mapped=LEGACY_TO_TAB[key];
        if(mapped)originalRemove.call(sessionStorage,mapped);
        originalRemove.call(sessionStorage,key);
        return;
      }
      return originalRemove.call(this,key);
    };
  }

  installTabIdentityFirewall();

  // Session continuity bridge: preserve the authenticated school session while
  // navigating between independent-school pages.  Only a token whose stored
  // school matches the active school is restored; cross-school restoration is
  // deliberately rejected.
  function parseJson(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  function hasTabIdentity() {
    return Boolean(
      sessionStorage.getItem(TAB_SCHOOL_KEY) || sessionStorage.getItem('smart_school_tab_school_v1') ||
      sessionStorage.getItem(TAB_USER_KEY) || sessionStorage.getItem('currentUserId') ||
      sessionStorage.getItem(TAB_ROLE_KEY) || sessionStorage.getItem('smart_school_current_session') ||
      sessionStorage.getItem('administrative_employee_tab_session_v1')
    );
  }
  function tabFirst(tabKey, legacyKey) {
    // RL33: authenticated identity/session is never restored from localStorage.
    // A newly opened browser tab must establish its own server-issued session.
    return String(sessionStorage.getItem(tabKey)||'').trim();
  }

  function directActiveSchoolId() {
    const tabSchool=String(sessionStorage.getItem(TAB_SCHOOL_KEY)||sessionStorage.getItem('smart_school_tab_school_v1')||'').trim();
    if(tabSchool)return tabSchool;
    if(hasTabIdentity())return '';
    return String(localStorage.getItem('active_school_id')||localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||localStorage.getItem('smart_school_id')||'').trim();
  }

  function directActiveUserId() {
    try {
      const tabUser=sessionStorage.getItem(TAB_USER_KEY)||sessionStorage.getItem('currentUserId')||'';
      if(tabUser)return String(tabUser).trim();
      if(hasTabIdentity())return '';
      const current = parseJson(localStorage.getItem('currentUser')) || parseJson(localStorage.getItem('currentSchoolUser')) || {};
      return String(localStorage.getItem('currentUserId') || current.id || current.user_id || '').trim();
    } catch (_) { return ''; }
  }

  function isSystemAdminContext() {
    try {
      const q = new URLSearchParams(location.search || '');
      return q.get('systemAdmin') === '1' || q.get('systemAdminReturn') === '1' ||
        sessionStorage.getItem('system_admin_context') === '1' ||
        sessionStorage.getItem('system_admin_verified') === 'true';
    } catch (_) { return false; }
  }

  function sessionContexts() {
    return [parseJson(sessionStorage.getItem('smart_school_current_session')),parseJson(sessionStorage.getItem('administrative_employee_tab_session_v1'))].filter(Boolean);
  }

  function contextToken(ctx) {
    return String(ctx?.cloudToken || ctx?.token || ctx?.platformToken || '').trim();
  }

  function restoreFromKnownContext() {
    if (isSystemAdminContext()) return '';
    const activeSchool = directActiveSchoolId();
    const activeUser = directActiveUserId();
    const tabToken=String(sessionStorage.getItem(TAB_TOKEN_KEY)||'').trim();
    if(tabToken)return tabToken;
    for (const ctx of sessionContexts()) {
      const candidate = contextToken(ctx);
      if (!candidate) continue;
      const ctxSchool = String(ctx.cloudSchoolId || ctx.schoolId || ctx.school_id || '').trim();
      if (activeSchool && ctxSchool && activeSchool !== ctxSchool) continue;
      const sid = ctxSchool || activeSchool;
      if (!sid) continue;
      const uid = String(ctx.cloudUserId || ctx.userId || ctx.id || '').trim();
      if (activeUser && uid && activeUser !== uid) continue;
      const rr = String(ctx.cloudRole || ctx.role || (hasTabIdentity()?'':localStorage.getItem('currentRole')) || '').trim();
      const exp = String(ctx.cloudExpiresAt || ctx.expiresAt || '').trim();

      sessionStorage.setItem(TAB_TOKEN_KEY, candidate);
      sessionStorage.setItem(TAB_EXPIRES_KEY, exp);
      sessionStorage.setItem(TAB_USER_KEY, uid);
      sessionStorage.setItem(TAB_SCHOOL_KEY, sid);
      sessionStorage.setItem(TAB_ROLE_KEY, rr);
      return candidate;
    }
    return '';
  }

  function updateKnownContext(payload) {
    try {
      let raw = parseJson(sessionStorage.getItem('smart_school_current_session')) || {};
      if(!Object.keys(raw).length && !hasTabIdentity()) raw=parseJson(localStorage.getItem('smart_school_current_session'))||{};
      const sid = String(payload?.schoolId || directActiveSchoolId() || '').trim();
      const rawSid = String(raw.schoolId || raw.school_id || '').trim();
      const rawUid = String(raw.userId || raw.id || '').trim();
      const uid = String(payload?.userId || rawUid || '').trim();
      if (rawSid && sid && rawSid !== sid) return;
      if (rawUid && uid && rawUid !== uid) return;
      const next = {...raw,cloudToken:String(payload?.token||''),cloudExpiresAt:String(payload?.expiresAt||''),cloudUserId:uid,cloudSchoolId:sid,cloudRole:String(payload?.role||raw.role||'')};
      sessionStorage.setItem('smart_school_current_session', JSON.stringify(next));
    } catch (_) {}
  }

  const url = () =>
    (localStorage.getItem('smartSchoolSupabaseUrl') ||
      'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/, '');

  const key = () =>
    localStorage.getItem('smartSchoolSupabaseAnonKey') ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM';

  async function open(login, password, schoolId, requestedRole) {
    const response = await fetch(`${url()}/functions/v1/platform-session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: key(),
      },
      body: JSON.stringify({ login, password, schoolId, role: requestedRole || undefined }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        payload.error || 'تعذر إنشاء جلسة الملفات السحابية',
      );
      error.code = payload.code || `HTTP_${response.status}`;
      error.details = payload.details || '';
      error.requestId = payload.requestId || '';
      throw error;
    }

    if (!payload.token) {
      throw new Error('استجابة جلسة الملفات لا تحتوي على رمز جلسة صالح');
    }

    applyPayload(payload, false);

    return payload;
  }

  async function sessionAction(action, body = {}) {
    if (!valid()) throw new Error('جلسة المنصة السحابية غير صالحة للتبديل.');
    const response = await fetch(`${url()}/functions/v1/platform-session`, {
      method: 'POST',
      headers: {'content-type':'application/json',apikey:key(),'x-platform-session':token()},
      body: JSON.stringify({...body, action}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'تعذر تحديث سياق المدرسة');
      error.code = payload.code || `HTTP_${response.status}`;
      throw error;
    }
    return payload;
  }

  async function memberships() {
    return sessionAction('memberships');
  }

  async function switchSchool(targetSchoolId, targetRole = '', membershipId = '') {
    const payload = await sessionAction('switch', {schoolId:targetSchoolId, role:targetRole, membershipId});
    if (!payload.token) throw new Error('لم تُنشأ جلسة سحابية للمدرسة المختارة.');
    sessionStorage.setItem(TAB_TOKEN_KEY,payload.token);sessionStorage.setItem(TAB_EXPIRES_KEY,payload.expiresAt||'');sessionStorage.setItem(TAB_USER_KEY,payload.userId||'');sessionStorage.setItem(TAB_SCHOOL_KEY,payload.schoolId||'');sessionStorage.setItem(TAB_ROLE_KEY,payload.role||'');
    window.dispatchEvent(new CustomEvent('platform-cloud-session-ready',{detail:{userId:payload.userId||'',schoolId:payload.schoolId||'',role:payload.role||'',expiresAt:payload.expiresAt||'',membershipId:payload.membershipId||''}}));
    return payload;
  }

  function token() {
    if (isSystemAdminContext()) return '';
    return tabFirst(TAB_TOKEN_KEY,TOKEN_KEY);
  }

  function expiresAt() {
    return tabFirst(TAB_EXPIRES_KEY,EXPIRES_KEY);
  }

  function userId() {
    if (isSystemAdminContext()) return '';
    return tabFirst(TAB_USER_KEY,USER_KEY);
  }

  function schoolId() {
    if (isSystemAdminContext()) return '';
    return tabFirst(TAB_SCHOOL_KEY,SCHOOL_KEY);
  }

  function role() {
    if (isSystemAdminContext()) return 'system_admin';
    return tabFirst(TAB_ROLE_KEY,ROLE_KEY);
  }

  function valid() {
    if (isSystemAdminContext()) return false;
    const currentToken = token();
    const expiry = expiresAt();
    const activeSchool = sessionStorage.getItem(TAB_SCHOOL_KEY) || sessionStorage.getItem('smart_school_tab_school_v1') || (hasTabIdentity()?'':(localStorage.getItem('active_school_id') || localStorage.getItem('current_school_id') || localStorage.getItem('school_id') || localStorage.getItem('smart_school_id'))) || '';
    const sameSchool = !activeSchool || !schoolId() || String(activeSchool) === String(schoolId());
    return Boolean(currentToken && sameSchool && (!expiry || Date.parse(expiry) > Date.now() + 60_000));
  }

  function currentSchoolId() {
    return sessionStorage.getItem(TAB_SCHOOL_KEY) || sessionStorage.getItem('smart_school_tab_school_v1') ||
      (hasTabIdentity()?'':(localStorage.getItem('active_school_id') || localStorage.getItem('current_school_id') || localStorage.getItem('school_id') || localStorage.getItem('smart_school_id'))) || schoolId() || '';
  }

  function applyPayload(payload, renewed = true) {
    if (!payload || !payload.token) throw new Error('استجابة تجديد الجلسة لا تحتوي على رمز صالح');
    const sid=payload.schoolId || currentSchoolId() || '';const rr=payload.role || role() || (hasTabIdentity()?'':localStorage.getItem('currentRole')) || '';
    sessionStorage.setItem(TAB_TOKEN_KEY,payload.token);sessionStorage.setItem(TAB_EXPIRES_KEY,payload.expiresAt||'');sessionStorage.setItem(TAB_USER_KEY,payload.userId||'');sessionStorage.setItem(TAB_SCHOOL_KEY,sid);sessionStorage.setItem(TAB_ROLE_KEY,rr);
    updateKnownContext({...payload,schoolId:sid,role:rr});
    window.dispatchEvent(new CustomEvent('platform-cloud-session-ready',{detail:{userId:payload.userId||'',schoolId:sid,role:rr,expiresAt:payload.expiresAt||'',renewed:Boolean(renewed)}}));
    return payload.token;
  }

  let recoveryPromise = null;
  async function recover() {
    if (recoveryPromise) return recoveryPromise;
    recoveryPromise = (async () => {
      let oldToken = token();
      const sid = currentSchoolId();
      if (!oldToken) oldToken = restoreFromKnownContext();
      if (!oldToken) {
        const error = new Error('لا توجد جلسة سحابية لهذه المدرسة. أعد تسجيل الدخول إلى المدرسة.');
        error.code = 'SESSION_MISSING';
        throw error;
      }
      const response = await fetch(`${url()}/functions/v1/platform-session`, {
        method: 'POST',
        headers: {'content-type':'application/json',apikey:key(),'x-platform-session':oldToken},
        body: JSON.stringify({action:'renew',schoolId:sid}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.token) {
        const error = new Error(payload.error || 'تعذر تجديد الجلسة السحابية. أعد تسجيل الدخول إلى المدرسة.');
        error.code = payload.code || `HTTP_${response.status}`;
        error.requestId = payload.requestId || '';
        throw error;
      }
      return applyPayload(payload, true);
    })();
    try { return await recoveryPromise; }
    finally { recoveryPromise = null; }
  }

  async function ensure() {
    if (isSystemAdminContext()) {
      const error = new Error('جلسة مدير النظام منفصلة عن جلسات المدارس المستقلة.');
      error.code = 'SYSTEM_ADMIN_SCHOOL_SESSION_BLOCKED';
      throw error;
    }
    if (valid()) return token();
    restoreFromKnownContext();
    if (valid()) return token();
    return recover();
  }


  async function verifyAccess(requiredRoles = []) {
    if (isSystemAdminContext()) {
      const error = new Error('التحقق من عضوية المدرسة غير متاح داخل سياق مدير النظام.');
      error.code = 'SYSTEM_ADMIN_SCHOOL_VERIFY_BLOCKED';
      throw error;
    }
    const payload = await memberships();
    const current = payload && payload.current ? payload.current : {};
    const sid = String(current.schoolId || '').trim();
    const uid = String(current.userId || '').trim();
    const rr = String(current.role || '').trim();
    if (!sid || !uid || !rr) {
      const error = new Error('الجلسة لا تحتوي على مدرسة ومستخدم ودور موثقين.');
      error.code = 'VERIFIED_CONTEXT_INCOMPLETE';
      throw error;
    }
    const membershipsList = Array.isArray(payload.memberships) ? payload.memberships : [];
    const normalizeRole = (v) => String(v || '').trim().toLowerCase();
    const aliases = {
      manager: ['manager','principal','school_manager','leadership','مدير','مديرة','مدير المدرسة','مديرة المدرسة'],
      agent: ['agent','deputy','vice','wakil','agency','وكيل','وكيلة'],
      teacher: ['teacher','performance','معلم','معلمة'],
      student_advisor: ['student_advisor','advisor','counselor','مرشد','موجه'],
      health_advisor: ['health_advisor','health-advisor','موجه صحي','الموجه الصحي'],
      activity_leader: ['activity_leader','activity-leader','activity','رائد النشاط','رائدة النشاط'],
      kindergarten_teacher: ['kindergarten_teacher','kindergarten-teacher','معلمة رياض الأطفال'],
      administrative_employee: ['administrative_employee','admin_employee','employee_admin','موظف إداري','موظفة إدارية']
    };
    const allowed = (requiredRoles || []).flatMap((role) => aliases[normalizeRole(role)] || [normalizeRole(role)]);
    const member = membershipsList.find((m) =>
      String(m.schoolId || '') === sid &&
      String(m.userId || '') === uid &&
      normalizeRole(m.role) === normalizeRole(rr)
    );
    if (!member) {
      const error = new Error('المستخدم غير مرتبط بالمدرسة الحالية بعضوية فعالة.');
      error.code = 'VERIFIED_MEMBERSHIP_MISSING';
      throw error;
    }
    if (allowed.length && !allowed.includes(normalizeRole(rr))) {
      const error = new Error('الدور الحالي غير مخول بفتح هذه الصفحة.');
      error.code = 'VERIFIED_ROLE_DENIED';
      throw error;
    }
    // RL33: verified identity remains tab-scoped. Never rewrite shared localStorage identity keys.
    sessionStorage.setItem(TAB_SCHOOL_KEY, sid);
    sessionStorage.setItem(TAB_USER_KEY, uid);
    sessionStorage.setItem(TAB_ROLE_KEY, rr || String(member.role || ''));
    return { schoolId: sid, userId: uid, role: rr || String(member.role || ''), membership: member };
  }

  function clear() {
    // RL33: logout/clear is strictly tab-scoped. Shared localStorage may belong to another open account/tab.
    [TAB_TOKEN_KEY,TAB_EXPIRES_KEY,TAB_USER_KEY,TAB_SCHOOL_KEY,TAB_ROLE_KEY,'platform_file_session_token','platform_file_session_expires_at','platform_file_session_user_id','platform_file_session_school_id','platform_file_session_role'].forEach(k=>sessionStorage.removeItem(k));
    try {
      const raw=parseJson(sessionStorage.getItem('smart_school_current_session'));
      if(raw){delete raw.cloudToken;delete raw.cloudExpiresAt;delete raw.cloudUserId;delete raw.cloudSchoolId;delete raw.cloudRole;sessionStorage.setItem('smart_school_current_session',JSON.stringify(raw));}
      const admin=parseJson(sessionStorage.getItem('administrative_employee_tab_session_v1'));
      if(admin){delete admin.token;delete admin.expiresAt;sessionStorage.setItem('administrative_employee_tab_session_v1',JSON.stringify(admin));}
    } catch (_) {}
  }


  const ROLE_ROOTS={
    manager:'manager.html',agent:'agent.html',teacher:'teacher.html',
    student_advisor:'student_advisor.html',health_advisor:'health_advisor.html',
    activity_leader:'activity_leader.html',kindergarten_teacher:'kindergarten_teacher.html',
    administrative_employee:'administrative_employee_portal.html'
  };
  function routeRequiredRole(){
    const file=(location.pathname.split('/').pop()||'').toLowerCase();
    if(!file || /(login|register|guardian|public|invite)/.test(file))return '';

    // RL70: admin_employee_management.html is a supervisor workspace, not the
    // administrative employee's personal portal. Its required role must follow
    // the supervisor that opened it, otherwise RL33 hides the page then redirects
    // manager/agent away after the first visible paint.
    if(file==='admin_employee_management.html'){
      try{
        const q=new URLSearchParams(location.search||'');
        const s=String(q.get('supervisor')||q.get('viewerRole')||q.get('viewer')||q.get('returnRole')||'').trim().toLowerCase();
        if(['agent','deputy','vice','wakil','agency','وكيل','وكيلة'].includes(s))return 'agent';
        if(['manager','principal','school_manager','leadership','مدير','مديرة'].includes(s))return 'manager';
      }catch(_){}
      const current=String(role()||'').trim().toLowerCase();
      if(['agent','deputy','vice','wakil','agency','وكيل','وكيلة'].includes(current))return 'agent';
      if(['manager','principal','school_manager','leadership','مدير','مديرة'].includes(current))return 'manager';
      return '';
    }

    // RL74: supervisor views of admin-employee subpages must keep the
    // manager/agent session instead of being reclassified as employee.
    if([
      'administrative_employee_portal.html',
      'administrative_employee_evaluation.html',
      'administrative_employee_execution.html',
      'administrative_employee_improvement.html',
      'administrative_employee_plan.html',
      'administrative_employee_library.html'
    ].includes(file)){
      try{
        const q=new URLSearchParams(location.search||'');
        const supervisorMode=String(q.get('mode')||'').trim().toLowerCase()==='supervisor';
        const s=String(q.get('supervisor')||q.get('viewerRole')||q.get('returnRole')||'').trim().toLowerCase();
        if(supervisorMode){
          if(['agent','deputy','vice','wakil','agency','وكيل','وكيلة'].includes(s))return 'agent';
          if(['manager','principal','school_manager','leadership','مدير','مديرة'].includes(s))return 'manager';
          const current=String(role()||'').trim().toLowerCase();
          if(['agent','deputy','vice','wakil','agency','وكيل','وكيلة'].includes(current))return 'agent';
          if(['manager','principal','school_manager','leadership','مدير','مديرة'].includes(current))return 'manager';
        }
      }catch(_){}
    }

    const rules=[
      [/^administrative_employee|^admin_employee/,'administrative_employee'],
      [/^kindergarten_teacher/,'kindergarten_teacher'],
      [/^student_advisor/,'student_advisor'],
      [/^health_advisor/,'health_advisor'],
      [/^activity_leader/,'activity_leader'],
      [/^(agent|wakil|deputy)/,'agent'],
      [/^teacher/,'teacher'],
      [/^manager/,'manager']
    ];
    for(const [rx,roleName] of rules)if(rx.test(file))return roleName;
    return '';
  }
  function explicitFollowMode(){
    try{const q=new URLSearchParams(location.search);return q.get('mode')==='follow'||q.get('follow')==='1'||q.get('readOnly')==='1'}catch(_){return false}
  }
  async function enforceRouteRole(){
    const required=routeRequiredRole();
    if(!required||isSystemAdminContext())return true;
    document.documentElement.dataset.platformRoleChecking='1';
    try{
      const verified=await verifyAccess([required]);
      document.documentElement.dataset.platformRoleVerified='1';
      return verified;
    }catch(err){
      if(explicitFollowMode()){
        try{
          const v=await verifyAccess([]);
          const r=String(v.role||'').toLowerCase();
          if(['manager','principal','school_manager','agent','deputy','vice','wakil'].includes(r)){
            document.documentElement.dataset.platformReadOnlyFollow='1';
            document.documentElement.dataset.platformRoleVerified='1';
            window.__PLATFORM_READ_ONLY_FOLLOW__=true;
            return v;
          }
        }catch(_){}
      }
      document.documentElement.dataset.platformRoleDenied='1';
      const current=String(role()||'').toLowerCase();
      const normalized=current==='performance'?'teacher':current;
      const target=ROLE_ROOTS[normalized]||'school-login.html';
      if(!/school-login\.html$/i.test(location.pathname))location.replace(target);
      throw err;
    }
  }

  const SESSION_VERSION='2026.09.05-RL33-complete-tab-role-isolation';

  window.PlatformCloudSession = {
    VERSION:SESSION_VERSION,
    open,
    memberships,
    switchSchool,
    token,
    expiresAt,
    userId,
    schoolId,
    role,
    valid,
    ensure,
    recover,
    restoreFromKnownContext,
    verifyAccess,
    enforceRouteRole,
    clear,
  };

  // Same-tab navigation normally keeps sessionStorage, but restoring here also
  // covers pages opened after a browser/sessionStorage transition.
  restoreFromKnownContext();
  const roleContract=routeRequiredRole();
  if(roleContract){
    const st=document.createElement('style');
    st.id='platform-role-lock-style';
    st.textContent='html[data-platform-role-checking=\"1\"]:not([data-platform-role-verified=\"1\"]) body{visibility:hidden!important}';
    (document.head||document.documentElement).appendChild(st);
    const run=()=>enforceRouteRole().catch(()=>{});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else queueMicrotask(run);
  }
})();
