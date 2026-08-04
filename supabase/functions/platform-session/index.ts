import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

const sha256 = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');

const text = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => text(value).toLowerCase();
const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text(value),
  );

const activeStatus = (value: unknown) => {
  const status = lower(value || 'active');
  return ![
    'inactive',
    'disabled',
    'suspended',
    'blocked',
    'deleted',
    'archived',
    'غير فعال',
    'معطل',
    'موقوف',
    'محذوف',
  ].includes(status);
};

const passwordMatches = (row: Record<string, unknown>, password: string) => {
  const fields = [
    'password',
    'pass',
    'manager_password',
    'school_password',
    'login_password',
    'temp_password',
    'default_password',
    'pin',
    'code',
    'access_code',
    'secret',
  ];
  const candidates = fields.map((field) => text(row?.[field])).filter(Boolean);
  return candidates.length > 0 && candidates.includes(password);
};

const loginMatches = (row: Record<string, unknown>, login: string) => {
  const wanted = lower(login);
  const fields = [
    'email',
    'user_email',
    'manager_email',
    'principal_email',
    'admin_email',
    'owner_email',
    'login_email',
    'username',
    'userName',
    'loginName',
    'full_name',
    'name',
    'national_id',
    'nationalId',
    'id',
  ];
  return fields.some((field) => lower(row?.[field]) === wanted);
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'طريقة الطلب غير مدعومة' }, 405);
  }

  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[platform-session]', requestId, 'missing_environment');
      return json(
        {
          error: 'إعدادات وظيفة الجلسة غير مكتملة',
          code: 'SESSION_ENV_MISSING',
          requestId,
        },
        500,
      );
    }

    const payload = await request.json().catch(() => ({}));
    const login = text(payload?.login);
    const password = text(payload?.password);
    const schoolRef = text(payload?.schoolId);

    if (!login || !password || !schoolRef) {
      return json(
        {
          error: 'بيانات الجلسة غير مكتملة',
          code: 'SESSION_INPUT_INCOMPLETE',
          requestId,
        },
        400,
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let school: Record<string, any> | null = null;
    if (isUuid(schoolRef)) {
      const result = await admin
        .from('schools')
        .select('*')
        .eq('id', schoolRef)
        .limit(1)
        .maybeSingle();
      if (!result.error) school = result.data;
      else console.warn('[platform-session]', requestId, 'school_uuid_lookup', result.error);
    } else {
      const schoolsResult = await admin.from('schools').select('*').limit(1000);
      if (schoolsResult.error) {
        console.error('[platform-session]', requestId, 'schools_query', schoolsResult.error);
        return json(
          {
            error: 'تعذر قراءة بيانات المدرسة',
            details: schoolsResult.error.message,
            code: 'SCHOOLS_QUERY_FAILED',
            requestId,
          },
          500,
        );
      }
      const wanted = lower(schoolRef);
      school =
        (schoolsResult.data || []).find((row: Record<string, unknown>) =>
          [
            row.id,
            row.school_id,
            row.school_code,
            row.registration_code,
            row.code,
            row.login_code,
          ].some((value) => lower(value) === wanted),
        ) || null;
    }

    if (!school || !isUuid(school.id) || !activeStatus(school.status)) {
      return json(
        {
          error: 'المدرسة غير موجودة أو غير فعالة',
          code: 'SCHOOL_NOT_FOUND',
          requestId,
        },
        404,
      );
    }

    let authUser: any = null;
    const normalizedLogin = lower(login);
    if (anonKey && normalizedLogin.includes('@')) {
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const authResult = await authClient.auth.signInWithPassword({
        email: normalizedLogin,
        password,
      });
      if (!authResult.error && authResult.data?.user) authUser = authResult.data.user;
    }

    const usersResult = await admin
      .from('users')
      .select('*')
      .eq('school_id', school.id)
      .limit(1000);

    if (usersResult.error) {
      console.error('[platform-session]', requestId, 'users_query', usersResult.error);
      return json(
        {
          error: 'تعذر قراءة بيانات المستخدم',
          details: usersResult.error.message,
          code: 'USERS_QUERY_FAILED',
          requestId,
        },
        500,
      );
    }

    const candidates = (usersResult.data || []).filter(
      (row: Record<string, unknown>) => activeStatus(row.status) && loginMatches(row, login),
    );

    let user =
      candidates.find((candidate: Record<string, unknown>) => {
        if (authUser) {
          return (
            text(candidate.id) === text(authUser.id) ||
            lower(candidate.email) === normalizedLogin
          );
        }
        return passwordMatches(candidate, password);
      }) || null;

    if (!user) {
      console.warn('[platform-session]', requestId, 'user_not_resolved', {
        login: normalizedLogin,
        schoolId: school.id,
        authValidated: Boolean(authUser),
        candidateCount: candidates.length,
      });
      return json(
        {
          error: 'بيانات الدخول غير صحيحة أو الحساب غير مرتبط بهذه المدرسة',
          code: 'USER_NOT_RESOLVED',
          requestId,
        },
        401,
      );
    }

    if (!isUuid(user.id)) {
      return json(
        {
          error: 'معرّف المستخدم غير صالح لإنشاء جلسة الملفات',
          code: 'INVALID_PUBLIC_USER_ID',
          requestId,
        },
        409,
      );
    }

    const membership = await admin
      .from('school_members')
      .select('*')
      .eq('school_id', school.id)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership.error && membership.data && !activeStatus(membership.data.status)) {
      return json(
        {
          error: 'عضوية المستخدم في المدرسة غير فعالة',
          code: 'MEMBERSHIP_INACTIVE',
          requestId,
        },
        403,
      );
    }
    if (membership.error) {
      console.warn('[platform-session]', requestId, 'membership_lookup_warning', membership.error);
    }

    const role = text(user.role || membership.data?.role || 'member');
    const rawToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const tokenHash = await sha256(rawToken);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    await admin
      .from('platform_sessions')
      .update({ status: 'revoked', revoked_at: now })
      .eq('school_id', school.id)
      .eq('user_id', user.id)
      .eq('status', 'active');

    const sessionInsert = await admin
      .from('platform_sessions')
      .insert({
        session_token_hash: tokenHash,
        user_id: user.id,
        school_id: school.id,
        role,
        status: 'active',
        expires_at: expiresAt,
        last_seen_at: now,
      })
      .select('id,created_at,expires_at')
      .single();

    if (sessionInsert.error) {
      console.error('[platform-session]', requestId, 'session_insert_failed', sessionInsert.error);
      return json(
        {
          error: 'تعذر إنشاء جلسة الملفات السحابية',
          details: sessionInsert.error.message,
          code: 'SESSION_INSERT_FAILED',
          requestId,
        },
        500,
      );
    }

    console.log('[platform-session]', requestId, 'session_created', {
      sessionId: sessionInsert.data.id,
      schoolId: school.id,
      userId: user.id,
      role,
    });

    return json({
      token: rawToken,
      expiresAt,
      userId: user.id,
      schoolId: school.id,
      role,
      requestId,
    });
  } catch (error) {
    console.error('[platform-session]', requestId, 'fatal', error);
    return json(
      {
        error: error instanceof Error ? error.message : String(error),
        code: 'SESSION_FATAL_ERROR',
        requestId,
      },
      500,
    );
  }
});
