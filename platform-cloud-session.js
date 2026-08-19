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
    return sessionStorage.getItem(TAB_TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }

  function expiresAt() {
    return sessionStorage.getItem(TAB_EXPIRES_KEY) || localStorage.getItem(EXPIRES_KEY) || '';
  }

  function userId() {
    return sessionStorage.getItem(TAB_USER_KEY) || localStorage.getItem(USER_KEY) || '';
  }

  function schoolId() {
    return sessionStorage.getItem(TAB_SCHOOL_KEY) || localStorage.getItem(SCHOOL_KEY) || '';
  }

  function role() {
    return sessionStorage.getItem(TAB_ROLE_KEY) || localStorage.getItem(ROLE_KEY) || '';
  }

  function valid() {
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
    window.dispatchEvent(new CustomEvent('platform-cloud-session-ready',{detail:{userId:payload.userId||'',schoolId:payload.schoolId||'',role:payload.role||'',expiresAt:payload.expiresAt||'',renewed:Boolean(renewed)}}));
    return payload.token;
  }

  let recoveryPromise = null;
  async function recover() {
    if (recoveryPromise) return recoveryPromise;
    recoveryPromise = (async () => {
      const oldToken = token();
      const sid = currentSchoolId();
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
    if (valid()) return token();
    return recover();
  }

  function clear() {
    const tabToken=sessionStorage.getItem(TAB_TOKEN_KEY)||'';const sharedToken=localStorage.getItem(TOKEN_KEY)||'';
    [TAB_TOKEN_KEY,TAB_EXPIRES_KEY,TAB_USER_KEY,TAB_SCHOOL_KEY,TAB_ROLE_KEY].forEach(k=>sessionStorage.removeItem(k));
    if(!tabToken||sharedToken===tabToken){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(EXPIRES_KEY);localStorage.removeItem(USER_KEY);localStorage.removeItem(SCHOOL_KEY);localStorage.removeItem(ROLE_KEY);}
  }

  window.PlatformCloudSession = {
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
    clear,
  };
})();
