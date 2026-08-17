import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-platform-session',
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


const activeSession = async (admin: any, rawToken: string) => {
  if (!rawToken) return null;
  const hash = await sha256(rawToken);
  const q = await admin.from('platform_sessions').select('*').eq('session_token_hash', hash).eq('status','active').limit(1).maybeSingle();
  if (q.error || !q.data) return null;
  if (q.data.expires_at && Date.parse(q.data.expires_at) <= Date.now()) return null;
  return q.data;
};

const membershipsForIdentity = async (admin: any, session: any) => {
  const uq = await admin.from('users').select('*').eq('id', session.user_id).limit(1).maybeSingle();
  const identity = uq.data || {};
  const email = lower(identity.email || identity.microsoft_email || '');
  const rows: any[] = [];
  const add = (a:any[]) => (a||[]).forEach(x=>{ if(x && activeStatus(x.status)) rows.push(x); });
  try { const q=await admin.from('school_members').select('*').eq('user_id',session.user_id); if(!q.error)add(q.data); } catch(_){}
  if(email){
    try { const q=await admin.from('school_members').select('*').eq('email',email); if(!q.error)add(q.data); } catch(_){}
    try { const q=await admin.from('school_members').select('*').eq('microsoft_email',email); if(!q.error)add(q.data); } catch(_){}
  }
  const byKey = new Map<string,any>(); rows.forEach(r=>byKey.set(`${r.school_id}|${lower(r.role)}`,r));
  if(email){
    try { const q=await admin.from('users').select('*').eq('email',email).limit(1000); if(!q.error)(q.data||[]).forEach((u:any)=>{if(activeStatus(u.status)){const k=`${u.school_id}|${lower(u.role)}`;if(!byKey.has(k))byKey.set(k,{id:`user:${u.id}`,school_id:u.school_id,user_id:u.id,email,role:u.role,status:u.status,__userRow:u});}}); } catch(_){}
  }
  // توافق المجمعات التعليمية: المدارس التي يحمل سجلها نفس بريد المدير تعد عضويات مدير،
  // حتى لو كانت مدرسة قديمة أُنشئت قبل تفعيل school_members.
  if(email){
    const managerCols=['manager_email'];
    for(const col of managerCols){
      try{
        const q=await admin.from('schools').select('*').eq(col,email).limit(1000);
        if(!q.error)(q.data||[]).forEach((school:any)=>{
          if(!school?.id||!activeStatus(school.status))return;
          const k=`${school.id}|manager`;
          if(!byKey.has(k))byKey.set(k,{id:`manager:${school.id}`,school_id:school.id,user_id:session.user_id,email,role:'manager',status:'active',is_primary_manager:true,__schoolRow:school});
        });
      }catch(_){}
    }
  }
  const memberships=[...byKey.values()].filter((r:any)=>r.school_id);
  const ids=[...new Set(memberships.map((r:any)=>r.school_id))];
  const schools=new Map<string,any>();
  if(ids.length){const sq=await admin.from('schools').select('*').in('id',ids);if(!sq.error)(sq.data||[]).forEach((x:any)=>schools.set(String(x.id),x));}
  return memberships.map((m:any)=>{const school=schools.get(String(m.school_id))||{};return {membershipId:String(m.id||''),schoolId:String(m.school_id||''),schoolName:text(school.school_name||school.schoolName),schoolCode:text(school.school_code||school.schoolCode),role:text(m.role||identity.role||session.role||'member'),roleLabel:text(m.role_label||''),userId:String(m.user_id||m.__userRow?.id||session.user_id),status:text(m.status||'active'),isPrimary:Boolean(m.is_primary||m.is_primary_manager)};}).filter((m:any)=>m.schoolId && activeStatus(schools.get(m.schoolId)?.status||'active'));
};

const issueSession = async (admin:any, userId:string, schoolId:string, role:string, previousSessionId?:string) => {
  const rawToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const tokenHash = await sha256(rawToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now()+12*60*60*1000).toISOString();
  if(previousSessionId) await admin.from('platform_sessions').update({status:'revoked',revoked_at:now}).eq('id',previousSessionId);
  const ins=await admin.from('platform_sessions').insert({session_token_hash:tokenHash,user_id:userId,school_id:schoolId,role,status:'active',expires_at:expiresAt,last_seen_at:now}).select('id').single();
  if(ins.error) throw new Error(ins.error.message);
  return {token:rawToken,expiresAt,userId,schoolId,role};
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

    const requestedAction = lower(payload?.action || 'login');
    if (requestedAction === 'login' && (!login || !password || !schoolRef)) {
      return json({error:'بيانات الجلسة غير مكتملة',code:'SESSION_INPUT_INCOMPLETE',requestId},400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const action = lower(payload?.action || 'login');
    if (action === 'renew') {
      const rawSession = text(request.headers.get('x-platform-session'));
      if (!rawSession) return json({error:'رمز الجلسة غير موجود',code:'SESSION_TOKEN_MISSING',requestId},401);
      const hash = await sha256(rawSession);
      const sq = await admin.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').limit(1).maybeSingle();
      if (sq.error) throw sq.error;
      const previous = sq.data;
      if (!previous) return json({error:'تعذر تجديد الجلسة السحابية',code:'SESSION_RENEW_NOT_FOUND',requestId},401);
      const expiredAt = previous.expires_at ? Date.parse(previous.expires_at) : Date.now();
      const graceMs = 7 * 24 * 60 * 60 * 1000;
      if (Number.isFinite(expiredAt) && expiredAt < Date.now() - graceMs) {
        return json({error:'انتهت مهلة تجديد الجلسة. يلزم تسجيل الدخول مرة أخرى.',code:'SESSION_RENEW_GRACE_EXPIRED',requestId},401);
      }
      const memberships = await membershipsForIdentity(admin, previous);
      const requestedSchool = text(payload?.schoolId || previous.school_id);
      const allowed = memberships.find((m:any)=>m.schoolId===requestedSchool && lower(m.role)===lower(previous.role)) ||
        memberships.find((m:any)=>m.schoolId===requestedSchool);
      if (!allowed) return json({error:'عضوية الحساب في المدرسة لم تعد فعالة',code:'SESSION_RENEW_MEMBERSHIP_DENIED',requestId},403);
      const next = await issueSession(admin, allowed.userId || previous.user_id, allowed.schoolId, allowed.role || previous.role, previous.id);
      return json({...next,membershipId:allowed.membershipId,schoolName:allowed.schoolName,schoolCode:allowed.schoolCode,requestId,renewed:true});
    }
    if (action === 'memberships' || action === 'switch') {
      const rawSession = text(request.headers.get('x-platform-session'));
      const currentSession = await activeSession(admin, rawSession);
      if (!currentSession) return json({error:'جلسة المنصة غير صالحة أو منتهية',code:'SESSION_INVALID',requestId},401);
      const memberships = await membershipsForIdentity(admin,currentSession);
      if(action === 'memberships') return json({memberships,current:{schoolId:currentSession.school_id,userId:currentSession.user_id,role:currentSession.role},requestId});
      const targetSchool=text(payload?.schoolId), targetRole=lower(payload?.role), membershipId=text(payload?.membershipId);
      const allowed=memberships.find((m:any)=>(!membershipId||m.membershipId===membershipId)&&m.schoolId===targetSchool&&(!targetRole||lower(m.role)===targetRole));
      if(!allowed) return json({error:'الحساب غير مرتبط بالمدرسة أو الدور المطلوب',code:'MEMBERSHIP_NOT_ALLOWED',requestId},403);
      const next=await issueSession(admin,allowed.userId||currentSession.user_id,allowed.schoolId,allowed.role,currentSession.id);
      return json({...next,membershipId:allowed.membershipId,schoolName:allowed.schoolName,schoolCode:allowed.schoolCode,requestId});
    }

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

    let resolvedMembership: any = null;
    // إذا لم يوجد سجل مستخدم مستقل داخل المدرسة المختارة، نتحقق من عضوية نفس الهوية في school_members.
    if (!user) {
      const allUsersResult = await admin.from('users').select('*').limit(5000);
      if (!allUsersResult.error) {
        const identityCandidates = (allUsersResult.data || []).filter(
          (row: Record<string, unknown>) => activeStatus(row.status) && loginMatches(row, login),
        );
        const identityUser = identityCandidates.find((candidate: Record<string, unknown>) => {
          if (authUser) return text(candidate.id) === text(authUser.id) || lower(candidate.email) === normalizedLogin;
          return passwordMatches(candidate, password);
        }) || null;
        if (identityUser) {
          try {
            let mq = await admin.from('school_members').select('*').eq('school_id', school.id).eq('user_id', identityUser.id).limit(1).maybeSingle();
            if ((!mq.data || mq.error) && lower(identityUser.email)) {
              mq = await admin.from('school_members').select('*').eq('school_id', school.id).eq('email', lower(identityUser.email)).limit(1).maybeSingle();
            }
            if (!mq.error && mq.data && activeStatus(mq.data.status)) {
              resolvedMembership = mq.data;
              user = { ...identityUser, id: mq.data.user_id || identityUser.id, school_id: school.id, role: mq.data.role || identityUser.role };
            }
          } catch (_) {}
        }
      }
    }

    if (!user) {
      console.warn('[platform-session]', requestId, 'user_not_resolved', {
        login: normalizedLogin,
        schoolId: school.id,
        authValidated: Boolean(authUser),
        candidateCount: candidates.length,
      });
      return json({error:'بيانات الدخول غير صحيحة أو الحساب غير مرتبط بهذه المدرسة',code:'USER_NOT_RESOLVED',requestId},401);
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

    const membership = resolvedMembership ? { data: resolvedMembership, error: null } : await admin
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

    const role = text(membership.data?.role || user.role || 'member');
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
