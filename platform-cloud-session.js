(function(){
  'use strict';

  const TOKEN_KEY = 'platform_file_session_token';
  const EXPIRES_KEY = 'platform_file_session_expires_at';
  const USER_KEY = 'platform_file_session_user_id';
  const SCHOOL_KEY = 'platform_file_session_school_id';
  const ROLE_KEY = 'platform_file_session_role';

  const url = () =>
    (localStorage.getItem('smartSchoolSupabaseUrl') ||
      'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/, '');

  const key = () =>
    localStorage.getItem('smartSchoolSupabaseAnonKey') ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM';

  async function open(login, password, schoolId) {
    clear();

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

    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(EXPIRES_KEY, payload.expiresAt || '');
    localStorage.setItem(USER_KEY, payload.userId || '');
    localStorage.setItem(SCHOOL_KEY, payload.schoolId || '');
    localStorage.setItem(ROLE_KEY, payload.role || '');

    window.dispatchEvent(
      new CustomEvent('platform-cloud-session-ready', {
        detail: {
          userId: payload.userId || '',
          schoolId: payload.schoolId || '',
          role: payload.role || '',
          expiresAt: payload.expiresAt || '',
        },
      }),
    );

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
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(EXPIRES_KEY, payload.expiresAt || '');
    localStorage.setItem(USER_KEY, payload.userId || '');
    localStorage.setItem(SCHOOL_KEY, payload.schoolId || '');
    localStorage.setItem(ROLE_KEY, payload.role || '');
    window.dispatchEvent(new CustomEvent('platform-cloud-session-ready',{detail:{userId:payload.userId||'',schoolId:payload.schoolId||'',role:payload.role||'',expiresAt:payload.expiresAt||'',membershipId:payload.membershipId||''}}));
    return payload;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function expiresAt() {
    return localStorage.getItem(EXPIRES_KEY) || '';
  }

  function userId() {
    return localStorage.getItem(USER_KEY) || '';
  }

  function schoolId() {
    return localStorage.getItem(SCHOOL_KEY) || '';
  }

  function role() {
    return localStorage.getItem(ROLE_KEY) || '';
  }

  function valid() {
    const currentToken = token();
    const expiry = expiresAt();
    return Boolean(
      currentToken &&
        (!expiry || Date.parse(expiry) > Date.now() + 60_000),
    );
  }

  async function ensure() {
    if (valid()) return token();
    clear();
    throw new Error(
      'انتهت جلسة الملفات السحابية. سجّل الخروج ثم ادخل مجددًا لتجديدها.',
    );
  }

  function clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SCHOOL_KEY);
    localStorage.removeItem(ROLE_KEY);
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
    clear,
  };
})();
