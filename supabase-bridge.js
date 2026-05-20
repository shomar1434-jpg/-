// supabase-bridge.js
// مصدر مركزي واحد لعمليات المدارس والمستخدمين عبر Supabase.
(function(){
  const SUPABASE_URL = 'https://cijhgvbtrvmmlcssgxht.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_3TC1p4w7U3hp2PbzhSauow_2xYLve5l';
  let client = null;

  function getClient(){
    if(client) return client;
    if(!window.supabase || !window.supabase.createClient){
      console.error('Supabase library is not loaded');
      return null;
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return client;
  }

  function appRoleToDb(role){
    role = String(role || '').trim();
    if(['leadership','manager','مدير','قسم المدير'].includes(role)) return 'manager';
    if(['agency','agent','وكيل','قسم الوكيل','قسم الوكيل/ة'].includes(role)) return 'agent';
    if(['performance','teacher','معلم','قسم المعلم','قسم المعلم/ة'].includes(role)) return 'teacher';
    if(role === 'owner') return 'owner';
    return role || 'teacher';
  }

  function dbRoleToApp(role){
    if(role === 'manager' || role === 'owner') return 'leadership';
    if(role === 'agent') return 'agency';
    if(role === 'teacher') return 'performance';
    return role || 'performance';
  }

  function normalizeSchool(row){
    if(!row) return null;
    return {
      id: row.id,
      schoolId: row.id,
      schoolCode: row.school_code || row.id,
      schoolName: row.school_name || '',
      managerName: row.manager_name || '',
      managerEmail: row.manager_email || '',
      status: row.status || 'pending',
      registrationCode: row.registration_code || '',
      registrationLink: row.registration_link || '',
      loginLink: row.login_link || '',
      createdAt: row.created_at || ''
    };
  }

  function normalizeUser(row, school){
    if(!row) return null;
    const appRole = dbRoleToApp(row.role);
    return {
      id: row.id,
      name: row.full_name || row.name || '',
      fullName: row.full_name || row.name || '',
      email: row.email || '',
      password: row.password || '',
      role: appRole,
      dbRole: row.role,
      status: row.status || 'pending',
      isActive: row.status === 'active',
      active: row.status === 'active',
      schoolId: row.school_id || '',
      schoolName: (school && (school.school_name || school.schoolName)) || row.schoolName || '',
      accountType: row.role === 'manager' ? 'school_manager' : 'school_user',
      isPrimaryManager: !!row.is_primary_manager,
      is_primary_manager: !!row.is_primary_manager,
      mustChangePassword: !!row.must_change_password,
      createdAt: row.created_at || ''
    };
  }

  function makeCode(prefix){
    return prefix + '-' + Math.random().toString(36).slice(2,8).toUpperCase();
  }

  async function listSchools(){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error} = await sb.from('schools').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    return (data || []).map(normalizeSchool);
  }

  async function insertUser(row){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    let q = await sb.from('users').insert(row).select('*').single();
    if(q.error && /full_name/i.test(q.error.message || '')){
      const fallback = Object.assign({}, row, {name: row.full_name});
      delete fallback.full_name;
      q = await sb.from('users').insert(fallback).select('*').single();
    }
    if(q.error) throw q.error;
    return q.data;
  }

  async function createSchoolWithManager(payload){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');

    const schoolCode = payload.schoolCode || makeCode('SCH');
    const registrationCode = payload.registrationCode || makeCode('REG');
    const basePath = location.href.split('/').slice(0,-1).join('/');
    const registrationLink = payload.registrationLink || `${basePath}/register.html?school=${encodeURIComponent(schoolCode)}&reg=${encodeURIComponent(registrationCode)}`;
    const loginLink = payload.loginLink || `${basePath}/school-login.html?school=${encodeURIComponent(schoolCode)}`;

    const {data:school,error:schoolErr} = await sb.from('schools').insert({
      school_name: payload.schoolName || payload.school_name || '',
      school_code: schoolCode,
      manager_name: payload.managerName || payload.manager_name || '',
      manager_email: payload.email || payload.managerEmail || '',
      status: payload.status || 'active',
      active: true,
      registration_code: registrationCode,
      registration_link: registrationLink,
      login_link: loginLink
    }).select('*').single();

    if(schoolErr) throw schoolErr;

    const manager = await insertUser({
      school_id: school.id,
      full_name: payload.managerName || payload.manager_name || '',
      email: payload.email || payload.managerEmail || '',
      password: payload.password || '',
      role: 'manager',
      status: payload.status || 'active',
      active: true,
      is_primary_manager: true,
      must_change_password: false
    });

    return {school: normalizeSchool(school), manager: normalizeUser(manager, school)};
  }

  async function updateSchoolStatus(schoolId,status){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {error} = await sb.from('schools').update({status}).eq('id',schoolId);
    if(error) throw error;
    await sb.from('users').update({
      status,
      active: status === 'active'
    }).eq('school_id',schoolId).eq('role','manager');
    return true;
  }

  async function registerSchoolUser(payload){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    let school = null;
    let schoolId = payload.schoolId || '';

    if(schoolId){
      const {data} = await sb.from('schools').select('*').eq('id',schoolId).maybeSingle();
      if(data) school = data;
    }
    if(!school && payload.schoolCode){
      const {data} = await sb.from('schools').select('*').eq('school_code',payload.schoolCode).maybeSingle();
      if(data){ school = data; schoolId = data.id; }
    }
    if(!school && payload.registrationCode){
      const {data} = await sb.from('schools').select('*').eq('registration_code',payload.registrationCode).maybeSingle();
      if(data){ school = data; schoolId = data.id; }
    }

    if(!schoolId) throw new Error('الرابط غير مرتبط بمدرسة صحيحة');

    const {data:existing} = await sb.from('users').select('id').eq('email',payload.email).eq('school_id',schoolId).maybeSingle();
    if(existing) throw new Error('يوجد طلب أو حساب سابق بنفس البريد داخل هذه المدرسة');

    const user = await insertUser({
      school_id: schoolId,
      full_name: payload.name || payload.fullName || '',
      email: payload.email || '',
      password: payload.password || '',
      role: appRoleToDb(payload.role),
      status: 'pending',
      active: false,
      is_primary_manager: false,
      must_change_password: false
    });

    return normalizeUser(user, school);
  }

  async function listUsersBySchool(schoolId){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error} = await sb.from('users').select('*').eq('school_id',schoolId).order('created_at',{ascending:false});
    if(error) throw error;
    return (data || []).map(u => normalizeUser(u));
  }

  async function updateUserStatus(userId,status){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error} = await sb.from('users').update({
      status,
      active: status === 'active'
    }).eq('id',userId).select('*').single();
    if(error) throw error;
    return normalizeUser(data);
  }

  async function loginSchoolUser(email,password){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {data:user,error} = await sb.from('users').select('*').eq('email',email).eq('password',password).maybeSingle();
    if(error) throw error;
    if(!user) throw new Error('بيانات الدخول غير صحيحة');
    if(user.status !== 'active') throw new Error('الحساب غير مفعل بعد');

    let school = null;
    if(user.school_id){
      const {data} = await sb.from('schools').select('*').eq('id',user.school_id).maybeSingle();
      school = data;
      if(school && school.status !== 'active') throw new Error('المدرسة غير مفعلة');
    }

    const normalized = normalizeUser(user, school);
    try{
      localStorage.removeItem('smartSchoolUnifiedOpsV2_follow_context');
      sessionStorage.removeItem('smartSchoolUnifiedOpsV2_follow_context');
      localStorage.setItem('currentSchoolUser', JSON.stringify(normalized));
      localStorage.setItem('currentUser', JSON.stringify(normalized));
      localStorage.setItem('smartSchool.currentSchool', JSON.stringify(normalizeSchool(school)));
    }catch(e){}
    return normalized;
  }

  async function deleteSchool(schoolId){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {error} = await sb.from('schools').delete().eq('id',schoolId);
    if(error) throw error;
    return true;
  }

  async function deleteUser(userId){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {error} = await sb.from('users').delete().eq('id',userId);
    if(error) throw error;
    return true;
  }

  window.SmartSchoolSupabase = {
    getClient,
    appRoleToDb,
    dbRoleToApp,
    normalizeSchool,
    normalizeUser,
    listSchools,
    createSchoolWithManager,
    updateSchoolStatus,
    registerSchoolUser,
    listUsersBySchool,
    updateUserStatus,
    loginSchoolUser,
    deleteSchool,
    deleteUser,
    login: loginSchoolUser,
    signIn: loginSchoolUser,
    schoolLogin: loginSchoolUser
  };

  window.addEventListener('DOMContentLoaded', function(){
    if(getClient()) console.info('SmartSchoolSupabase bridge ready');
  });
})();
