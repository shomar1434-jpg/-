(function(){
  'use strict';

  const TOKEN_KEY = 'platform_file_session_token';
  const EXPIRES_KEY = 'platform_file_session_expires_at';
  const USER_KEY = 'platform_file_session_user_id';
  const SCHOOL_KEY = 'platform_file_session_school_id';
  const ROLE_KEY = 'platform_file_session_role';
  const AUTH_ACCESS_KEY = 'platform_auth_access_token';
  const AUTH_REFRESH_KEY = 'platform_auth_refresh_token';
  const AUTH_EXPIRES_KEY = 'platform_auth_expires_at';

  let openInFlight = null;
  let openInFlightKey = '';
  let recoverInFlight = null;

  const url = () =>
    (localStorage.getItem('smartSchoolSupabaseUrl') ||
      'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/, '');

  const key = () =>
    localStorage.getItem('smartSchoolSupabaseAnonKey') ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM';

  async function openInternal(login, password, schoolId) {
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
    if (payload.authAccessToken) localStorage.setItem(AUTH_ACCESS_KEY, payload.authAccessToken);
    if (payload.authRefreshToken) localStorage.setItem(AUTH_REFRESH_KEY, payload.authRefreshToken);
    if (payload.authExpiresAt) localStorage.setItem(AUTH_EXPIRES_KEY, payload.authExpiresAt);

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

  async function open(login, password, schoolId) {
    const flightKey = `${String(login||'').trim().toLowerCase()}|${String(schoolId||'').trim()}`;
    if (openInFlight && openInFlightKey === flightKey) return openInFlight;
    openInFlightKey = flightKey;
    openInFlight = openInternal(login, password, schoolId);
    try {
      return await openInFlight;
    } finally {
      openInFlight = null;
      openInFlightKey = '';
    }
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

  function currentSchoolId() {
    return schoolId() ||
      localStorage.getItem('active_school_id') ||
      localStorage.getItem('current_school_id') ||
      localStorage.getItem('school_id') ||
      localStorage.getItem('smart_school_id') || '';
  }


  async function authAccessToken() {
    // 1) Use the auth session captured during school login.
    try {
      const access = localStorage.getItem(AUTH_ACCESS_KEY) || '';
      const refresh = localStorage.getItem(AUTH_REFRESH_KEY) || '';
      const expiry = localStorage.getItem(AUTH_EXPIRES_KEY) || '';
      const stillValid = access && (!expiry || Date.parse(expiry) > Date.now() + 60_000);
      if (stillValid) return access;

      // Refresh Supabase Auth without ever storing or reusing the password.
      if (refresh) {
        const r = await fetch(`${url()}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {'content-type':'application/json', apikey:key()},
          body: JSON.stringify({refresh_token: refresh}),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.access_token) {
          localStorage.setItem(AUTH_ACCESS_KEY, String(j.access_token));
          if (j.refresh_token) localStorage.setItem(AUTH_REFRESH_KEY, String(j.refresh_token));
          const expiresIn = Number(j.expires_in || 3600);
          localStorage.setItem(AUTH_EXPIRES_KEY, new Date(Date.now() + Math.max(60, expiresIn) * 1000).toISOString());
          return String(j.access_token);
        }
      }
    } catch (_) {}

    // 2) Compatibility with pages that already load a Supabase client.
    try {
      const sb = window.SmartSchoolSupabase?.getClient?.();
      if (sb?.auth?.getSession) {
        const authState = await sb.auth.getSession();
        const session = authState?.data?.session || null;
        const t = session?.access_token || '';
        if (t) {
          localStorage.setItem(AUTH_ACCESS_KEY, t);
          if (session.refresh_token) localStorage.setItem(AUTH_REFRESH_KEY, session.refresh_token);
          if (session.expires_at) localStorage.setItem(AUTH_EXPIRES_KEY, new Date(Number(session.expires_at) * 1000).toISOString());
          return t;
        }
      }
    } catch (_) {}

    // 3) Compatibility with the standard Supabase localStorage key.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (!/^sb-[a-z0-9]+-auth-token$/i.test(k)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        const session = obj?.currentSession || obj?.session || obj;
        const t = session?.access_token || (Array.isArray(obj) ? obj?.[0]?.access_token : '');
        if (t) {
          localStorage.setItem(AUTH_ACCESS_KEY, String(t));
          if (session?.refresh_token) localStorage.setItem(AUTH_REFRESH_KEY, String(session.refresh_token));
          if (session?.expires_at) localStorage.setItem(AUTH_EXPIRES_KEY, new Date(Number(session.expires_at) * 1000).toISOString());
          return String(t);
        }
      }
    } catch (_) {}
    return '';
  }

  function applyPayload(payload) {
    if (!payload || !payload.token) throw new Error('استجابة تجديد الجلسة لا تحتوي على رمز صالح');
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(EXPIRES_KEY, payload.expiresAt || '');
    localStorage.setItem(USER_KEY, payload.userId || '');
    localStorage.setItem(SCHOOL_KEY, payload.schoolId || currentSchoolId() || '');
    localStorage.setItem(ROLE_KEY, payload.role || role() || localStorage.getItem('currentRole') || '');
    if (payload.authAccessToken) localStorage.setItem(AUTH_ACCESS_KEY, payload.authAccessToken);
    if (payload.authRefreshToken) localStorage.setItem(AUTH_REFRESH_KEY, payload.authRefreshToken);
    if (payload.authExpiresAt) localStorage.setItem(AUTH_EXPIRES_KEY, payload.authExpiresAt);
    window.dispatchEvent(new CustomEvent('platform-cloud-session-ready',{detail:{userId:payload.userId||'',schoolId:payload.schoolId||'',role:payload.role||'',expiresAt:payload.expiresAt||'',renewed:true}}));
    return payload.token;
  }

  async function recoverInternal() {
    const oldToken = token();
    const sid = currentSchoolId();
    // المسار الأول: تدوير رمز الجلسة السابق حتى لو انتهت صلاحيته مؤخرًا.
    if (oldToken) {
      try {
        const response = await fetch(`${url()}/functions/v1/platform-session`, {
          method: 'POST',
          headers: {'content-type':'application/json',apikey:key(),'x-platform-session':oldToken},
          body: JSON.stringify({action:'renew',schoolId:sid}),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.token) return applyPayload(payload);
        console.warn('[platform-session] renew failed', payload.code || response.status, payload.requestId || '');
      } catch (err) { console.warn('[platform-session] renew error', err); }
    }

    // المسار الثاني: استعادة الجلسة من Supabase Auth الحالي دون حفظ كلمة المرور في المتصفح.
    // هذا المسار يعالج الرموز القديمة/الملغاة التي لا يمكن تدويرها، مع التحقق الخادمي من هوية المستخدم وعضويته.
    if (sid) {
      try {
        const accessToken = await authAccessToken();
        if (accessToken) {
          const response = await fetch(`${url()}/functions/v1/platform-session`, {
            method: 'POST',
            headers: {
              'content-type':'application/json',
              apikey:key(),
              authorization:`Bearer ${accessToken}`
            },
            body: JSON.stringify({action:'auth-recover',schoolId:sid}),
          });
          const payload = await response.json().catch(() => ({}));
          if (response.ok && payload.token) return applyPayload(payload);
          console.warn('[platform-session] auth-recover failed', payload.code || response.status, payload.requestId || '');
        }
      } catch (err) { console.warn('[platform-session] auth-recover error', err); }
    }

    // لا نعيد تسجيل الدخول بكلمة مرور محفوظة محليًا.
    // بعد فشل renew و auth-recover يجب أن يبقى الفشل صريحًا وآمنًا بدل استخدام بيانات قديمة.
    throw new Error('تعذر استعادة الجلسة السحابية تلقائيًا. أعد فتح المدرسة من صفحة الدخول إذا استمرت المشكلة.');
  }

  async function recover() {
    if (recoverInFlight) return recoverInFlight;
    recoverInFlight = recoverInternal();
    try {
      return await recoverInFlight;
    } finally {
      recoverInFlight = null;
    }
  }

  async function ensure() {
    if (valid()) return token();
    return recover();
  }

  function clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SCHOOL_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(AUTH_ACCESS_KEY);
    localStorage.removeItem(AUTH_REFRESH_KEY);
    localStorage.removeItem(AUTH_EXPIRES_KEY);
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
