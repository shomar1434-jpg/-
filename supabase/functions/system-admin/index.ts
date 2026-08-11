import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(v:unknown)=>String(v??'').trim(); const email=(v:unknown)=>clean(v).toLowerCase(); const code=(p:string)=>p+'-'+crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors}); if(req.method!=='POST') return json({error:'طريقة الطلب غير مدعومة'},405);
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY'); if(!url||!service||!anon)return json({error:'إعدادات الخادم غير مكتملة'},500);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim(); if(!token)return json({error:'يلزم تسجيل الدخول'},401);
 const authClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}); const ur=await authClient.auth.getUser(token); const user=ur.data?.user; if(ur.error||!user)return json({error:'جلسة الدخول غير صالحة'},401);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}); const allowed=await admin.from('system_admins').select('user_id,email,is_active').eq('user_id',user.id).eq('is_active',true).maybeSingle(); if(allowed.error||!allowed.data)return json({error:'ليس لديك صلاحية مدير النظام'},403);
 const body=await req.json().catch(()=>({})); const action=clean(body.action);
 const audit=async(ok:boolean,target?:string,details?:unknown)=>{try{await admin.from('system_admin_audit_log').insert({admin_user_id:user.id,admin_email:user.email||allowed.data?.email||null,action,target_school_id:target||null,success:ok,details:details||{}})}catch(_){}};
 try{
  if(action==='verify'){await audit(true);return json({ok:true,user:{id:user.id,email:user.email}})}
  if(action==='list_schools'){const r=await admin.from('schools').select('*').order('created_at',{ascending:false}).limit(1000);if(r.error)throw r.error;await audit(true);return json({ok:true,schools:r.data||[]})}
  if(action==='create_school'){
   const schoolName=clean(body.schoolName),managerName=clean(body.managerName),managerEmail=email(body.email),password=clean(body.password); if(!schoolName||!managerEmail||password.length<8)return json({error:'اسم المدرسة والبريد وكلمة مرور من 8 أحرف على الأقل مطلوبة'},400);
   const ex=await admin.from('schools').select('id').or(`manager_email.eq.${managerEmail},school_name.eq.${schoolName}`).limit(1);if(ex.data?.length)return json({error:'المدرسة أو بريد المدير مسجل مسبقًا'},409);
   const si=await admin.from('schools').insert({school_name:schoolName,school_code:code('SCH'),manager_name:managerName,manager_email:managerEmail,status:'active',registration_code:code('REG')}).select('*').single();if(si.error)throw si.error;const school=si.data;
   const created=await admin.auth.admin.createUser({email:managerEmail,password,email_confirm:true,user_metadata:{full_name:managerName||schoolName,school_id:school.id,role:'manager'}});if(created.error){await admin.from('schools').delete().eq('id',school.id);throw created.error} const authUserId=created.data.user?.id;
   const row:any={email:managerEmail,full_name:managerName||schoolName,role:'manager',status:'active',school_id:school.id,is_primary_manager:true,must_change_password:false};if(authUserId)row.id=authUserId;const up=await admin.from('users').upsert(row,{onConflict:'email'});if(up.error){if(authUserId)await admin.auth.admin.deleteUser(authUserId);await admin.from('schools').delete().eq('id',school.id);throw up.error}
   await audit(true,school.id,{schoolName,managerEmail});return json({ok:true,school});
  }
  if(action==='set_school_status'){const schoolId=clean(body.schoolId),status=clean(body.status);if(!schoolId||!['active','disabled','inactive','suspended'].includes(status))return json({error:'طلب غير صالح'},400);const r=await admin.from('schools').update({status}).eq('id',schoolId).select('*').single();if(r.error)throw r.error;await audit(true,schoolId,{status});return json({ok:true,school:r.data})}
  if(action==='delete_school')return json({error:'الحذف النهائي معطل أمنيًا. استخدم التعطيل أولًا ثم إجراء التنظيف المراجع.'},403);
  return json({error:'عملية غير مدعومة'},400);
 }catch(e){await audit(false,clean(body.schoolId),{message:String((e as any)?.message||e)});return json({error:'فشل تنفيذ العملية',details:String((e as any)?.message||e)},500)}
});
