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
    if(['health_advisor','موجه صحي','الموجه الصحي','قسم الموجه الصحي'].includes(role)) return 'health_advisor'; if(['kindergarten_teacher','معلمة رياض أطفال','معلمة رياض الأطفال','قسم معلمة رياض الأطفال'].includes(role)) return 'kindergarten_teacher'; if(['performance','teacher','معلم','قسم المعلم/المعلمة','قسم المعلم/المعلمة/ة'].includes(role)) return 'teacher';
    if(['student_advisor','advisor','موجه','موجه/موجهة طلابية','قسم الموجه'].includes(role)) return 'student_advisor';
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
      const loginLink = buildSchoolLinks(school).loginLink;
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
    const links=buildSchoolLinks(row);
    return {
      id: String(row.id||''),
      schoolId: String(row.id||''),
      schoolCode: String(row.school_code||row.id||''),
      schoolName: String(row.school_name||''),
      managerName: String(row.manager_name||''),
      managerEmail: String(row.manager_email||''),
      managerDisplayEmail: String(row.school_email||row.manager_email||''),
      status: String(row.status||'pending'),
      registrationCode: String(row.registration_code||''),
      registrationLink: links.registrationLink,
      loginLink: links.loginLink,
      createdAt: row.created_at||''
    };
  }

  function normalizeUser(row, school){
    if(!row) return null;
    const appRole = dbRoleToApp(row.role);
    const rawRoleLabel = String(row.role_label || '');
    const adminSupervisorMatch = rawRoleLabel.match(/^ADMIN_EMPLOYEE_SUPERVISOR:(manager|agent)$/i);
    const adminSupervisor = adminSupervisorMatch ? adminSupervisorMatch[1].toLowerCase() : '';
    const publicRoleLabel = adminSupervisor ? 'موظف/ة إداري/ة' : rawRoleLabel;
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
      createdAt: row.created_at || '',
      roleLabel: publicRoleLabel || '',
      role_label: publicRoleLabel || '',
      adminSupervisor: adminSupervisor
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
        email: String(payload.email || '').trim().toLowerCase(),
        microsoft_email: String(payload.microsoft_email || payload.microsoftEmail || payload.email || '').trim().toLowerCase(),
        microsoft_user_id: String(payload.microsoft_user_id || payload.microsoftUserId || payload.azureObjectId || '').trim().toLowerCase() || null,
        role: payload.role || 'manager',
        status: payload.status || 'active',
        is_primary_manager: !!payload.is_primary_manager
      };
      let q = await sb.from('school_members').insert(row).select('*').maybeSingle();
      if(q.error && /microsoft_email|microsoft_user_id|schema cache|column/i.test(String(q.error.message || q.error))){
        const legacyRow = {...row}; delete legacyRow.microsoft_email; delete legacyRow.microsoft_user_id;
        q = await sb.from('school_members').insert(legacyRow).select('*').maybeSingle();
      }
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
    const expectedId=String(payload.schoolId||'').trim();
    const expectedCode=String(payload.schoolCode||'').trim();
    const expectedReg=String(payload.registrationCode||'').trim();
    if(!expectedId && !expectedCode && !expectedReg) throw new Error('رابط التسجيل غير مرتبط بمدرسة.');

    let school=null;
    if(expectedId){
      const q=await sb.from('schools').select('*').eq('id',expectedId).maybeSingle();
      if(q.error) throw explainSupabaseError(q.error);
      school=q.data||null;
    }else if(expectedReg){
      const q=await sb.from('schools').select('*').eq('registration_code',expectedReg).limit(2);
      if(q.error) throw explainSupabaseError(q.error);
      if((q.data||[]).length===1) school=q.data[0];
    }else if(expectedCode){
      const q=await sb.from('schools').select('*').eq('school_code',expectedCode).limit(2);
      if(q.error) throw explainSupabaseError(q.error);
      if((q.data||[]).length===1) school=q.data[0];
    }
    if(!school) throw new Error('رابط التسجيل لا يطابق مدرسة فعالة. اطلب رابطًا جديدًا من مدير المدرسة.');
    if(['disabled','inactive','suspended','deleted'].includes(String(school.status||'active').toLowerCase())) throw new Error('هذه المدرسة غير مفعلة حاليًا.');

    const schoolId=String(school.id||'');
    const schoolCode=String(school.school_code||'');
    const registrationCode=String(school.registration_code||'');
    if(expectedId && expectedId!==schoolId) throw new Error('معرف المدرسة في رابط التسجيل غير مطابق.');
    if(expectedCode && expectedCode!==schoolCode) throw new Error('رمز المدرسة في رابط التسجيل غير مطابق.');
    if(expectedReg && expectedReg!==registrationCode) throw new Error('رمز التسجيل في الرابط غير مطابق للمدرسة.');
    const dbRole=appRoleToDb(payload.role);
    const isAdministrativeEmployee=dbRole==='administrative_employee'||dbRole==='admin_employee';
    const supervisor=(String(payload.adminSupervisor||payload.supervisor||'').toLowerCase()==='agent')?'agent':'manager';

    const {data:existing} = await sb.from('users').select('*').eq('email',payload.email).eq('school_id',schoolId).maybeSingle();
    let user=existing||null;
    if(user){
      if(String(user.role||'')!==dbRole) throw new Error('يوجد حساب سابق بنفس البريد داخل هذه المدرسة بدور مختلف');
      if(String(user.status||'')==='deleted'){
        const q=await sb.from('users').update({status:'pending',active:false,full_name:payload.name||user.full_name||'',password:payload.password||user.password||''}).eq('id',user.id).select('*').single();
        if(q.error) throw explainSupabaseError(q.error); user=q.data;
      }
    }else{
      user = await insertUser({
        school_id: schoolId,
        full_name: payload.name || payload.fullName || '',
        email: payload.email || '',
        password: payload.password || '',
        role: dbRole,
        status: 'pending',
        active: false,
        is_primary_manager: false,
        must_change_password: false
      });
    }

    // الموظف الإداري لا يعتمد على users.school_id وحده؛ ننشئ عضوية صريحة للمدرسة
    // ونحفظ جهة الإشراف داخل role_label كعلامة تقنية غير معروضة للمستخدم.
    if(isAdministrativeEmployee && user && user.id){
      const marker='ADMIN_EMPLOYEE_SUPERVISOR:'+supervisor;
      const found=await sb.from('school_members').select('*').eq('school_id',schoolId).eq('user_id',user.id).eq('role','administrative_employee').maybeSingle();
      if(found.error) throw explainSupabaseError(found.error);
      if(found.data){
        const q=await sb.from('school_members').update({email:payload.email||user.email,role_label:marker,status:'pending',updated_at:new Date().toISOString()}).eq('id',found.data.id).select('*').single();
        if(q.error) throw explainSupabaseError(q.error);
      }else{
        const row={school_id:schoolId,user_id:user.id,email:payload.email||user.email,role:'administrative_employee',role_label:marker,status:'pending',is_primary:false,is_primary_manager:false,updated_at:new Date().toISOString()};
        let q=await sb.from('school_members').insert(row).select('*').single();
        if(q.error){
          const legacy={school_id:schoolId,user_id:user.id,email:payload.email||user.email,role:'administrative_employee',status:'pending',is_primary_manager:false};
          q=await sb.from('school_members').insert(legacy).select('*').single();
        }
        if(q.error) throw explainSupabaseError(q.error);
      }
    }
    return normalizeUser(Object.assign({},user,isAdministrativeEmployee?{role_label:'ADMIN_EMPLOYEE_SUPERVISOR:'+supervisor}:{}), school);
  }

  async function listUsersBySchool(schoolId){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const [{data:direct,error:de},{data:members,error:me}] = await Promise.all([
      sb.from('users').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}),
      sb.from('school_members').select('*').eq('school_id',schoolId)
    ]);
    if(de) throw explainSupabaseError(de); if(me) throw explainSupabaseError(me);
    const identities=new Map((direct||[]).map(u=>[String(u.id),u]));
    const ids=[...new Set((members||[]).map(m=>String(m.user_id||'')).filter(Boolean))];
    if(ids.length){const q=await sb.from('users').select('*').in('id',ids);if(q.error)throw explainSupabaseError(q.error);(q.data||[]).forEach(u=>identities.set(String(u.id),u));}
    const out=new Map();
    (direct||[]).forEach(u=>out.set(String(u.id),normalizeUser(u)));
    for(const m of members||[]){if(String(m.status||'active')==='deleted')continue;const u=identities.get(String(m.user_id||''));if(!u)continue;out.set(String(u.id),normalizeUser(Object.assign({},u,{school_id:schoolId,role:m.role||u.role,role_label:m.role_label||'',status:m.status||u.status}),null));}
    return [...out.values()];
  }

  async function listAdministrativeEmployeesBySchool(schoolId,supervisor){
    const sb=getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const sup=String(supervisor||'').toLowerCase();
    const mq=await sb.from('school_members').select('*').eq('school_id',schoolId).in('role',['administrative_employee','admin_employee']).neq('status','deleted');
    if(mq.error) throw explainSupabaseError(mq.error);
    const members=(mq.data||[]).filter(m=>{
      if(!sup)return true;
      const marker=String(m.role_label||'').match(/^ADMIN_EMPLOYEE_SUPERVISOR:(manager|agent)$/i);
      const owner=marker?marker[1].toLowerCase():'manager';return owner===sup;
    });
    const ids=[...new Set(members.map(m=>String(m.user_id||'')).filter(Boolean))];
    let identities=new Map();
    if(ids.length){const uq=await sb.from('users').select('*').in('id',ids);if(uq.error)throw explainSupabaseError(uq.error);(uq.data||[]).forEach(u=>identities.set(String(u.id),u));}
    const out=members.map(m=>{const u=identities.get(String(m.user_id||''))||{};return normalizeUser(Object.assign({},u,{id:m.user_id||u.id,email:m.email||u.email,school_id:schoolId,role:'administrative_employee',role_label:m.role_label||'',status:m.status||u.status||'pending'}),null);}).filter(Boolean);
    // دعم السجلات القديمة التي أنشئت قبل school_members، بشرط أن يكون دور users نفسه إداريًا صريحًا.
    const legacy=await sb.from('users').select('*').eq('school_id',schoolId).in('role',['administrative_employee','admin_employee']).neq('status','deleted');
    if(legacy.error) throw explainSupabaseError(legacy.error);
    const seen=new Set(out.map(x=>String(x.id||x.email)));
    for(const u of legacy.data||[]){if(sup&&sup!=='manager')continue;if(seen.has(String(u.id||u.email)))continue;const n=normalizeUser(u,null);if(n)out.push(n);}
    return out;
  }

  async function removeAdministrativeEmployee(payload){
    const sb=getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const schoolId=String(payload.schoolId||payload.school_id||'').trim();
    const userId=String(payload.userId||payload.user_id||'').trim();
    const email=String(payload.email||'').trim().toLowerCase();
    const expectedSupervisor=String(payload.supervisor||payload.adminSupervisor||'').trim().toLowerCase();
    if(!schoolId||(!userId&&!email)) throw new Error('بيانات الموظف الإداري غير مكتملة');
    if(expectedSupervisor){
      let check=sb.from('school_members').select('id,role_label').eq('school_id',schoolId).in('role',['administrative_employee','admin_employee']);
      check=userId?check.eq('user_id',userId):check.eq('email',email);
      const cq=await check.limit(1).maybeSingle();if(cq.error)throw explainSupabaseError(cq.error);
      if(!cq.data)throw new Error('عضوية الموظف الإداري غير موجودة في المدرسة');
      const marker=String(cq.data.role_label||'').match(/^ADMIN_EMPLOYEE_SUPERVISOR:(manager|agent)$/i);
      const actual=marker?marker[1].toLowerCase():'manager';
      if(actual!==expectedSupervisor)throw new Error('هذا الموظف الإداري يتبع مسؤولاً مباشرًا آخر');
    }
    let membershipQ=sb.from('school_members').delete().eq('school_id',schoolId).in('role',['administrative_employee','admin_employee']);
    membershipQ=userId?membershipQ.eq('user_id',userId):membershipQ.eq('email',email);
    const membershipResult=await membershipQ;
    if(membershipResult.error) throw explainSupabaseError(membershipResult.error);

    let user=null;
    if(userId){const q=await sb.from('users').select('*').eq('id',userId).maybeSingle();if(q.error)throw explainSupabaseError(q.error);user=q.data;}
    else if(email){const q=await sb.from('users').select('*').eq('email',email).eq('school_id',schoolId).maybeSingle();if(q.error)throw explainSupabaseError(q.error);user=q.data;}
    if(user && ['administrative_employee','admin_employee'].includes(String(user.role||'').toLowerCase())){
      const other=await sb.from('school_members').select('school_id,role,status').eq('user_id',user.id).neq('status','deleted').limit(1).maybeSingle();
      if(other.error) throw explainSupabaseError(other.error);
      if(other.data){
        const q=await sb.from('users').update({school_id:other.data.school_id,role:other.data.role,status:'active',active:true}).eq('id',user.id);
        if(q.error) throw explainSupabaseError(q.error);
      }else{
        const q=await sb.from('users').delete().eq('id',user.id);
        if(q.error) throw explainSupabaseError(q.error);
      }
    }
    return true;
  }


  async function updateAdministrativeEmployeeStatus(payload){
    const sb=getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const schoolId=String(payload.schoolId||payload.school_id||'').trim();
    const userId=String(payload.userId||payload.user_id||'').trim();
    const status=String(payload.status||'').trim();
    const expectedSupervisor=String(payload.supervisor||payload.adminSupervisor||'').trim().toLowerCase();
    if(!schoolId||!userId||!['pending','active','disabled'].includes(status)) throw new Error('بيانات تفعيل الموظف الإداري غير مكتملة');
    const mq=await sb.from('school_members').select('id,role,role_label').eq('school_id',schoolId).eq('user_id',userId).in('role',['administrative_employee','admin_employee']).maybeSingle();
    if(mq.error) throw explainSupabaseError(mq.error); if(!mq.data) throw new Error('عضوية الموظف الإداري غير موجودة في هذه المدرسة');
    if(expectedSupervisor){const marker=String(mq.data.role_label||'').match(/^ADMIN_EMPLOYEE_SUPERVISOR:(manager|agent)$/i);const actual=marker?marker[1].toLowerCase():'manager';if(actual!==expectedSupervisor)throw new Error('هذا الموظف الإداري يتبع مسؤولاً مباشرًا آخر');}
    const m=await sb.from('school_members').update({status,updated_at:new Date().toISOString()}).eq('id',mq.data.id);if(m.error)throw explainSupabaseError(m.error);
    const u=await sb.from('users').update({status,active:status==='active'}).eq('id',userId);if(u.error)throw explainSupabaseError(u.error);
    return true;
  }

  async function updateUserStatus(userId,status){
    const sb = getClient();
    if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error} = await sb.from('users').update({
      status,
      active: status === 'active'
    }).eq('id',userId).select('*').single();
    if(error) throw explainSupabaseError(error);
    try{
      const sid=localStorage.getItem('active_school_id')||localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||'';
      if(sid) await sb.from('school_members').update({status,updated_at:new Date().toISOString()}).eq('school_id',sid).eq('user_id',userId);
    }catch(e){console.warn('تعذر مزامنة حالة عضوية المدرسة',e)}
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
      if(!scoped.length && rows.length){
        const baseCandidate = rows[0];
        let member = null;
        try{
          let mq = await sb.from('school_members').select('*').eq('school_id',wantedSchool).eq('email',email).neq('status','inactive').limit(1).maybeSingle();
          if(mq && mq.data) member = mq.data;
        }catch(e){}
        if(!member && baseCandidate && baseCandidate.id){
          try{const mq2=await sb.from('school_members').select('*').eq('school_id',wantedSchool).eq('user_id',baseCandidate.id).neq('status','inactive').limit(1).maybeSingle();if(mq2&&mq2.data)member=mq2.data}catch(e){}
        }
        let schoolOverride = null;
        if(member){try{const sq=await sb.from('schools').select('*').eq('id',wantedSchool).maybeSingle();if(sq&&sq.data)schoolOverride=sq.data}catch(e){}
          scoped=[Object.assign({},baseCandidate,{id:member.user_id||baseCandidate.id,school_id:wantedSchool,role:member.role||baseCandidate.role,role_label:member.role_label||'',__membershipId:member.id,__schoolOverride:schoolOverride})];
        }else if(String(baseCandidate.role||'')==='manager'){
          try{const schByEmail=await sb.from('schools').select('*').eq('id',wantedSchool).eq('manager_email',email).maybeSingle();if(schByEmail&&schByEmail.data)scoped=[Object.assign({},baseCandidate,{school_id:wantedSchool,role:'manager',is_primary_manager:true,__schoolOverride:schByEmail.data})]}catch(e){}
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


  async function registerExternalAccess(payload){
    const sb=getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error}=await sb.rpc('register_school_external_access',{
      p_token:String(payload.token||''),
      p_school_id:payload.school_id||payload.schoolId,
      p_access_type:payload.access_type||payload.accessType,
      p_created_by:payload.created_by||payload.createdBy,
      p_visit_number:payload.visit_number||payload.visitNumber||null,
      p_permissions:payload.permissions||{},
      p_metadata:payload.metadata||{},
      p_status:payload.status||'active',
      p_expires_at:payload.expires_at||payload.expiresAt||null
    });
    if(error) throw explainSupabaseError(error); return data;
  }
  async function validateExternalAccess(token,accessType){
    const sb=getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error}=await sb.rpc('validate_school_external_access',{p_token:String(token||''),p_access_type:String(accessType||'')});
    if(error) throw explainSupabaseError(error); return Array.isArray(data)?(data[0]||null):data;
  }
  async function revokeExternalAccess(payload){
    const sb=getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error}=await sb.rpc('revoke_school_external_access',{
      p_token:String(payload.token||''),p_school_id:payload.school_id||payload.schoolId,p_revoked_by:payload.revoked_by||payload.revokedBy
    });
    if(error) throw explainSupabaseError(error); return !!data;
  }
  async function listExternalVisitUsers(token){
    const sb=getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error}=await sb.rpc('list_external_visit_users',{p_token:String(token||'')});
    if(error) throw explainSupabaseError(error);
    return (data||[]).map(function(u){
      return Object.assign({},u,{name:u.name||u.full_name||'',full_name:u.full_name||u.name||'',isActive:String(u.status||'active')==='active',active:String(u.status||'active')==='active'});
    });
  }
  window.SmartSchoolSupabase = {
    getClient,
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
    listAdministrativeEmployeesBySchool,
    removeAdministrativeEmployee,
    updateAdministrativeEmployeeStatus,
    updateUserStatus,
    upsertSchoolUser,
    loginSchoolUser,
    deleteSchool,
    deleteUser,
    login: loginSchoolUser,
    signIn: loginSchoolUser,
    schoolLogin: loginSchoolUser,
    registerExternalAccess,
    validateExternalAccess,
    revokeExternalAccess,
    listExternalVisitUsers
  };

  window.addEventListener('DOMContentLoaded', function(){
    if(getClient()) console.info('SmartSchoolSupabase bridge ready');
  });
})();
