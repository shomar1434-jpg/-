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
   // اسم المدرسة يجب أن يبقى فريدًا، أما بريد المدير فيجوز تكراره لدعم المجمعات التعليمية.
   const sameName=await admin.from('schools').select('id').eq('school_name',schoolName).limit(1);
   if(sameName.data?.length)return json({error:'اسم المدرسة مسجل مسبقًا'},409);

   // هوية المدير حساب واحد مشترك بين كل مدارسه، بينما الصلاحية/النطاق تحفظ في school_members.
   const existingUserQ=await admin.from('users').select('*').eq('email',managerEmail).eq('role','manager').limit(1).maybeSingle();
   if(existingUserQ.error)throw existingUserQ.error;
   let managerUser:any=existingUserQ.data||null;
   let createdAuthUserId='';
   if(!managerUser){
     const created=await admin.auth.admin.createUser({email:managerEmail,password,email_confirm:true,user_metadata:{full_name:managerName||schoolName,role:'manager'}});
     if(created.error)throw created.error;
     createdAuthUserId=clean(created.data.user?.id);
     const row:any={email:managerEmail,full_name:managerName||schoolName,role:'manager',status:'active',is_primary_manager:true,must_change_password:false};
     if(createdAuthUserId)row.id=createdAuthUserId;
     // school_id يحدد المدرسة الافتراضية القديمة فقط؛ تعدد المدارس يعتمد على school_members.
     row.school_id=null;
     let up=await admin.from('users').insert(row).select('*').single();
     if(up.error){
       // بعض المخططات القديمة تشترط school_id؛ نؤجل إنشاء المستخدم إلى ما بعد إنشاء المدرسة.
       managerUser={__pending:true,id:createdAuthUserId,email:managerEmail,full_name:managerName||schoolName,role:'manager',status:'active'};
     }else managerUser=up.data;
   }

   const si=await admin.from('schools').insert({school_name:schoolName,school_code:code('SCH'),manager_name:managerName,manager_email:managerEmail,status:'active',registration_code:code('REG')}).select('*').single();
   if(si.error){if(createdAuthUserId)await admin.auth.admin.deleteUser(createdAuthUserId);throw si.error}
   const school=si.data;

   if(managerUser?.__pending){
     const row:any={id:managerUser.id,email:managerEmail,full_name:managerName||schoolName,role:'manager',status:'active',school_id:school.id,is_primary_manager:true,must_change_password:false};
     const ins=await admin.from('users').insert(row).select('*').single();
     if(ins.error){if(createdAuthUserId)await admin.auth.admin.deleteUser(createdAuthUserId);await admin.from('schools').delete().eq('id',school.id);throw ins.error}
     managerUser=ins.data;
   }else if(managerUser && !clean(managerUser.school_id)){
     // تثبيت مدرسة افتراضية للحسابات التي يسمح مخططها بقيمة فارغة، دون تغييرها لاحقًا عند إضافة مدارس أخرى.
     await admin.from('users').update({school_id:school.id}).eq('id',managerUser.id).is('school_id',null);
     managerUser.school_id=school.id;
   }

   const membershipRow:any={school_id:school.id,user_id:managerUser.id,email:managerEmail,role:'manager',status:'active',is_primary_manager:true};
   let memberIns=await admin.from('school_members').insert(membershipRow);
   if(memberIns.error){
     // توافق مع مخططات أقدم تستخدم is_primary بدل is_primary_manager.
     delete membershipRow.is_primary_manager; membershipRow.is_primary=true;
     memberIns=await admin.from('school_members').insert(membershipRow);
   }
   if(memberIns.error){if(createdAuthUserId)await admin.auth.admin.deleteUser(createdAuthUserId);await admin.from('schools').delete().eq('id',school.id);throw memberIns.error}

   await audit(true,school.id,{schoolName,managerEmail,multiSchoolManager:true});return json({ok:true,school,managerUserId:managerUser.id});
  }
  if(action==='set_school_status'){const schoolId=clean(body.schoolId),status=clean(body.status);if(!schoolId||!['active','disabled','inactive','suspended'].includes(status))return json({error:'طلب غير صالح'},400);const r=await admin.from('schools').update({status}).eq('id',schoolId).select('*').single();if(r.error)throw r.error;await audit(true,schoolId,{status});return json({ok:true,school:r.data})}
  if(action==='delete_school'){
   const schoolId=clean(body.schoolId); if(!schoolId)return json({error:'معرف المدرسة مطلوب'},400);
   const confirmText=clean(body.confirmText); if(confirmText!=='DELETE')return json({error:'تأكيد الحذف غير صالح'},400);
   const schoolLookup=await admin.from('schools').select('id,school_name,manager_email').eq('id',schoolId).maybeSingle();
   if(schoolLookup.error)throw schoolLookup.error; if(!schoolLookup.data)return json({error:'المدرسة غير موجودة'},404);

   // اجمع الحسابات والملفات قبل حذف صف المدرسة لأن العلاقات قد تعمل ON DELETE CASCADE.
   const usersLookup=await admin.from('users').select('id,email').eq('school_id',schoolId);
   if(usersLookup.error)throw usersLookup.error;
   const schoolUsers=usersLookup.data||[];
   const filesLookup=await admin.from('platform_files').select('bucket_name,storage_path').eq('school_id',schoolId);
   const schoolFiles=filesLookup.error?[]:(filesLookup.data||[]);

   // حذف الكائنات الفعلية من Storage قبل حذف metadata المتسلسل.
   const storageWarnings:string[]=[];
   const byBucket=new Map<string,string[]>();
   for(const f of schoolFiles){const b=clean((f as any).bucket_name)||'school-platform-files';const path=clean((f as any).storage_path);if(!path)continue;if(!byBucket.has(b))byBucket.set(b,[]);byBucket.get(b)!.push(path)}
   for(const [bucket,paths] of byBucket.entries()){
    for(let i=0;i<paths.length;i+=100){const rm=await admin.storage.from(bucket).remove(paths.slice(i,i+100));if(rm.error)storageWarnings.push(bucket+': '+rm.error.message)}
   }

   // قبل حذف المدرسة: إذا كان مديرها يعمل في مدارس أخرى فلا نحذف هويته المشتركة.
   // وإذا كانت users.school_id تشير إلى المدرسة المحذوفة ننقل المدرسة الافتراضية إلى عضوية أخرى.
   const sharedUserIds=new Set<string>();
   for(const u of schoolUsers){
     const uid=clean((u as any).id); if(!uid)continue;
     const other=await admin.from('school_members').select('school_id').eq('user_id',uid).neq('school_id',schoolId).eq('status','active').limit(1).maybeSingle();
     if(!other.error&&other.data?.school_id){
       sharedUserIds.add(uid);
       await admin.from('users').update({school_id:other.data.school_id}).eq('id',uid);
     }
   }

   // حذف المدرسة من المصدر السحابي. الجداول المرتبطة ذات FK CASCADE تنظف تلقائيًا.
   const del=await admin.from('schools').delete().eq('id',schoolId).select('id');
   if(del.error)throw del.error; if(!del.data?.length)return json({error:'لم يتم حذف المدرسة'},409);

   // تنظيف حسابات Auth التابعة للمدرسة بعد إزالة سجلات public.users.
   let authDeleted=0; const authWarnings:string[]=[];
   for(const u of schoolUsers){const uid=clean((u as any).id);if(!uid||sharedUserIds.has(uid))continue;const r=await admin.auth.admin.deleteUser(uid);if(r.error)authWarnings.push(uid+': '+r.error.message);else authDeleted++}

   const details={schoolName:schoolLookup.data.school_name,managerEmail:schoolLookup.data.manager_email,usersFound:schoolUsers.length,authDeleted,filesFound:schoolFiles.length,storageWarnings,authWarnings};
   await audit(true,schoolId,details);
   return json({ok:true,deletedSchoolId:schoolId,details});
  }
  return json({error:'عملية غير مدعومة'},400);
 }catch(e){await audit(false,clean(body.schoolId),{message:String((e as any)?.message||e)});return json({error:'فشل تنفيذ العملية',details:String((e as any)?.message||e)},500)}
});
