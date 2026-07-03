// supabase-bridge.js
// مصدر مركزي واحد لعمليات المدارس والمستخدمين عبر Supabase.
(function(){
  const SUPABASE_URL = localStorage.getItem('smartSchoolSupabaseUrl') || 'https://cijhgvbtrvmmlcssgxht.supabase.co';
  const SUPABASE_KEY = localStorage.getItem('smartSchoolSupabaseAnonKey') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM';
  let client = null;


  function explainSupabaseError(error){
    if(!error) return error;
    const msg = String(error.message || error.details || error.hint || error || '');
    if(/schema cache|Could not find the table/i.test(msg)){
      error.message = 'تعذر الوصول إلى جدول schools في مشروع Supabase الحالي. تم ضبط رابط المشروع داخل المنصة، فإن استمرت الرسالة فتأكد من أن anon public key يخص نفس المشروع: ' + SUPABASE_URL;
    }
    if(/Invalid API key|JWT|apikey|signature/i.test(msg)){
      error.message = 'مفتاح Supabase لا يطابق رابط المشروع الحالي. انسخ anon public key من Project Settings > API وضعه في إعدادات المنصة أو localStorage باسم smartSchoolSupabaseAnonKey.';
    }
    return error;
  }

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
    if(['leadership','manager','مدير','قسم المدير/المديرة'].includes(role)) return 'manager';
    if(['agency','agent','وكيل','قسم الوكيل/الوكيلة','قسم الوكيل/الوكيلة/ة'].includes(role)) return 'agent';
    if(['performance','teacher','معلم','قسم المعلم/المعلمة','قسم المعلم/المعلمة/ة'].includes(role)) return 'teacher';
    if(['student_advisor','advisor','موجه','موجه طلابي','قسم الموجه'].includes(role)) return 'student_advisor';
    if(role === 'owner') return 'owner';
    return role || 'teacher';
  }

  function dbRoleToApp(role){
    if(role === 'manager' || role === 'owner') return 'leadership';
    if(role === 'agent') return 'agency';
    if(role === 'teacher') return 'performance';
    if(role === 'student_advisor') return 'student_advisor';
    return role || 'performance';
  }


  function persistIndependentSchoolLogin(school){
    try{
      if(!school) return;
      const schoolCode = school.school_code || school.schoolCode || school.id || '';
      const loginLink = school.login_link || school.loginLink || (schoolCode ? ('school-login.html?school=' + encodeURIComponent(schoolCode)) : 'school-login.html');
      localStorage.setItem('active_school_login_url', loginLink);
      sessionStorage.setItem('active_school_login_url', loginLink);
      if(schoolCode){
        localStorage.setItem('active_school_code', schoolCode);
        sessionStorage.setItem('active_school_code', schoolCode);
      }
      if(school.id){
        localStorage.setItem('active_school_id', school.id);
        sessionStorage.setItem('active_school_id', school.id);
      }
    }catch(e){}
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
    if(error) throw explainSupabaseError(error);
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
    if(q.error) throw explainSupabaseError(q.error);
    return q.data;
  }


  async function resolveSchool(identifier){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const value = String(identifier || '').trim();
    if(!value) return null;
    const fields = ['id','school_code','registration_code'];
    for(const f of fields){
      const {data,error} = await sb.from('schools').select('*').eq(f,value).maybeSingle();
      if(error) throw explainSupabaseError(error);
      if(data) return normalizeSchool(data);
    }
    return null;
  }

  function buildSchoolLinks(school){
    const basePath = location.href.split('/').slice(0,-1).join('/');
    const id = school.id || school.schoolId || '';
    const code = school.school_code || school.schoolCode || id;
    const reg = school.registration_code || school.registrationCode || '';
    const name = school.school_name || school.schoolName || '';
    const registrationLink = `${basePath}/register.html?schoolId=${encodeURIComponent(id)}&school=${encodeURIComponent(code)}&reg=${encodeURIComponent(reg)}&token=${encodeURIComponent(reg)}&schoolName=${encodeURIComponent(name)}&source=supabase_school_registration`;
    const loginLink = `${basePath}/school-login.html?schoolId=${encodeURIComponent(id)}&school=${encodeURIComponent(code)}&schoolName=${encodeURIComponent(name)}&source=supabase_school_login`;
    return {registrationLink, loginLink};
  }


  async function createSchoolMemberSafe(payload){
    const sb = getClient();
    if(!sb) return null;
    try{
      const row = {
        school_id: payload.school_id || payload.schoolId,
        user_id: payload.user_id || payload.userId || null,
        email: payload.email || '',
        role: payload.role || 'manager',
        status: payload.status || 'active',
        is_primary_manager: !!payload.is_primary_manager
      };
      const q = await sb.from('school_members').insert(row).select('*').maybeSingle();
      if(q.error){
        console.warn('school_members غير متاح أو لم يتم إنشاؤه بعد، سيتم الاعتماد مؤقتًا على manager_email داخل schools:', q.error.message || q.error);
        return null;
      }
      return q.data || null;
    }catch(e){
      console.warn('تعذر إنشاء ربط school_members، سيتم الاعتماد مؤقتًا على manager_email داخل schools:', e.message || e);
      return null;
    }
  }

  async function findManagerByEmail(email){
    const sb = getClient();
    if(!sb || !email) return null;
    try{
      const q = await sb.from('users').select('*').eq('email', email).eq('role','manager').limit(1).maybeSingle();
      if(q.error) return null;
      return q.data || null;
    }catch(e){ return null; }
  }


  async function createSchoolWithManager(payload){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');

    const email = String(payload.email || payload.managerEmail || '').trim().toLowerCase();
    const managerName = payload.managerName || payload.manager_name || '';
    const schoolCode = payload.schoolCode || makeCode('SCH');
    const registrationCode = payload.registrationCode || makeCode('REG');
    const basePath = location.href.split('/').slice(0,-1).join('/');
    const registrationLink = payload.registrationLink || `${basePath}/register.html?school=${encodeURIComponent(schoolCode)}&reg=${encodeURIComponent(registrationCode)}`;
    const loginLink = payload.loginLink || `${basePath}/school-login.html?school=${encodeURIComponent(schoolCode)}`;

    const existingManager = await findManagerByEmail(email);

    const {data:school,error:schoolErr} = await sb.from('schools').insert({
      school_name: payload.schoolName || payload.school_name || '',
      school_code: schoolCode,
      manager_name: managerName,
      manager_email: email,
      status: payload.status || 'active',
      active: true,
      registration_code: registrationCode,
      registration_link: registrationLink,
      login_link: loginLink
    }).select('*').single();

    if(schoolErr) throw explainSupabaseError(schoolErr);

    try{
      const links = buildSchoolLinks(school);
      const updated = await sb.from('schools').update({registration_link:links.registrationLink, login_link:links.loginLink}).eq('id',school.id).select('*').single();
      if(updated && updated.data){ school.registration_link = updated.data.registration_link; school.login_link = updated.data.login_link; }
    }catch(e){ console.warn('تعذر تحديث روابط المدرسة بعد إنشاء المعرف', e); }

    let manager = existingManager;
    if(!manager){
      try{
        manager = await insertUser({
          school_id: school.id,
          full_name: managerName,
          email: email,
          password: payload.password || '',
          role: 'manager',
          status: payload.status || 'active',
          active: true,
          is_primary_manager: true,
          must_change_password: false
        });
      }catch(e){
        // في حال وجود قيد UNIQUE على البريد، نعيد استخدام حساب المدير الموجود
        manager = await findManagerByEmail(email);
        if(!manager) throw e;
      }
    }

    await createSchoolMemberSafe({
      school_id: school.id,
      user_id: manager && manager.id,
      email: email,
      role: 'manager',
      status: payload.status || 'active',
      is_primary_manager: true
    });

    const normalizedManager = normalizeUser(Object.assign({}, manager, {
      school_id: school.id,
      schoolName: school.school_name || payload.schoolName || '',
      is_primary_manager: true,
      status: payload.status || (manager && manager.status) || 'active'
    }), school);

    normalizedManager.schoolIds = Array.from(new Set([].concat(manager && manager.schoolIds || [], [school.id]).filter(Boolean)));
    normalizedManager.managedSchools = [{id:school.id, schoolId:school.id, schoolName:school.school_name || '', schoolCode:school.school_code || ''}];

    return {school: normalizeSchool(school), manager: normalizedManager};
  }

  async function updateSchoolStatus(schoolId,status){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {error} = await sb.from('schools').update({status}).eq('id',schoolId);
    if(error) throw explainSupabaseError(error);
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
    if(error) throw explainSupabaseError(error);
    return (data || []).map(u => normalizeUser(u));
  }

  async function updateUserStatus(userId,status){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error} = await sb.from('users').update({
      status,
      active: status === 'active'
    }).eq('id',userId).select('*').single();
    if(error) throw explainSupabaseError(error);
    return normalizeUser(data);
  }

  async function upsertSchoolUser(payload){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const schoolId = payload.schoolId || payload.school_id || '';
    if(!schoolId) throw new Error('لا يوجد معرف مدرسة لربط المستخدم بها');
    const row = {
      school_id: schoolId,
      full_name: payload.name || payload.fullName || payload.full_name || '',
      email: payload.email || '',
      password: payload.password || '123456',
      role: appRoleToDb(payload.role),
      status: payload.status || 'pending',
      active: (payload.status || 'pending') === 'active',
      is_primary_manager: !!payload.isPrimaryManager,
      must_change_password: false
    };
    let data = null, error = null;
    if(payload.id && !String(payload.id).startsWith('user_')){
      const q = await sb.from('users').update(row).eq('id',payload.id).select('*').single();
      data = q.data; error = q.error;
    }else{
      const existing = await sb.from('users').select('id').eq('email',row.email).eq('school_id',schoolId).maybeSingle();
      if(existing.data){
        const q = await sb.from('users').update(row).eq('id',existing.data.id).select('*').single();
        data = q.data; error = q.error;
      }else{
        const q = await insertUser(row);
        data = q;
      }
    }
    if(error) throw explainSupabaseError(error);
    return normalizeUser(data);
  }

  async function loginSchoolUser(email,password,targetSchoolId){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    email = String(email || '').trim().toLowerCase();
    const wantedSchool = String(targetSchoolId || '').trim();

    let q = await sb.from('users').select('*').eq('email',email).eq('password',password).neq('status','deleted');
    if(q.error) throw explainSupabaseError(q.error);
    let rows = q.data || [];

    if(wantedSchool){
      let scoped = rows.filter(u => String(u.school_id || '') === wantedSchool);
      if(!scoped.length){
        const managerCandidate = rows.find(u => String(u.role||'') === 'manager');
        if(managerCandidate){
          let allowed = false;
          let schoolByEmail = null;
          try{
            const ms = await sb.from('school_members').select('*').eq('school_id',wantedSchool).or(`email.eq.${email},user_id.eq.${managerCandidate.id}`).maybeSingle();
            if(ms && ms.data) allowed = true;
          }catch(e){}
          try{
            const schByEmail = await sb.from('schools').select('*').eq('id',wantedSchool).eq('manager_email',email).maybeSingle();
            if(schByEmail && schByEmail.data){ allowed = true; schoolByEmail = schByEmail.data; }
          }catch(e){}
          if(allowed){
            scoped = [Object.assign({}, managerCandidate, {school_id:wantedSchool, role:'manager', is_primary_manager:true, __schoolOverride:schoolByEmail})];
          }
        }
      }
      rows = scoped;
    }

    const user = rows[0] || null;
    if(!user) throw new Error(wantedSchool ? 'بيانات الدخول غير صحيحة أو الحساب غير مرتبط بهذه المدرسة' : 'بيانات الدخول غير صحيحة');
    if(user.status && user.status !== 'active') throw new Error('الحساب غير مفعل بعد');

    let school = user.__schoolOverride || null;
    if(user.school_id && !school){
      const sch = await sb.from('schools').select('*').eq('id',user.school_id).maybeSingle();
      if(!sch.error) school = sch.data;
      if(school && school.status && school.status !== 'active') throw new Error('المدرسة غير مفعلة');
    }

    const normalized = normalizeUser(user, school);
    normalized.schoolId = (school && school.id) || user.school_id || wantedSchool || normalized.schoolId;
    normalized.schoolName = (school && (school.school_name || school.schoolName)) || normalized.schoolName || '';

    try{
      const normalizedSchool = normalizeSchool(school);
      localStorage.removeItem('smartSchoolUnifiedOpsV2_follow_context');
      sessionStorage.removeItem('smartSchoolUnifiedOpsV2_follow_context');
      localStorage.setItem('currentSchoolUser', JSON.stringify(normalized));
      localStorage.setItem('currentUser', JSON.stringify(normalized));
      localStorage.setItem('smartSchool.currentSchool', JSON.stringify(normalizedSchool));
      if(normalized.schoolId){
        localStorage.setItem('current_school_id', normalized.schoolId);
        localStorage.setItem('school_id', normalized.schoolId);
        localStorage.setItem('smart_school_id', normalized.schoolId);
      }
      if(normalized.schoolName){
        localStorage.setItem('current_school_name', normalized.schoolName);
        localStorage.setItem('school_name', normalized.schoolName);
        localStorage.setItem('persist_school', normalized.schoolName);
      }
      persistIndependentSchoolLogin(school);
    }catch(e){}
    return normalized;
  }

  async function deleteSchool(schoolId){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {error} = await sb.from('schools').delete().eq('id',schoolId);
    if(error) throw explainSupabaseError(error);
    return true;
  }

  async function deleteUser(userId){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {error} = await sb.from('users').delete().eq('id',userId);
    if(error) throw explainSupabaseError(error);
    return true;
  }



  function getActiveSchoolIdForExternal(){
    try{ if(window.ActiveSchoolScope && ActiveSchoolScope.get){ const s=ActiveSchoolScope.get(); if(s && (s.schoolId || s.id)) return s.schoolId || s.id; } }catch(e){}
    try{ const u=JSON.parse(localStorage.getItem('currentSchoolUser')||localStorage.getItem('currentUser')||'{}'); if(u && (u.schoolId || u.school_id)) return u.schoolId || u.school_id; }catch(e){}
    return localStorage.getItem('active_school_id') || localStorage.getItem('current_school_id') || localStorage.getItem('school_id') || localStorage.getItem('smart_school_id') || null;
  }

  function getCurrentUserIdForExternal(){
    try{ const u=JSON.parse(localStorage.getItem('currentSchoolUser')||localStorage.getItem('currentUser')||'{}'); return u.id || u.user_id || null; }catch(e){ return null; }
  }

  function normalizeExternalVisitPayload(payload){
    payload = payload || {};
    const schoolId = payload.school_id || payload.schoolId || getActiveSchoolIdForExternal();
    const createdBy = payload.created_by || payload.createdBy || getCurrentUserIdForExternal();
    const formData = payload.form_data || payload.formData || payload;
    const visit = formData.currentVisit || payload.currentVisit || {};
    return {schoolId, createdBy, formData, visit};
  }

  async function saveExternalEvaluationDraft(payload){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const p = normalizeExternalVisitPayload(payload);
    const visit = p.visit || {};
    const row = {
      school_id: p.schoolId,
      created_by: p.createdBy,
      draft_number: payload.draft_number || payload.draftNumber || visit.number || null,
      draft_title: payload.draft_title || payload.draftTitle || 'مسودة زيارة فريق التقويم الخارجي',
      status: 'draft',
      form_data: p.formData || {},
      updated_at: new Date().toISOString()
    };
    let q;
    const id = payload.id || payload.draft_id || payload.draftId || (p.formData && p.formData.supabaseDraftId);
    if(id){
      q = await sb.from('external_evaluation_drafts').update(row).eq('id', id).select('*').maybeSingle();
    }else{
      q = await sb.from('external_evaluation_drafts').insert(Object.assign({created_at:new Date().toISOString()}, row)).select('*').single();
    }
    if(q.error) throw explainSupabaseError(q.error);
    return q.data;
  }

  async function saveExternalEvaluationVisit(payload){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const p = normalizeExternalVisitPayload(payload);
    const visit = p.visit || {};
    const row = {
      school_id: p.schoolId,
      created_by: p.createdBy,
      team_leader_name: payload.team_leader_name || payload.teamLeaderName || (p.formData && p.formData.teamLeaderName) || '',
      visit_number: payload.visit_number || payload.visitNumber || visit.number || '',
      visit_year: String(payload.visit_year || payload.visitYear || visit.year || ''),
      visit_title: payload.visit_title || payload.visitTitle || 'زيارة فريق التقويم الخارجي',
      status: payload.status || visit.status || 'draft',
      form_data: p.formData || {},
      final_score: Number(payload.final_score || payload.finalScore || (p.formData && p.formData.finalScore) || 0),
      accreditation_decision: payload.accreditation_decision || payload.accreditationDecision || (p.formData && p.formData.accreditationDecision) || null,
      updated_at: new Date().toISOString()
    };
    let q;
    const id = payload.id || payload.visit_id || payload.visitId || (visit && visit.supabaseVisitId) || (p.formData && p.formData.supabaseVisitId);
    if(id){
      q = await sb.from('external_evaluation_visits').update(row).eq('id', id).select('*').maybeSingle();
    }else{
      q = await sb.from('external_evaluation_visits').insert(Object.assign({created_at:new Date().toISOString(), archived_at: visit.archivedAt || null}, row)).select('*').single();
    }
    if(q.error) throw explainSupabaseError(q.error);
    return q.data;
  }

  async function saveExternalEvaluationDecision(payload){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    payload = payload || {};
    const row = {
      visit_id: payload.visit_id || payload.visitId || null,
      final_score: Number(payload.final_score || payload.finalScore || 0),
      decision: payload.decision || '',
      strengths: payload.strengths || [],
      gaps: payload.gaps || [],
      recommendations: payload.recommendations || [],
      team_leader_name: payload.team_leader_name || payload.teamLeaderName || '',
      leader_signature_path: payload.leader_signature_path || payload.leaderSignaturePath || null,
      approved_at: payload.approved_at || payload.approvedAt || new Date().toISOString()
    };
    const q = await sb.from('external_evaluation_decisions').insert(row).select('*').single();
    if(q.error) throw explainSupabaseError(q.error);
    return q.data;
  }

  async function findActiveExternalVisitByToken(schoolId, token){
    const sb = getClient();
    if(!sb || !token) return null;
    let q = sb.from('external_evaluation_visits').select('*').eq('status','active').limit(50);
    if(schoolId) q = q.eq('school_id', schoolId);
    const res = await q;
    if(res.error) throw explainSupabaseError(res.error);
    const rows = res.data || [];
    return rows.find(r => {
      const fd = r.form_data || {};
      const cv = fd.currentVisit || fd.visit || {};
      return String(cv.token || fd.visit_token || fd.visitToken || '') === String(token);
    }) || null;
  }

  async function listExternalEvaluationDrafts(schoolId){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const sid = schoolId || getActiveSchoolIdForExternal();
    let q = sb.from('external_evaluation_drafts').select('*').order('updated_at',{ascending:false}).limit(20);
    if(sid) q = q.eq('school_id', sid);
    const res = await q;
    if(res.error) throw explainSupabaseError(res.error);
    return res.data || [];
  }



  const EXTERNAL_EVALUATION_BUCKET = 'external-evaluation-files';

  function safePathPart(value){
    return String(value || '')
      .trim()
      .replace(/[\\/]+/g, '-')
      .replace(/[^\u0600-\u06FF\w\-.]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'item';
  }

  function getFileExtension(fileName, fallback){
    const name = String(fileName || '');
    const m = name.match(/\.([a-zA-Z0-9]{1,12})$/);
    return (m && m[1]) || fallback || 'bin';
  }

  function dataUrlToBlob(dataUrl){
    const parts = String(dataUrl || '').split(',');
    if(parts.length < 2) throw new Error('صيغة الملف غير صحيحة');
    const meta = parts[0] || '';
    const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], {type:mime});
  }

  function buildExternalEvaluationFilePath(file, options){
    options = options || {};
    const schoolId = safePathPart(options.school_id || options.schoolId || getActiveSchoolIdForExternal() || 'unknown-school');
    const visitNumber = safePathPart(options.visit_number || options.visitNumber || options.draft_number || options.draftNumber || 'draft');
    const section = safePathPart(options.section_name || options.sectionName || options.section || 'general');
    const ext = getFileExtension((file && file.name) || options.file_name || options.fileName, 'bin');
    const baseName = safePathPart(((file && file.name) || options.file_name || options.fileName || ('file.' + ext)).replace(/\.[^.]+$/, ''));
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
    return `${schoolId}/visits/${visitNumber}/${section}/${stamp}_${baseName}.${ext}`;
  }

  async function createExternalEvaluationSignedUrl(filePath, expiresIn){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    if(!filePath) return null;
    const res = await sb.storage.from(EXTERNAL_EVALUATION_BUCKET).createSignedUrl(filePath, expiresIn || 60 * 60);
    if(res.error) throw explainSupabaseError(res.error);
    return res.data && res.data.signedUrl;
  }

  async function saveExternalEvaluationFileRecord(meta){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    meta = meta || {};
    const row = {
      school_id: meta.school_id || meta.schoolId || getActiveSchoolIdForExternal(),
      visit_id: meta.visit_id || meta.visitId || null,
      draft_id: meta.draft_id || meta.draftId || null,
      section_name: meta.section_name || meta.sectionName || meta.section || 'عام',
      file_name: meta.file_name || meta.fileName || '',
      file_path: meta.file_path || meta.filePath || '',
      file_type: meta.file_type || meta.fileType || 'file',
      uploaded_at: meta.uploaded_at || meta.uploadedAt || new Date().toISOString()
    };
    const q = await sb.from('external_evaluation_files').insert(row).select('*').single();
    if(q.error) throw explainSupabaseError(q.error);
    return q.data;
  }

  async function uploadExternalEvaluationFile(file, options){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    if(!file) throw new Error('لم يتم تحديد ملف للرفع');
    options = options || {};
    const path = options.file_path || options.filePath || buildExternalEvaluationFilePath(file, options);
    const upload = await sb.storage.from(EXTERNAL_EVALUATION_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || options.contentType || 'application/octet-stream'
    });
    if(upload.error) throw explainSupabaseError(upload.error);
    const record = await saveExternalEvaluationFileRecord(Object.assign({}, options, {
      file_name: options.file_name || options.fileName || file.name || path.split('/').pop(),
      file_path: upload.data && upload.data.path || path,
      file_type: options.file_type || options.fileType || file.type || 'file'
    }));
    return {
      bucket: EXTERNAL_EVALUATION_BUCKET,
      path: upload.data && upload.data.path || path,
      record,
      signedUrl: null
    };
  }

  async function uploadExternalEvaluationDataUrl(dataUrl, fileName, options){
    const blob = dataUrlToBlob(dataUrl);
    const ext = getFileExtension(fileName, (blob.type || '').split('/').pop() || 'png');
    const file = new File([blob], fileName || ('signature.' + ext), {type: blob.type || 'application/octet-stream'});
    return uploadExternalEvaluationFile(file, options || {});
  }

  async function listExternalEvaluationFiles(filters){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    filters = filters || {};
    let q = sb.from('external_evaluation_files').select('*').order('uploaded_at', {ascending:false});
    const schoolId = filters.school_id || filters.schoolId || getActiveSchoolIdForExternal();
    if(schoolId) q = q.eq('school_id', schoolId);
    if(filters.visit_id || filters.visitId) q = q.eq('visit_id', filters.visit_id || filters.visitId);
    if(filters.draft_id || filters.draftId) q = q.eq('draft_id', filters.draft_id || filters.draftId);
    if(filters.section_name || filters.sectionName) q = q.eq('section_name', filters.section_name || filters.sectionName);
    const res = await q;
    if(res.error) throw explainSupabaseError(res.error);
    return res.data || [];
  }


  async function verifyExternalEvaluationStorage(options){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    options = options || {};
    const schoolId = safePathPart(options.school_id || options.schoolId || getActiveSchoolIdForExternal() || 'unknown-school');
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
    const path = `${schoolId}/_diagnostics/${stamp}_storage_test.txt`;
    const blob = new Blob(['Smart School external evaluation storage test - ' + new Date().toISOString()], {type:'text/plain;charset=utf-8'});
    const upload = await sb.storage.from(EXTERNAL_EVALUATION_BUCKET).upload(path, blob, {
      upsert: true,
      contentType: 'text/plain;charset=utf-8'
    });
    if(upload.error) throw explainSupabaseError(upload.error);
    const signedUrl = await createExternalEvaluationSignedUrl(upload.data && upload.data.path || path, 60 * 5);
    let removed = null;
    if(options.cleanup !== false){
      removed = await sb.storage.from(EXTERNAL_EVALUATION_BUCKET).remove([upload.data && upload.data.path || path]);
      if(removed.error) console.warn('تم الرفع والقراءة لكن تعذر حذف ملف الاختبار:', removed.error.message || removed.error);
    }
    return {ok:true, bucket: EXTERNAL_EVALUATION_BUCKET, path: upload.data && upload.data.path || path, signedUrl, cleanup: options.cleanup !== false, removed};
  }


  window.SmartSchoolSupabase = {
    getClient,

    getActiveSchoolIdForExternal,
    getCurrentUserIdForExternal,
    saveExternalEvaluationDraft,
    saveExternalEvaluationVisit,
    saveExternalEvaluationDecision,
    findActiveExternalVisitByToken,
    listExternalEvaluationDrafts,
    uploadExternalEvaluationFile,
    uploadExternalEvaluationDataUrl,
    saveExternalEvaluationFileRecord,
    listExternalEvaluationFiles,
    createExternalEvaluationSignedUrl,
    verifyExternalEvaluationStorage,
    appRoleToDb,
    dbRoleToApp,
    normalizeSchool,
    normalizeUser,
    resolveSchool,
    buildSchoolLinks,
    listSchools,
    createSchoolWithManager,
    updateSchoolStatus,
    registerSchoolUser,
    listUsersBySchool,
    updateUserStatus,
    upsertSchoolUser,
    loginSchoolUser,
    deleteSchool,
    deleteUser,
    login: loginSchoolUser,
    signIn: loginSchoolUser,
    schoolLogin: loginSchoolUser
  };


  window.smartSupabaseClient = getClient;
  window.SmartSchoolExternalEvaluation = {
    saveDraft: saveExternalEvaluationDraft,
    saveVisit: saveExternalEvaluationVisit,
    saveDecision: saveExternalEvaluationDecision,
    findActiveVisitByToken: findActiveExternalVisitByToken,
    listDrafts: listExternalEvaluationDrafts,
    uploadFile: uploadExternalEvaluationFile,
    uploadDataUrl: uploadExternalEvaluationDataUrl,
    listFiles: listExternalEvaluationFiles,
    createSignedUrl: createExternalEvaluationSignedUrl,
    verifyStorage: verifyExternalEvaluationStorage
  };

  window.addEventListener('DOMContentLoaded', function(){
    if(getClient()) console.info('SmartSchoolSupabase bridge ready');
  });
})();
