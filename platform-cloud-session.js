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
  let __rawLocalGet = null;

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
    __rawLocalGet=(key)=>{try{return originalGet.call(window.localStorage,String(key))}catch(_){return null}};
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

  // RL148 — Safe legacy-session bridge for browsers upgraded from pre-RL33 builds.
  // Older builds persisted the school cloud token in localStorage. RL33 correctly
  // isolated identity per tab, but deliberately stopped reading those shared keys.
  // A school that had not logged in again after that upgrade could therefore keep
  // its visual manager shell while protected child pages saw SESSION_MISSING.
  // Migrate the legacy token into this tab ONLY when school + user (+ role when known)
  // exactly match the current tab identity. Nothing is deleted from localStorage.
  const LEGACY_BRIDGE_MARK='platform_legacy_cloud_session_bridge_rl148';
  function migrateLegacyCloudSessionToTab(){
    if(isSystemAdminContext())return '';
    const existing=String(sessionStorage.getItem(TAB_TOKEN_KEY)||'').trim();
    if(existing)return existing;
    if(typeof __rawLocalGet!=='function')return '';
    try{
      const legacyToken=String(__rawLocalGet(TOKEN_KEY)||'').trim();
      if(!legacyToken)return '';
      const legacySchool=String(__rawLocalGet(SCHOOL_KEY)||'').trim();
      const legacyUser=String(__rawLocalGet(USER_KEY)||'').trim();
      const legacyRole=String(__rawLocalGet(ROLE_KEY)||'').trim();
      const legacyExp=String(__rawLocalGet(EXPIRES_KEY)||'').trim();
      const sess=parseJson(sessionStorage.getItem('smart_school_current_session'))||{};
      const tabSchool=String(sessionStorage.getItem(TAB_SCHOOL_KEY)||sessionStorage.getItem('smart_school_tab_school_v1')||sess.cloudSchoolId||sess.schoolId||sess.school_id||'').trim();
      const tabUser=String(sessionStorage.getItem(TAB_USER_KEY)||sessionStorage.getItem('currentUserId')||sess.cloudUserId||sess.userId||sess.id||'').trim();
      const tabRole=String(sessionStorage.getItem(TAB_ROLE_KEY)||sess.cloudRole||sess.role||'').trim();
      // Never import a shared legacy token into an unbound tab.
      if(!tabSchool||!tabUser||!legacySchool||!legacyUser)return '';
      if(tabSchool!==legacySchool||tabUser!==legacyUser)return '';
      if(tabRole&&legacyRole&&canonicalRole(tabRole)!==canonicalRole(legacyRole))return '';
      sessionStorage.setItem(TAB_TOKEN_KEY,legacyToken);
      sessionStorage.setItem(TAB_EXPIRES_KEY,legacyExp);
      sessionStorage.setItem(TAB_USER_KEY,tabUser);
      sessionStorage.setItem(TAB_SCHOOL_KEY,tabSchool);
      sessionStorage.setItem(TAB_ROLE_KEY,tabRole||legacyRole);
      sessionStorage.setItem(LEGACY_BRIDGE_MARK,JSON.stringify({schoolId:tabSchool,userId:tabUser,at:Date.now()}));
      return legacyToken;
    }catch(_){return ''}
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
    const bridged=migrateLegacyCloudSessionToTab();
    if(bridged)return bridged;
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

  function baseRole() {
    if (isSystemAdminContext()) return 'system_admin';
    return tabFirst(TAB_ROLE_KEY,ROLE_KEY);
  }

  // RL143 — Unified Independent School Identity Contract
  // One source of truth for every school/tab: verified cloud session school + user + canonical role.
  function canonicalRole(value) {
    const v=String(value||'').trim().toLowerCase();
    const groups={
      manager:['manager','principal','school_manager','school-manager','leadership','مدير','مديرة','مدير المدرسة','مديرة المدرسة'],
      agent:['agent','deputy','vice','wakil','agency','وكيل','وكيلة'],
      teacher:['teacher','performance','معلم','معلمة'],
      student_advisor:['student_advisor','student-advisor','advisor','counselor','مرشد','مرشدة','موجه','موجهة'],
      health_advisor:['health_advisor','health-advisor','موجه صحي','موجهة صحية','الموجه الصحي'],
      activity_leader:['activity_leader','activity-leader','activity','رائد النشاط','رائدة النشاط'],
      kindergarten_teacher:['kindergarten_teacher','kindergarten-teacher','معلمة رياض الأطفال'],
      administrative_employee:['administrative_employee','admin_employee','employee_admin','موظف إداري','موظفة إدارية']
    };
    for(const [k,a] of Object.entries(groups)) if(v===k||a.includes(v)) return k;
    return v;
  }
  function verifiedContext(){
    return {schoolId:String(schoolId()||'').trim(),userId:String(userId()||'').trim(),role:canonicalRole(role()||'')};
  }

  function role() {
    if (isSystemAdminContext()) return 'system_admin';
    try {
      const delegated = window.__PLATFORM_DELEGATED_ROLE_ACCESS__;
      const delegatedRole = String(delegated?.requiredRole || delegated?.roleCode || '').trim().toLowerCase();
      const delegatedSchool = String(delegated?.schoolId || '').trim();
      if (delegatedRole && (!delegatedSchool || delegatedSchool === String(schoolId() || '').trim())) return delegatedRole;
    } catch (_) {}
    return baseRole();
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
    const sid=payload.schoolId || currentSchoolId() || '';const rr=payload.role || baseRole() || (hasTabIdentity()?'':localStorage.getItem('currentRole')) || '';
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

  let ensurePromise = null;
  async function ensure() {
    if (ensurePromise) return ensurePromise;
    ensurePromise = (async () => {
      if (isSystemAdminContext()) {
        const error = new Error('جلسة مدير النظام منفصلة عن جلسات المدارس المستقلة.');
        error.code = 'SYSTEM_ADMIN_SCHOOL_SESSION_BLOCKED';
        throw error;
      }
      let currentToken = '';
      if (valid()) currentToken = token();
      else {
        restoreFromKnownContext();
        if (valid()) currentToken = token();
        else currentToken = await recover();
      }
      // Delegated access is still revalidated server-side. Single-flight only prevents
      // duplicate startup calls in the same page from repeating the same work concurrently.
      await refreshDelegatedRoleContext().catch(()=>null);
      return currentToken || token();
    })();
    try { return await ensurePromise; }
    finally { ensurePromise = null; }
  }


  function recentlyVerified(requiredRoles = [], maxAgeMs = 5 * 60 * 1000) {
    try {
      const raw=parseJson(sessionStorage.getItem(VERIFIED_CONTEXT_KEY))||{};
      const sid=String(schoolId()||'').trim(), uid=String(userId()||'').trim(), rr=canonicalRole(baseRole()||'');
      const allowed=(requiredRoles||[]).map(canonicalRole).filter(Boolean);
      if(!raw || !raw.verifiedAt || Date.now()-Number(raw.verifiedAt)>maxAgeMs) return null;
      if(String(raw.schoolId||'')!==sid || String(raw.userId||'')!==uid || canonicalRole(raw.role||'')!==rr) return null;
      if(allowed.length && !allowed.includes(rr)) return null;
      return {schoolId:sid,userId:uid,role:rr,verified:true,verifiedAt:Number(raw.verifiedAt)};
    } catch(_) { return null; }
  }

  function markVerifiedContext(ctx) {
    try {
      sessionStorage.setItem(VERIFIED_CONTEXT_KEY,JSON.stringify({
        schoolId:String((ctx&&ctx.schoolId)||schoolId()||'').trim(),
        userId:String((ctx&&ctx.userId)||userId()||'').trim(),
        role:canonicalRole((ctx&&ctx.role)||baseRole()||''),
        verifiedAt:Date.now()
      }));
    } catch(_) {}
  }

  async function ensureLive(requiredRoles = [], options = {}) {
    if (isSystemAdminContext()) {
      const error = new Error('جلسة مدير النظام منفصلة عن جلسات المدارس المستقلة.');
      error.code = 'SYSTEM_ADMIN_SCHOOL_SESSION_BLOCKED';
      throw error;
    }
    const forceLive=options&&options.force===true;
    const recent=forceLive?null:recentlyVerified(requiredRoles);
    if(recent && valid()) return recent;
    await ensure();
    try {
      return await verifyAccess(requiredRoles);
    } catch (e) {
      const code=String(e&&e.code||'').toUpperCase();
      const recoverable=['SESSION_INVALID','SESSION_EXPIRED','SESSION_MISSING','SESSION_RENEW_NOT_FOUND','HTTP_401'].includes(code);
      if(!recoverable) throw e;
      await recover();
      return await verifyAccess(requiredRoles);
    }
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
    // RL143: use the single module-level canonical role contract.
    const allowed = (requiredRoles || []).map(canonicalRole).filter(Boolean);
    const currentRole = canonicalRole(rr);
    const member = membershipsList.find((m) =>
      String(m.schoolId || '') === sid &&
      String(m.userId || '') === uid &&
      canonicalRole(m.role) === currentRole
    );
    if (!member) {
      const error = new Error('المستخدم غير مرتبط بالمدرسة الحالية بعضوية فعالة.');
      error.code = 'VERIFIED_MEMBERSHIP_MISSING';
      throw error;
    }
    if (allowed.length && !allowed.includes(currentRole)) {
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
      const current=String(baseRole()||'').trim().toLowerCase();
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
          const current=String(baseRole()||'').trim().toLowerCase();
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
    try{
      const q=new URLSearchParams(location.search||'');
      const queryActive=q.get('mode')==='follow'||q.get('mode')==='supervisor_readonly'||q.get('follow')==='1'||q.get('readonly')==='1'||q.get('readOnly')==='1'||q.get('monitoring')==='true';
      if(queryActive)return true;
      const parse=(v)=>{try{return JSON.parse(v||'null')||{}}catch(_){return {}}};
      const ctx=parse(sessionStorage.getItem('platform_follow_context_v4'));
      const legacy=parse(sessionStorage.getItem('manager_follow_context_v2'));
      const c=ctx&&ctx.readonly===true?ctx:(legacy&&legacy.readonly===true?legacy:{});
      if(!c||c.readonly!==true)return false;
      const sid=String(c.schoolId||'').trim(), current=String(schoolId()||sessionStorage.getItem(TAB_SCHOOL_KEY)||'').trim();
      if(sid&&current&&sid!==current)return false;
      const viewer=canonicalRole(c.viewerRole||c.viewer||'');
      return viewer==='manager'||viewer==='agent';
    }catch(_){return false}
  }

  // RL76: full-role delegation is a temporary execution authorization, not a
  // permanent role mutation.  It must be verified by platform-tasks before the
  // normal role isolation guard is bypassed.  Query parameters alone never grant
  // access.  A verified context is kept only in this browser tab so nested pages
  // of the delegated role can be opened without changing the user's base role.
  const DELEGATED_ROLE_CONTEXT_KEY='platform_delegated_role_context_v1';
  function readDelegatedRoleContext(){
    try{return parseJson(sessionStorage.getItem(DELEGATED_ROLE_CONTEXT_KEY))||{}}catch(_){return {}}
  }
  function clearDelegatedRoleContext(){
    try{sessionStorage.removeItem(DELEGATED_ROLE_CONTEXT_KEY)}catch(_){}
    try{delete window.__PLATFORM_DELEGATED_ROLE_ACCESS__}catch(_){}
    try{document.documentElement.removeAttribute('data-platform-delegated-role')}catch(_){}
  }
  function delegatedRoleCandidate(required){
    try{
      const q=new URLSearchParams(location.search||'');
      if(q.get('delegated_role')==='1' && q.get('delegated_role_task')){
        return {taskId:String(q.get('delegated_role_task')||'').trim(),requiredRole:String(required||'').trim().toLowerCase(),source:'query'};
      }
      const c=readDelegatedRoleContext();
      if(c && c.taskId && String(c.requiredRole||'').toLowerCase()===String(required||'').toLowerCase())
        markVerifiedContext({schoolId:sid,userId:uid,role:rr});
    return {taskId:String(c.taskId),requiredRole:String(required||'').trim().toLowerCase(),source:'tab'};
    }catch(_){}
    return null;
  }
  async function verifyDelegatedRoleAccess(required){
    const candidate=delegatedRoleCandidate(required);
    if(!candidate||!candidate.taskId)return null;
    const platformToken=String(token()||'').trim();
    if(!platformToken){clearDelegatedRoleContext();return null;}
    try{
      const response=await fetch(`${url()}/functions/v1/platform-tasks?action=validate-delegated-role`,{
        method:'POST',
        headers:{'content-type':'application/json',apikey:key(),'x-platform-session':platformToken},
        body:JSON.stringify({taskId:candidate.taskId,requiredRole:candidate.requiredRole})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.ok!==true||!data?.delegation){throw new Error(data?.error||'DELEGATED_ROLE_NOT_AUTHORIZED');}
      const ctx={
        taskId:candidate.taskId,
        requiredRole:String(data.delegation.requiredRole||candidate.requiredRole),
        roleCode:String(data.delegation.roleCode||''),
        schoolId:String(data.delegation.schoolId||schoolId()||''),
        verifiedAt:Date.now()
      };
      sessionStorage.setItem(DELEGATED_ROLE_CONTEXT_KEY,JSON.stringify(ctx));
      window.__PLATFORM_DELEGATED_ROLE_ACCESS__=Object.freeze({...ctx});
      document.documentElement.setAttribute('data-platform-delegated-role','1');
      return ctx;
    }catch(err){
      clearDelegatedRoleContext();
      if(candidate.source==='query')console.warn('[platform-session] delegated role authorization rejected',err);
      return null;
    }
  }

  async function refreshDelegatedRoleContext(){
    const ctx=readDelegatedRoleContext();
    const required=String(ctx?.requiredRole||ctx?.roleCode||'').trim().toLowerCase();
    if(!ctx?.taskId||!required){
      try{delete window.__PLATFORM_DELEGATED_ROLE_ACCESS__}catch(_){}
      return null;
    }
    return verifyDelegatedRoleAccess(required);
  }

  function delegatedRole(){
    try{return String(window.__PLATFORM_DELEGATED_ROLE_ACCESS__?.requiredRole||window.__PLATFORM_DELEGATED_ROLE_ACCESS__?.roleCode||'').trim().toLowerCase()}catch(_){return ''}
  }
  function delegatedTaskId(){
    try{return String(window.__PLATFORM_DELEGATED_ROLE_ACCESS__?.taskId||'').trim()}catch(_){return ''}
  }
  function delegationHeaders(){
    const taskId=delegatedTaskId(), delegated=delegatedRole();
    return taskId&&delegated?{'x-platform-delegated-task':taskId,'x-platform-delegated-role':delegated}:{};
  }

  async function enforceRouteRole(){
    const required=routeRequiredRole();
    if(!required||isSystemAdminContext())return true;
    document.documentElement.dataset.platformRoleChecking='1';
    try{
      const delegated=await verifyDelegatedRoleAccess(required);
      if(delegated){
        document.documentElement.dataset.platformRoleVerified='1';
        return delegated;
      }
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
      const current=String(baseRole()||'').toLowerCase();
      const normalized=current==='performance'?'teacher':current;
      let target=ROLE_ROOTS[normalized]||'';
      if(!target){
        try{
          const q=new URLSearchParams();
          q.set('reason','school_access_denied');
          const sid=String(schoolId()||sessionStorage.getItem('smart_school_tab_school_v1')||sessionStorage.getItem('platform_tab_session_school_id_v1')||sessionStorage.getItem('current_school_id')||new URLSearchParams(location.search||'').get('schoolId')||new URLSearchParams(location.search||'').get('school_id')||'').trim();
          const schoolName=String(sessionStorage.getItem('current_school_name')||new URLSearchParams(location.search||'').get('school_name')||'').trim();
          if(sid)q.set('schoolId',sid);
          if(schoolName)q.set('school_name',schoolName);
          q.set('schoolMode','independent');
          q.set('scope','school');
          target='school-login.html?'+q.toString();
        }catch(_){target='school-login.html?reason=school_access_denied';}
      }
      if(!/school-login\.html$/i.test(location.pathname))location.replace(target);
      throw err;
    }
  }

  const SESSION_VERSION='2026.09.14-RL157-supervisor-follow-target-shell';

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
    canonicalRole,
    verifiedContext,
    baseRole,
    delegatedRole,
    delegatedTaskId,
    delegationHeaders,
    valid,
    ensure,
    ensureLive,
    recentlyVerified,
    recover,
    restoreFromKnownContext,
    verifyAccess,
    enforceRouteRole,
    clearDelegatedRoleContext,
    clear,
    // Canonical read-only connection descriptor for child platform modules.
    // It exposes only the public project URL + anon key already used by this
    // session engine; school/user identity is NOT accepted from callers.
    connectionConfig: () => Object.freeze({
      supabaseUrl: url(),
      anonKey: key(),
    }),
  };

  // RL145 — Unified session heartbeat for every independent-school page.
  // A school tab may remain open for many hours. Previously the visual shell could
  // stay usable after the 12-hour cloud session expired, so a later protected
  // section appeared to lose the cloud connection. Keep the verified tab session
  // warm without changing school/user/role and retry only through the canonical
  // platform-session renew path.
  let __heartbeatTimer = null;
  let __heartbeatInFlight = false;
  async function heartbeat(reason = 'interval') {
    if (isSystemAdminContext() || __heartbeatInFlight) return false;
    const known = Boolean(token() || restoreFromKnownContext());
    if (!known) return false;
    __heartbeatInFlight = true;
    try {
      await ensure();
      window.dispatchEvent(new CustomEvent('platform-cloud-session-heartbeat',{detail:{ok:true,reason,schoolId:schoolId(),userId:userId(),role:role()}}));
      return true;
    } catch (err) {
      // Never clear or redirect on a transient heartbeat failure. Individual
      // protected pages may decide how to present a definitive authorization error.
      console.warn('[platform-session] heartbeat failed', reason, err?.code || err?.message || err);
      window.dispatchEvent(new CustomEvent('platform-cloud-session-heartbeat',{detail:{ok:false,reason,code:String(err?.code||''),message:String(err?.message||'')}}));
      return false;
    } finally {
      __heartbeatInFlight = false;
    }
  }
  function startHeartbeat(){
    if(__heartbeatTimer || isSystemAdminContext()) return;
    // Heartbeat must never compete with the initial page access check. The first
    // automatic heartbeat is delayed; returning to a tab only checks after it has
    // actually spent time in the background.
    let hiddenAt=0;
    __heartbeatTimer=setInterval(()=>heartbeat('interval'),5*60*1000);
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden'){hiddenAt=Date.now();return;}
      if(document.visibilityState==='visible'&&hiddenAt&&Date.now()-hiddenAt>60*1000) heartbeat('visibility');
      hiddenAt=0;
    });
    window.addEventListener('pageshow',(event)=>{if(event && event.persisted) setTimeout(()=>heartbeat('bfcache'),250);});
  }

  // Same-tab navigation normally keeps sessionStorage, but restoring here also
  // covers pages opened after a browser/sessionStorage transition.
  restoreFromKnownContext();
  startHeartbeat();
  const roleContract=routeRequiredRole();
  // Pages with their own verified access gate (manager.html) must not start a
  // second concurrent role check. The explicit gate still calls verifyAccess().
  if(roleContract && !window.__PLATFORM_EXPLICIT_ACCESS_GATE__){
    const st=document.createElement('style');
    st.id='platform-role-lock-style';
    st.textContent='html[data-platform-role-checking=\"1\"]:not([data-platform-role-verified=\"1\"]) body{visibility:hidden!important}';
    (document.head||document.documentElement).appendChild(st);
    const run=()=>enforceRouteRole().catch(()=>{});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else queueMicrotask(run);
  }
})();


/* RL157 — Global supervisor follow mode with target-role presentation identity.
   Viewer keeps the real manager/agent cloud session. The followed account is a
   read-only presentation context only; it never replaces the server session. */
(function(){
  'use strict';
  if(window.__PLATFORM_FOLLOW_READONLY_RL155__)return;
  window.__PLATFORM_FOLLOW_READONLY_RL155__=1;
  const KEY='platform_follow_context_v4', LEGACY='manager_follow_context_v2';
  const parse=v=>{try{return JSON.parse(v||'null')||{}}catch(_){return {}}};
  const norm=v=>String(v||'').trim().toLowerCase();
  const same=(a,b)=>String(a||'').trim()===String(b||'').trim();
  const canonical=v=>{
    const r=norm(v);
    if(['manager','principal','school_manager','leadership','مدير','مديرة'].includes(r))return'manager';
    if(['agent','deputy','vice','wakil','agency','وكيل','وكيلة'].includes(r))return'agent';
    if(['teacher','performance','معلم','معلمة'].includes(r))return'teacher';
    if(['student_advisor','student-advisor','advisor','counselor','guide'].includes(r))return'student_advisor';
    if(['activity_leader','activity-leader','activity'].includes(r))return'activity_leader';
    if(['health_advisor','health-advisor','health'].includes(r))return'health_advisor';
    if(['kindergarten_teacher','kindergarten-teacher','kindergarten'].includes(r))return'kindergarten_teacher';
    if(['administrative_employee','administrative-employee','admin_employee'].includes(r))return'administrative_employee';
    return r;
  };
  function fromQuery(){
    try{
      const q=new URLSearchParams(location.search||''), mode=norm(q.get('mode'));
      const active=q.get('follow')==='1'||q.get('readonly')==='1'||q.get('readOnly')==='1'||q.get('monitoring')==='true'||mode.includes('follow')||mode.includes('supervisor')||mode.includes('monitor');
      if(!active)return null;
      const viewer=canonical(q.get('viewerRole')||q.get('viewer')||q.get('returnRole'));
      const schoolId=String(q.get('schoolId')||q.get('school_id')||q.get('school')||'').trim();
      const targetUserId=String(q.get('targetUser')||q.get('followUserId')||q.get('userId')||q.get('uid')||q.get('owner_uid')||'').trim();
      const targetEmail=norm(q.get('followEmail')||q.get('targetEmail')||q.get('emp')||'');
      const targetRole=canonical(q.get('targetRole')||q.get('role')||'');
      if(!['manager','agent'].includes(viewer)||!schoolId||(!targetUserId&&!targetEmail))return null;
      return {mode:'supervisor_follow',readonly:true,viewerRole:viewer,schoolId,targetUserId,targetEmail,targetRole,returnUrl:viewer==='agent'?'agent.html':'manager.html',createdAt:new Date().toISOString()};
    }catch(_){return null}
  }
  function context(){
    const q=fromQuery();
    if(q){try{sessionStorage.setItem(KEY,JSON.stringify(q));if(q.viewerRole==='manager')sessionStorage.setItem(LEGACY,JSON.stringify({...q,mode:'manager_follow',managerReturn:'manager.html?sectionReturn=1'}));}catch(_){}return q;}
    // RL157: the supervisor root itself is never the followed user's shell.  If a
    // legacy/custom guard returns the browser to manager.html/agent.html, do not
    // keep painting that root as "follow mode".  The actual follow shell is the
    // target role page (teacher/advisor/activity/etc.).
    try{
      const file=(location.pathname.split('/').pop()||'').toLowerCase();
      const qs=new URLSearchParams(location.search||'');
      const explicit=qs.get('follow')==='1'||qs.get('readonly')==='1'||qs.get('monitoring')==='true'||norm(qs.get('mode')).includes('follow')||norm(qs.get('mode')).includes('supervisor');
      if((file==='manager.html'||file==='agent.html')&&!explicit)return null;
    }catch(_){}
    const c=parse(sessionStorage.getItem(KEY));
    if(c&&c.readonly===true&&['manager','agent'].includes(canonical(c.viewerRole)))return {...c,viewerRole:canonical(c.viewerRole),targetRole:canonical(c.targetRole)};
    const l=parse(sessionStorage.getItem(LEGACY));
    if(l&&l.readonly===true)return {...l,mode:'supervisor_follow',viewerRole:'manager',targetRole:canonical(l.targetRole),returnUrl:'manager.html'};
    return null;
  }
  let ctx=context();
  if(!ctx)return;
  const pcs=window.PlatformCloudSession;
  const real={
    role:pcs&&typeof pcs.role==='function'?pcs.role.bind(pcs):()=>'',
    userId:pcs&&typeof pcs.userId==='function'?pcs.userId.bind(pcs):()=>'',
    schoolId:pcs&&typeof pcs.schoolId==='function'?pcs.schoolId.bind(pcs):()=>'',
    memberships:pcs&&typeof pcs.memberships==='function'?pcs.memberships.bind(pcs):null,
    ensure:pcs&&typeof pcs.ensure==='function'?pcs.ensure.bind(pcs):null
  };
  function active(){
    ctx=context()||ctx;
    const sid=String(ctx&&ctx.schoolId||'').trim(), rsid=String(real.schoolId()||sessionStorage.getItem('platform_tab_session_school_id_v1')||sessionStorage.getItem('smart_school_tab_school_v1')||'').trim();
    return !!(ctx&&ctx.readonly===true&&['manager','agent'].includes(canonical(ctx.viewerRole))&&(!sid||!rsid||sid===rsid));
  }
  function view(){return active()?{schoolId:String(ctx.schoolId||real.schoolId()||''),userId:String(ctx.targetUserId||''),role:canonical(ctx.targetRole||''),email:ctx.targetEmail||'',viewerRole:canonical(ctx.viewerRole),readonly:true}:null}
  function decorate(raw){
    if(!active()||!raw)return raw;
    try{
      const u=new URL(raw,location.href); if(u.origin!==location.origin||!/\.html$/i.test(u.pathname))return raw;
      const v=view();
      [['follow','1'],['readonly','1'],['mode','supervisor_readonly'],['viewer',v.viewerRole],['viewerRole',v.viewerRole],['returnRole',v.viewerRole],['targetRole',v.role],['followEmail',v.email],['targetEmail',v.email],['targetUser',v.userId],['followUserId',v.userId],['userId',v.userId],['uid',v.userId],['schoolId',v.schoolId],['blockNewReport','true'],['archiveReadOnly','true']].forEach(([k,val])=>{if(val)u.searchParams.set(k,val)});
      return u.pathname.split('/').pop()+u.search+u.hash;
    }catch(_){return raw}
  }
  window.PlatformFollowReadonly={active,context:()=>view(),decorate,clear:function(){try{sessionStorage.removeItem(KEY);sessionStorage.removeItem(LEGACY);sessionStorage.removeItem('manager_follow_active_v2');sessionStorage.removeItem('smartSchoolUnifiedOpsV2_follow_context')}catch(_){}ctx=null;},returnToViewer:function(){const v=view();this.clear();location.href=(v&&v.viewerRole==='agent'?'agent.html':'manager.html')+'?sectionReturn=1&returnedFromFollow=1';}};

  // Generalize the legacy landing-page bridge so both manager and deputy can follow.
  window.ManagerFollowAccessBridge={
    request:function(){const v=view();return v?{active:true,schoolId:v.schoolId,targetUserId:v.userId,targetEmail:v.email,targetRole:v.role,viewer:v.viewerRole}: {active:false}},
    verify:async function(expectedRoles){
      if(!active())return null;
      if(real.ensure)await real.ensure();
      const rr=canonical(real.role()), expected=(expectedRoles||[]).map(canonical).filter(Boolean), v=view();
      if(!['manager','agent'].includes(rr))throw new Error('FOLLOW_VIEWER_NOT_SUPERVISOR');
      if(!same(real.schoolId(),v.schoolId))throw new Error('FOLLOW_SCHOOL_MISMATCH');
      if(expected.length&&v.role&&!expected.includes(v.role))throw new Error('FOLLOW_TARGET_ROLE_MISMATCH');
      window.__MANAGER_FOLLOW_VERIFIED__={schoolId:v.schoolId,targetUserId:v.userId,targetEmail:v.email,targetRole:v.role,viewerRole:v.viewerRole,readonly:true};
      document.documentElement.setAttribute('data-manager-follow-verified','1');
      return window.__MANAGER_FOLLOW_VERIFIED__;
    },
    returnToManager:function(){window.PlatformFollowReadonly.returnToViewer()}
  };

  // RL157 — presentation identity for the followed shell.
  // The cloud token/session always remains the real supervisor session, but role/userId
  // exposed to page-level UI guards must represent the followed account; otherwise old
  // teacher/advisor guards see `manager` and bounce the browser back to manager.html.
  if(pcs){
    const realVerifyAccess=typeof pcs.verifyAccess==='function'?pcs.verifyAccess.bind(pcs):null;
    const realMemberships=real.memberships;
    pcs.viewerRole=()=>canonical(ctx.viewerRole);
    pcs.monitoringContext=()=>view();
    pcs.isReadOnlyFollow=()=>active();
    pcs.realRole=()=>canonical(real.role());
    pcs.realUserId=()=>String(real.userId()||'');
    pcs.role=()=>{const v=view();return v&&v.role?v.role:real.role()};
    pcs.userId=()=>{const v=view();return v&&v.userId?v.userId:real.userId()};
    pcs.schoolId=()=>{const v=view();return v&&v.schoolId?v.schoolId:real.schoolId()};
    if(realMemberships)pcs.memberships=async function(){
      const payload=await realMemberships();
      if(!active())return payload;
      const v=view(), copy=(payload&&typeof payload==='object')?{...payload}:{};
      const list=Array.isArray(copy.memberships)?copy.memberships.slice():[];
      const exists=list.some(m=>same(m?.schoolId||m?.school_id,v.schoolId)&&same(m?.userId||m?.user_id,v.userId));
      if(!exists)list.push({schoolId:v.schoolId,userId:v.userId,email:v.email,role:v.role,status:'active',readOnlyFollow:true,syntheticView:true});
      copy.memberships=list;
      copy.current={schoolId:v.schoolId,userId:v.userId,email:v.email,role:v.role,status:'active',readOnlyFollow:true,viewerRole:v.viewerRole,syntheticView:true};
      copy.followViewer={schoolId:String(real.schoolId()||''),userId:String(real.userId()||''),role:canonical(real.role())};
      return copy;
    };
    if(realVerifyAccess)pcs.verifyAccess=async function(expectedRoles){
      if(!active())return realVerifyAccess(expectedRoles);
      if(real.ensure)await real.ensure();
      const v=view(), rr=canonical(real.role()), allowed=(expectedRoles||[]).map(canonical).filter(Boolean);
      if(!['manager','agent'].includes(rr))throw Object.assign(new Error('FOLLOW_VIEWER_NOT_SUPERVISOR'),{code:'FOLLOW_VIEWER_NOT_SUPERVISOR'});
      if(!same(real.schoolId(),v.schoolId))throw Object.assign(new Error('FOLLOW_SCHOOL_MISMATCH'),{code:'FOLLOW_SCHOOL_MISMATCH'});
      if(allowed.length&&v.role&&!allowed.includes(v.role))throw Object.assign(new Error('FOLLOW_TARGET_ROLE_MISMATCH'),{code:'FOLLOW_TARGET_ROLE_MISMATCH'});
      return {schoolId:v.schoolId,userId:v.userId,role:v.role,membership:{schoolId:v.schoolId,userId:v.userId,email:v.email,role:v.role,status:'active',readOnlyFollow:true,syntheticView:true},viewerRole:v.viewerRole,readonly:true};
    };
  }

  const mutationWords=/(حفظ|إضافة|انشاء|إنشاء|تعديل|تحرير|حذف|رفع|إرسال|اعتماد|رفض|إرجاع|ارجاع|تنفيذ|إغلاق|اغلاق|تفعيل|تعطيل|استيراد|ربط|مزامنة|تحديث البيانات|save|add|create|edit|update|delete|remove|upload|submit|approve|reject|return|execute|close|activate|disable|import|sync)/i;
  const safeWords=/(بحث|تصفية|فلتر|معاينة|عرض|فتح|تفاصيل|رجوع|عودة|التالي|السابق|طباعة|تصدير|تنزيل|download|print|export|preview|view|open|details|search|filter|back|next|previous)/i;
  function text(el){return String(el?.innerText||el?.textContent||el?.value||el?.getAttribute?.('aria-label')||el?.title||'').trim()}
  function isMutationControl(el){const t=text(el);return !!(mutationWords.test(t)&&!safeWords.test(t));}
  function applyReadonly(root=document){
    if(!active())return;
    const de=document.documentElement;de.dataset.platformReadOnlyFollow='1';de.dataset.supervisorReadonly='true';
    root.querySelectorAll?.('button,[role="button"],a,input[type="submit"],input[type="button"]').forEach(el=>{if(isMutationControl(el)){el.setAttribute('data-follow-write-blocked','1');el.setAttribute('aria-disabled','true');}});
    root.querySelectorAll?.('textarea,[contenteditable="true"],input:not([type="search"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])').forEach(el=>{
      const ph=String(el.getAttribute?.('placeholder')||''); if(/بحث|search|filter|تصفية/i.test(ph))return;
      el.setAttribute('readonly','readonly');el.setAttribute('data-follow-readonly-field','1');
    });
  }
  function addStyle(){if(document.getElementById('platform-follow-readonly-rl155-style'))return;const s=document.createElement('style');s.id='platform-follow-readonly-rl155-style';s.textContent=`
html[data-platform-read-only-follow="1"] [data-follow-write-blocked="1"]{opacity:.45!important;filter:grayscale(.6)!important;cursor:not-allowed!important;pointer-events:none!important}
html[data-platform-read-only-follow="1"] [data-follow-readonly-field="1"]{background:#f8fafc!important;cursor:default!important}
#platform-follow-readonly-rl155-banner{position:fixed;z-index:2147483646;top:10px;right:50%;transform:translateX(50%);background:#0f766e;color:#fff;border:1px solid rgba(255,255,255,.25);box-shadow:0 8px 24px rgba(15,23,42,.18);border-radius:999px;padding:8px 14px;font:800 12px Tajawal,Arial;display:flex;gap:10px;align-items:center;max-width:calc(100vw - 24px)}
#platform-follow-readonly-rl155-banner button{border:0;background:#fff;color:#0f766e;border-radius:999px;padding:5px 10px;font:800 11px Tajawal,Arial;cursor:pointer}
`; (document.head||document.documentElement).appendChild(s)}
  function addBanner(){if(document.getElementById('platform-follow-readonly-rl155-banner')||!document.body)return;const v=view(),b=document.createElement('div');b.id='platform-follow-readonly-rl155-banner';b.innerHTML='<span>وضع المتابعة — قراءة فقط'+(v?.email?' — '+v.email:'')+'</span><button type="button">إنهاء المتابعة</button>';b.querySelector('button').onclick=()=>window.PlatformFollowReadonly.returnToViewer();document.body.appendChild(b)}
  function internalUrlFromEvent(ev){
    let el=ev.target; while(el&&el!==document){
      if(el.getAttribute){const href=el.getAttribute('href');if(href&&/\.html(?:[?#]|$)/i.test(href))return {el,url:href};const oc=el.getAttribute('onclick')||'';const m=oc.match(/(?:location(?:\.href)?\s*=|location\.assign\(|location\.replace\(|window\.location\.href\s*=)\s*[('\"]+([^'\")]+\.html(?:\?[^'\")]+)?)/i);if(m)return {el,url:m[1]};}
      el=el.parentElement;
    } return null;
  }
  document.addEventListener('click',function(ev){
    if(!active())return;
    const hit=internalUrlFromEvent(ev); if(hit){const next=decorate(hit.url);if(next!==hit.url){ev.preventDefault();ev.stopImmediatePropagation();location.href=next;return;}}
    let el=ev.target;while(el&&el!==document){if(el.getAttribute&&el.getAttribute('data-follow-write-blocked')==='1'){ev.preventDefault();ev.stopImmediatePropagation();return}el=el.parentElement}
  },true);
  document.addEventListener('submit',function(ev){if(!active())return;const f=ev.target;const ft=String(f?.innerText||f?.textContent||'')+' '+Array.from(f?.querySelectorAll?.('input')||[]).map(x=>x.placeholder||'').join(' ');if(/بحث|search|filter|تصفية/i.test(ft)&&!mutationWords.test(ft))return;ev.preventDefault();ev.stopImmediatePropagation();},true);
  document.addEventListener('beforeinput',function(ev){if(!active())return;const el=ev.target;if(el&&el.getAttribute&&el.getAttribute('data-follow-readonly-field')==='1'){ev.preventDefault();}},true);

  // Network guard: reject explicit mutations while following. Read-only POSTs remain allowed.
  const rawFetch=window.fetch?.bind(window);
  if(rawFetch)window.fetch=async function(input,init={}){
    if(active()){
      const method=String(init?.method||'GET').toUpperCase();
      let body='';try{body=typeof init?.body==='string'?init.body:''}catch(_){}
      const hard=['PUT','PATCH','DELETE'].includes(method);
      const bodyMutation=method==='POST'&&/(\"action\"\s*:\s*\"(?:set|save|create|insert|upsert|update|delete|remove|upload|submit|approve|reject|return|close|activate|disable|bulk-upsert|bulk_upsert)\"|\"deleted\"\s*:\s*true)/i.test(body);
      if(hard||bodyMutation){const e=new Error('FOLLOW_READONLY_WRITE_BLOCKED');e.code='FOLLOW_READONLY_WRITE_BLOCKED';throw e;}
      const h=new Headers(init.headers||{});h.set('x-platform-follow-mode','readonly');h.set('x-platform-follow-viewer',canonical(ctx.viewerRole));init={...init,headers:h};
    }
    return rawFetch(input,init);
  };

  function boot(){if(!active())return;addStyle();applyReadonly(document);addBanner();const mo=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes||[])if(n.nodeType===1)applyReadonly(n)});mo.observe(document.documentElement,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* iOS/WebKit compatibility layer — presentation only; no auth/storage semantics changed. */
(function(){
  'use strict';
  if(window.__PLATFORM_IOS_COMPAT__) return; window.__PLATFORM_IOS_COMPAT__=1;
  var d=document, de=d.documentElement;
  var touchWebKit=('WebkitAppearance' in de.style) && (navigator.maxTouchPoints||0)>0;
  if(!touchWebKit) return;
  de.classList.add('platform-webkit-touch');
  function viewport(){
    var vv=window.visualViewport;
    var h=Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
    var w=Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
    de.style.setProperty('--platform-visual-height',h+'px');
    de.style.setProperty('--platform-visual-width',w+'px');
    de.style.setProperty('--platform-vv-top',Math.max(0,Math.round(vv?vv.offsetTop:0))+'px');
  }
  viewport();
  window.addEventListener('resize',viewport,{passive:true});
  window.addEventListener('orientationchange',function(){setTimeout(viewport,80);setTimeout(viewport,350)},{passive:true});
  if(window.visualViewport){visualViewport.addEventListener('resize',viewport,{passive:true});visualViewport.addEventListener('scroll',viewport,{passive:true});}
  var s=d.createElement('style'); s.id='platform-ios-webkit-compat';
  s.textContent=`
    html.platform-webkit-touch{height:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%;}
    html.platform-webkit-touch body{min-height:100%;min-height:var(--platform-visual-height,100dvh);padding-left:env(safe-area-inset-left,0);padding-right:env(safe-area-inset-right,0);}
    html.platform-webkit-touch img,html.platform-webkit-touch video,html.platform-webkit-touch canvas,html.platform-webkit-touch svg{max-width:100%;}
    html.platform-webkit-touch iframe{max-width:100%;}
    html.platform-webkit-touch input,html.platform-webkit-touch select,html.platform-webkit-touch textarea{font-size:max(16px,1em);}
    html.platform-webkit-touch button,html.platform-webkit-touch a,html.platform-webkit-touch [role="button"]{touch-action:manipulation;-webkit-tap-highlight-color:rgba(0,0,0,.06);}
    html.platform-webkit-touch .modal,html.platform-webkit-touch [role="dialog"],html.platform-webkit-touch dialog{max-height:calc(var(--platform-visual-height,100dvh) - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));}
    html.platform-webkit-touch table{max-width:100%;}
    @supports (height:100dvh){html.platform-webkit-touch .uw-fullscreen-internal{height:100dvh!important;min-height:100dvh!important;}}
    @media (max-width:820px){html.platform-webkit-touch .table-responsive,html.platform-webkit-touch .responsive-table,html.platform-webkit-touch .table-wrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch;}}
  `;
  (d.head||de).appendChild(s);
})();
