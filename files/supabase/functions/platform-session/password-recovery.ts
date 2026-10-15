// RL239: Auth owns recovered passwords; legacy profile/member UUIDs stay unchanged.
export const RECOVERY_MANAGED = 'platform_password_recovery_managed';
const emailOf=(v:unknown)=>String(v??'').trim().toLowerCase();
const validId=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
export async function handlePasswordRecovery({action,body,request,admin,authClient,origin,requestId}:any){
 if(!['request-password-recovery','complete-password-recovery'].includes(action))return null;
 const response=(b:any,status=200)=>({body:{...b,requestId},status});
 if(!authClient)return response({error:'خدمة استعادة الرقم السري غير مهيأة',code:'RECOVERY_ENV_MISSING'},503);
 if(action==='request-password-recovery'){
  const email=emailOf(body.email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return response({error:'أدخل بريدًا إلكترونيًا صحيحًا',code:'RECOVERY_EMAIL_INVALID'},400);
  // Never let a caller choose a destination outside the deployed login origin/path.
  let redirect:URL;try{redirect=new URL(body.redirectTo);const allowed=new URL(origin);if(redirect.origin!==allowed.origin||redirect.pathname!==allowed.pathname||redirect.username||redirect.password)throw Error();redirect.hash='';}catch{return response({error:'رابط العودة غير معتمد',code:'RECOVERY_REDIRECT_INVALID'},400)}
  const profiles=await admin.from('users').select('id,email').ilike('email',email).limit(2);if(profiles.error)throw profiles.error;
  const profile=profiles.data?.length===1?profiles.data[0]:null;
  if(profile){
   if(!validId(profile.id))return response({error:'تعذر تهيئة الاستعادة. تواصل مع إدارة المنصة',code:'RECOVERY_IDENTITY_CONFLICT'},503);
   const existing=await admin.auth.admin.getUserById(profile.id);
   if(existing.error&&existing.error.status!==404&&existing.error.code!=='user_not_found')throw existing.error;
   if(existing.data?.user&&emailOf(existing.data.user.email)!==email)return response({error:'تعذر تهيئة الاستعادة. تواصل مع إدارة المنصة',code:'RECOVERY_IDENTITY_CONFLICT'},503);
   if(!existing.data?.user){
    // No activation, role grant, UUID replacement, or imported legacy password.
    // The unknown random password cannot be used before the mailbox is proved.
    const created=await admin.auth.admin.createUser({id:profile.id,email,password:crypto.randomUUID()+crypto.randomUUID(),email_confirm:false});
    if(created.error){
     // A concurrent request may have provisioned the same identity; accept only an exact match.
     const retry=await admin.auth.admin.getUserById(profile.id);
     if(!retry.data?.user||emailOf(retry.data.user.email)!==email)return response({error:'تعذر تهيئة الاستعادة. تواصل مع إدارة المنصة',code:'RECOVERY_IDENTITY_CONFLICT'},503);
    }else if(String(created.data?.user?.id)!==String(profile.id))throw new Error('RECOVERY_UUID_NOT_PRESERVED');
   }
  }
  // Auth handles email delivery, anti-enumeration and recovery-token expiry.
  const sent=await authClient.auth.resetPasswordForEmail(email,{redirectTo:redirect.href});
  if(sent.error){console.warn('[password-recovery]',requestId,'delivery_failed',sent.error.code||sent.error.status);return response({error:sent.error.status===429?'طلبات الاستعادة متكررة. انتظر قليلًا ثم أعد المحاولة.':'تعذر إرسال رابط الاستعادة من خدمة البريد. تواصل مع إدارة المنصة.',code:sent.error.status===429?'RECOVERY_RATE_LIMIT':'RECOVERY_EMAIL_DELIVERY_FAILED'},sent.error.status===429?429:502)}
  return response({ok:true,message:'إذا كان البريد مسجلًا فسيصلك رابط الاستعادة. افحص البريد غير الهام أيضًا.'});
 }
 const token=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const verified=token?await admin.auth.getUser(token):null;
 if(!verified?.data?.user||verified.error)return response({error:'انتهت صلاحية رابط الاستعادة. اطلب رابطًا جديدًا.',code:'RECOVERY_SESSION_INVALID'},401);
 const user=verified.data.user,password=String(body.password??'');
 if(password.length<8||password.length>128)return response({error:'يجب أن يكون الرقم السري بين 8 و128 حرفًا.',code:'RECOVERY_PASSWORD_INVALID'},400);
 const profile=await admin.from('users').select('id,email').eq('id',user.id).maybeSingle();if(profile.error)throw profile.error;
 if(profile.data&&emailOf(profile.data.email)!==emailOf(user.email))return response({error:'تعذر مطابقة الحساب',code:'RECOVERY_IDENTITY_CONFLICT'},409);
 // Password and the authoritative-login marker are updated in the same Auth call.
 const update=await admin.auth.admin.updateUserById(user.id,{password,app_metadata:{...(user.app_metadata||{}),[RECOVERY_MANAGED]:true}});
 if(update.error)return response({error:'تعذر حفظ الرقم السري الجديد.',code:'RECOVERY_PASSWORD_UPDATE_FAILED'},502);
 const revoke=await admin.from('platform_sessions').update({status:'revoked',revoked_at:new Date().toISOString()}).eq('user_id',user.id).eq('status','active');
 if(revoke.error)throw new Error('RECOVERY_SESSION_REVOKE_FAILED');
 const logout=await admin.auth.admin.signOut(token,'global');if(logout.error)throw new Error('RECOVERY_AUTH_SIGNOUT_FAILED');
 return response({ok:true,message:'تم تغيير الرقم السري. سجّل الدخول بالرقم الجديد.'});
}
export async function legacyRecoveryGate(admin:any,profiles:any[],authUser:any){
 if(authUser)return false;
 for(const profile of profiles){
  if(!validId(profile.id))continue;
  const result=await admin.auth.admin.getUserById(profile.id);
  if(result.error&&result.error.status!==404&&result.error.code!=='user_not_found')throw result.error;
  if(result.data?.user?.app_metadata?.[RECOVERY_MANAGED]===true)return true;
 }
 return false;
}
