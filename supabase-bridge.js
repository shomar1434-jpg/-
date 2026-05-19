(function(){
  const SUPABASE_URL = 'https://cijhgvbtrvmmlcssgxht.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_3TC1p4w7U3hp2PbzhSauow_2xYLve5l';
  let client = null;
  function getClient(){
    if(client) return client;
    if(!window.supabase || !window.supabase.createClient) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return client;
  }
  function appRoleToDb(role){
    if(['leadership','manager','مدير'].includes(role)) return 'manager';
    if(['agency','agent','وكيل'].includes(role)) return 'agent';
    if(['performance','teacher','معلم'].includes(role)) return 'teacher';
    if(role === 'owner') return 'owner';
    return role || 'teacher';
  }
  function dbRoleToApp(role){
    if(role === 'manager' || role === 'owner') return 'leadership';
    if(role === 'agent') return 'agency';
    if(role === 'teacher') return 'performance';
    return role || 'performance';
  }
  function normalizeUser(row, school){
    if(!row) return null;
    const appRole = dbRoleToApp(row.role);
    return {
      id: row.id,
      name: row.full_name || row.name || '',
      full_name: row.full_name || row.name || '',
      email: row.email || '',
      password: row.password || '',
      role: appRole,
      dbRole: row.role,
      status: row.status || 'pending',
      isActive: row.status === 'active',
      active: row.status === 'active',
      schoolId: row.school_id || row.schoolId || '',
      schoolName: (school && (school.school_name || school.schoolName)) || row.schoolName || '',
      accountType: row.role === 'manager' ? 'school_manager' : 'school_user',
      isPrimaryManager: !!row.is_primary_manager,
      is_primary_manager: !!row.is_primary_manager,
      mustChangePassword: !!row.must_change_password,
      createdAt: row.created_at || ''
    };
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
  async function listSchools(){
    const sb = getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error} = await sb.from('schools').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    return (data||[]).map(normalizeSchool);
  }
  async function insertUserCompat(row){
    const sb = getClient();
    let q = await sb.from('users').insert(row).select('*').single();
    if(q.error && /full_name/i.test(q.error.message || '')){
      const fallback = Object.assign({}, row, { name: row.full_name });
      delete fallback.full_name;
      q = await sb.from('users').insert(fallback).select('*').single();
    }
    if(q.error) throw q.error;
    return q.data;
  }
  async function updateUserCompat(row, id){
    const sb = getClient();
    let q = await sb.from('users').update(row).eq('id',id).select('*').single();
    if(q.error && /full_name/i.test(q.error.message || '')){
      const fallback = Object.assign({}, row, { name: row.full_name });
      delete fallback.full_name;
      q = await sb.from('users').update(fallback).eq('id',id).select('*').single();
    }
    if(q.error) throw q.error;
    return q.data;
  }
  async function createSchoolWithManager(payload){
    const sb = getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const schoolCode = payload.schoolCode || ('SCH-' + Math.random().toString(36).slice(2,8).toUpperCase());
    const registrationCode = payload.registrationCode || ('REG-' + Math.random().toString(36).slice(2,8).toUpperCase());
    const {data:school,error:schoolErr} = await sb.from('schools').insert({
      school_name: payload.schoolName,
      school_code: schoolCode,
      manager_name: payload.managerName,
      manager_email: payload.email,
      status: 'active',
      registration_code: registrationCode,
      registration_link: payload.registrationLink || null,
      login_link: payload.loginLink || null
    }).select('*').single();
    if(schoolErr) throw schoolErr;
    const user = await insertUserCompat({
      school_id: school.id,
      full_name: payload.managerName,
      email: payload.email,
      password: payload.password,
      role: 'manager',
      status: 'active',
      is_primary_manager: true,
      must_change_password: false
    });
    return { school: normalizeSchool(school), manager: normalizeUser(user, school) };
  }
  async function updateSchoolStatus(schoolId,status){
    const sb = getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const {error} = await sb.from('schools').update({status}).eq('id',schoolId);
    if(error) throw error;
    await sb.from('users').update({status}).eq('school_id',schoolId).eq('role','manager');
    return true;
  }
  async function registerSchoolUser(payload){
    const sb = getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    let schoolId = payload.schoolId || '';
    let school = null;
    if(schoolId){
      const {data,error} = await sb.from('schools').select('*').eq('id',schoolId).maybeSingle();
      if(!error && data) school = data;
    }
    if(!school && payload.registrationCode){
      const {data,error} = await sb.from('schools').select('*').eq('registration_code',payload.registrationCode).maybeSingle();
      if(!error && data){ school = data; schoolId = data.id; }
    }
    if(!schoolId) throw new Error('الرابط غير مرتبط بمدرسة صحيحة');
    const {data:existing} = await sb.from('users').select('id').eq('email',payload.email).eq('school_id',schoolId).maybeSingle();
    if(existing) throw new Error('يوجد طلب أو حساب سابق بنفس البريد داخل هذه المدرسة');
    const user = await insertUserCompat({
      school_id: schoolId,
      full_name: payload.name,
      email: payload.email,
      password: payload.password,
      role: appRoleToDb(payload.role),
      status: 'pending',
      is_primary_manager: false,
      must_change_password: false
    });
    return normalizeUser(user, school);
  }
  async function listUsersBySchool(schoolId){
    const sb = getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error} = await sb.from('users').select('*').eq('school_id',schoolId).order('created_at',{ascending:false});
    if(error) throw error;
    return (data||[]).map(u => normalizeUser(u));
  }
  async function updateUserStatus(userId,status){
    const sb = getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error} = await sb.from('users').update({status}).eq('id',userId).select('*').single();
    if(error) throw error;
    return normalizeUser(data);
  }
  async function upsertSchoolUser(payload){
    const sb = getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const row = {
      school_id: payload.schoolId,
      full_name: payload.name || payload.full_name || '',
      email: payload.email || '',
      password: payload.password || '123456',
      role: appRoleToDb(payload.role),
      status: payload.status || 'pending',
      is_primary_manager: !!payload.isPrimaryManager
    };
    const data = payload.id ? await updateUserCompat(row, payload.id) : await insertUserCompat(row);
    return normalizeUser(data);
  }
  async function login(email,password,schoolId){
    const sb = getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    let query = sb.from('users').select('*').eq('email',email).eq('password',password).neq('status','deleted');
    if(schoolId) query = query.eq('school_id',schoolId);
    const {data,error} = await query.maybeSingle();
    if(error) throw error;
    if(!data) return null;
    let school = null;
    if(data.school_id){
      const sch = await sb.from('schools').select('*').eq('id',data.school_id).maybeSingle();
      if(!sch.error) school = sch.data;
    }
    return normalizeUser(data, school);
  }
  window.SmartSchoolSupabase = { getClient, appRoleToDb, dbRoleToApp, normalizeUser, normalizeSchool, listSchools, createSchoolWithManager, updateSchoolStatus, registerSchoolUser, listUsersBySchool, updateUserStatus, upsertSchoolUser, login };
})();
