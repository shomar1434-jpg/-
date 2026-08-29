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

  // Session continuity bridge: preserve the authenticated school session while
  // navigating between independent-school pages.  Only a token whose stored
  // school matches the active school is restored; cross-school restoration is
  // deliberately rejected.
  function parseJson(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  function directActiveSchoolId() {
    return String(
      sessionStorage.getItem(TAB_SCHOOL_KEY) ||
      sessionStorage.getItem('smart_school_tab_school_v1') ||
      localStorage.getItem('active_school_id') ||
      localStorage.getItem('current_school_id') ||
      localStorage.getItem('school_id') ||
      localStorage.getItem('smart_school_id') || ''
    ).trim();
  }

  function directActiveUserId() {
    try {
      const current = parseJson(localStorage.getItem('currentUser')) || parseJson(localStorage.getItem('currentSchoolUser')) || {};
      return String(
        sessionStorage.getItem(TAB_USER_KEY) ||
        localStorage.getItem('currentUserId') ||
        current.id || current.user_id || ''
      ).trim();
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
    return [
      parseJson(sessionStorage.getItem('smart_school_current_session')),
      parseJson(localStorage.getItem('smart_school_current_session')),
      parseJson(sessionStorage.getItem('administrative_employee_tab_session_v1')),
    ].filter(Boolean);
  }

  function contextToken(ctx) {
    return String(ctx?.cloudToken || ctx?.token || ctx?.platformToken || '').trim();
  }

  function restoreFromKnownContext() {
    if (isSystemAdminContext()) return '';
    const activeSchool = directActiveSchoolId();
    const activeUser = directActiveUserId();
    const existing = String(sessionStorage.getItem(TAB_TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '').trim();
    if (existing) return existing;

    for (const ctx of sessionContexts()) {
      const candidate = contextToken(ctx);
      if (!candidate) continue;
      const ctxSchool = String(ctx.cloudSchoolId || ctx.schoolId || ctx.school_id || '').trim();
      if (activeSchool && ctxSchool && activeSchool !== ctxSchool) continue;
      const sid = ctxSchool || activeSchool;
      if (!sid) continue;
      const uid = String(ctx.cloudUserId || ctx.userId || ctx.id || '').trim();
      if (activeUser && uid && activeUser !== uid) continue;
      const rr = String(ctx.cloudRole || ctx.role || localStorage.getItem('currentRole') || '').trim();
      const exp = String(ctx.cloudExpiresAt || ctx.expiresAt || '').trim();

      sessionStorage.setItem(TAB_TOKEN_KEY, candidate);
      sessionStorage.setItem(TAB_EXPIRES_KEY, exp);
      sessionStorage.setItem(TAB_USER_KEY, uid);
      sessionStorage.setItem(TAB_SCHOOL_KEY, sid);
      sessionStorage.setItem(TAB_ROLE_KEY, rr);
      localStorage.setItem(TOKEN_KEY, candidate);
      localStorage.setItem(EXPIRES_KEY, exp);
      localStorage.setItem(USER_KEY, uid);
      localStorage.setItem(SCHOOL_KEY, sid);
      localStorage.setItem(ROLE_KEY, rr);
      return candidate;
    }
    return '';
  }

  function updateKnownContext(payload) {
    try {
      const raw = parseJson(localStorage.getItem('smart_school_current_session')) || {};
      const sid = String(payload?.schoolId || directActiveSchoolId() || '').trim();
      const rawSid = String(raw.schoolId || raw.school_id || '').trim();
      // Never stamp a session token into a context belonging to another school.
      if (rawSid && sid && rawSid !== sid) return;
      const next = {
        ...raw,
        cloudToken: String(payload?.token || ''),
        cloudExpiresAt: String(payload?.expiresAt || ''),
        cloudUserId: String(payload?.userId || raw.userId || raw.id || ''),
        cloudSchoolId: sid,
        cloudRole: String(payload?.role || raw.role || ''),
      };
      localStorage.setItem('smart_school_current_session', JSON.stringify(next));
    } catch (_) {}
  }

  const url = () =>
    (localStorage.getItem('smartSchoolSupabaseUrl') ||
      'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/, '');

  const key = () =>
    localStorage.getItem('smartSchoolSupabaseAnonKey') ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM';

  async function open(login, password, schoolId) {
    const response = await fetch(`${url()}/functions/v1/platform-session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: key(),
      },
      body: JSON.stringify({ login, password, schoolId }),
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
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(EXPIRES_KEY, payload.expiresAt || '');
    localStorage.setItem(USER_KEY, payload.userId || '');
    localStorage.setItem(SCHOOL_KEY, payload.schoolId || '');
    localStorage.setItem(ROLE_KEY, payload.role || '');
    window.dispatchEvent(new CustomEvent('platform-cloud-session-ready',{detail:{userId:payload.userId||'',schoolId:payload.schoolId||'',role:payload.role||'',expiresAt:payload.expiresAt||'',membershipId:payload.membershipId||''}}));
    return payload;
  }

  function token() {
    if (isSystemAdminContext()) return '';
    return sessionStorage.getItem(TAB_TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }

  function expiresAt() {
    return sessionStorage.getItem(TAB_EXPIRES_KEY) || localStorage.getItem(EXPIRES_KEY) || '';
  }

  function userId() {
    if (isSystemAdminContext()) return '';
    return sessionStorage.getItem(TAB_USER_KEY) || localStorage.getItem(USER_KEY) || '';
  }

  function schoolId() {
    if (isSystemAdminContext()) return '';
    return sessionStorage.getItem(TAB_SCHOOL_KEY) || localStorage.getItem(SCHOOL_KEY) || '';
  }

  function role() {
    if (isSystemAdminContext()) return 'system_admin';
    return sessionStorage.getItem(TAB_ROLE_KEY) || localStorage.getItem(ROLE_KEY) || '';
  }

  function valid() {
    if (isSystemAdminContext()) return false;
    const currentToken = token();
    const expiry = expiresAt();
    const activeSchool = sessionStorage.getItem(TAB_SCHOOL_KEY) || localStorage.getItem('active_school_id') || localStorage.getItem('current_school_id') || localStorage.getItem('school_id') || localStorage.getItem('smart_school_id') || '';
    const sameSchool = !activeSchool || !schoolId() || String(activeSchool) === String(schoolId());
    return Boolean(currentToken && sameSchool && (!expiry || Date.parse(expiry) > Date.now() + 60_000));
  }

  function currentSchoolId() {
    return sessionStorage.getItem(TAB_SCHOOL_KEY) ||
      localStorage.getItem('active_school_id') ||
      localStorage.getItem('current_school_id') ||
      localStorage.getItem('school_id') ||
      localStorage.getItem('smart_school_id') ||
      schoolId() || '';
  }

  function applyPayload(payload, renewed = true) {
    if (!payload || !payload.token) throw new Error('استجابة تجديد الجلسة لا تحتوي على رمز صالح');
    const sid=payload.schoolId || currentSchoolId() || '';const rr=payload.role || role() || localStorage.getItem('currentRole') || '';
    sessionStorage.setItem(TAB_TOKEN_KEY,payload.token);sessionStorage.setItem(TAB_EXPIRES_KEY,payload.expiresAt||'');sessionStorage.setItem(TAB_USER_KEY,payload.userId||'');sessionStorage.setItem(TAB_SCHOOL_KEY,sid);sessionStorage.setItem(TAB_ROLE_KEY,rr);
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(EXPIRES_KEY, payload.expiresAt || '');
    localStorage.setItem(USER_KEY, payload.userId || '');
    localStorage.setItem(SCHOOL_KEY, sid);
    localStorage.setItem(ROLE_KEY, rr);
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

  function clear() {
    const tabToken=sessionStorage.getItem(TAB_TOKEN_KEY)||'';const sharedToken=localStorage.getItem(TOKEN_KEY)||'';
    [TAB_TOKEN_KEY,TAB_EXPIRES_KEY,TAB_USER_KEY,TAB_SCHOOL_KEY,TAB_ROLE_KEY].forEach(k=>sessionStorage.removeItem(k));
    if(!tabToken||sharedToken===tabToken){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(EXPIRES_KEY);localStorage.removeItem(USER_KEY);localStorage.removeItem(SCHOOL_KEY);localStorage.removeItem(ROLE_KEY);}
    // Prevent a deliberately cleared/logout session from being silently restored.
    try {
      const raw=parseJson(localStorage.getItem('smart_school_current_session'));
      if(raw){delete raw.cloudToken;delete raw.cloudExpiresAt;delete raw.cloudUserId;delete raw.cloudSchoolId;delete raw.cloudRole;localStorage.setItem('smart_school_current_session',JSON.stringify(raw));}
      const admin=parseJson(sessionStorage.getItem('administrative_employee_tab_session_v1'));
      if(admin){delete admin.token;delete admin.expiresAt;sessionStorage.setItem('administrative_employee_tab_session_v1',JSON.stringify(admin));}
    } catch (_) {}
  }

  const SESSION_VERSION='2026.08.29-system-admin-school-isolation-v3';

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
    clear,
  };

  // Same-tab navigation normally keeps sessionStorage, but restoring here also
  // covers pages opened after a browser/sessionStorage transition.
  restoreFromKnownContext();
})();
