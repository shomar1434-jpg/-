import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type,x-platform-session','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const t=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n), low=(v:unknown)=>t(v).toLowerCase();
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const hmacHex=async(secret:string,msg:string)=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(msg));return Array.from(new Uint8Array(sig)).map(x=>x.toString(16).padStart(2,'0')).join('')};
const managers=new Set(['manager','owner','school_manager','principal','leadership','مدير','مديرة','مدير المدرسة','مديرة المدرسة']);
const agents=new Set(['agent','deputy','vice','wakil','agency','وكيل','وكيلة']);
const allowedRegistrationRoles=new Set(['agent','teacher','student_advisor','activity_leader','kindergarten_teacher','health_advisor','administrative_employee']);
const REGISTRATION_CONTRACT_VERSION='RL87-owner-manager-split-v1';
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors}); if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!service)return json({error:'ENV_MISSING'},500);
 const sb=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),requestId=crypto.randomUUID();
 const adminLinkToken=async(schoolId:string,supervisorUserId:string,supervisorRole:string,exp:number)=>`${exp}.${await hmacHex(service,`${schoolId}|${supervisorUserId}|${supervisorRole}|${exp}`)}`;
 const verifyAdminLinkToken=async(token:string,schoolId:string,supervisorUserId:string,supervisorRole:string)=>{const [expRaw,sig]=String(token||'').split('.');const exp=Number(expRaw);if(!Number.isFinite(exp)||Date.now()>exp||!sig)return false;const expected=await hmacHex(service,`${schoolId}|${supervisorUserId}|${supervisorRole}|${exp}`);if(expected.length!==sig.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^sig.charCodeAt(i);return diff===0};
 const generalLinkToken=async(schoolId:string,managerUserId:string,exp:number)=>`${exp}.${await hmacHex(service,`GENERAL|${schoolId}|${managerUserId}|${exp}`)}`;
 const verifyGeneralLinkToken=async(token:string,schoolId:string,managerUserId:string)=>{const [expRaw,sig]=String(token||'').split('.');const exp=Number(expRaw);if(!Number.isFinite(exp)||Date.now()>exp||!sig)return false;const expected=await hmacHex(service,`GENERAL|${schoolId}|${managerUserId}|${exp}`);if(expected.length!==sig.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^sig.charCodeAt(i);return diff===0};
 try{
  const body:any=await req.json().catch(()=>({})),action=t(body.action,80);
  if(action==='registration-contract-version')return json({ok:true,version:REGISTRATION_CONTRACT_VERSION,requestId});
  const findSchool=async()=>{
   const sid=t(body.schoolId,100),scode=t(body.schoolCode,100),reg=t(body.registrationCode,160);let q:any=null;
   if(sid)q=await sb.from('schools').select('*').eq('id',sid).maybeSingle();else if(reg)q=await sb.from('schools').select('*').eq('registration_code',reg).limit(2);else if(scode)q=await sb.from('schools').select('*').eq('school_code',scode).limit(2);else return null;
   if(q.error)throw q.error;let row=Array.isArray(q.data)?(q.data.length===1?q.data[0]:null):q.data;if(!row)return null;
   if(sid&&String(row.id)!==sid)return null;if(scode&&t(row.school_code)!==scode)return null;if(reg&&t(row.registration_code)!==reg)return null;
   if(['disabled','inactive','suspended','deleted'].includes(low(row.status)))return null;return row;
  };
  if(action==='inspect-school'){
   const school=await findSchool();if(!school)return json({error:'SCHOOL_NOT_FOUND'},404);return json({ok:true,school:{id:school.id,school_id:school.id,school_name:school.school_name,school_code:school.school_code,status:school.status,school_edition:school.school_edition||'public'},contractVersion:REGISTRATION_CONTRACT_VERSION,requestId});
  }
  if(action==='register-user'){
   const registrationCode=t(body.registrationCode,160);
   if(!registrationCode)return json({error:'REGISTRATION_TOKEN_REQUIRED'},403);
   const school=await findSchool();if(!school||t(school.registration_code,160)!==registrationCode)return json({error:'REGISTRATION_LINK_INVALID'},403);
   const schoolId=String(school.id),role=low(body.role),email=low(body.email),name=t(body.name,300),password=t(body.password,300),source=t(body.registrationSource,100);
   if(!allowedRegistrationRoles.has(role)||!email||!name||password.length<4)return json({error:'REGISTRATION_FIELDS_INVALID'},400);
   let supervisorUserId=t(body.supervisorUserId,100),supervisorRole=low(body.adminSupervisor||body.supervisor);
   if(role==='administrative_employee'){
    const adminRegistrationToken=t(body.adminRegistrationToken||body.adminToken,500);
    if(source!=='administrative_employee_link'||!supervisorUserId||!['manager','agent'].includes(supervisorRole)||!(await verifyAdminLinkToken(adminRegistrationToken,schoolId,supervisorUserId,supervisorRole)))return json({error:'ADMIN_REGISTRATION_LINK_INVALID_OR_EXPIRED'},403);
    const sq=await sb.from('school_members').select('user_id,role,status').eq('school_id',schoolId).eq('user_id',supervisorUserId).eq('status','active');if(sq.error)throw sq.error;
    const roles=(sq.data||[]).map((x:any)=>low(x.role));if(!roles.includes(supervisorRole))return json({error:'ADMIN_SUPERVISOR_NOT_AUTHORIZED'},403);
   } else {
    const managerUserId=t(body.managerUserId||body.manager_user_id,100),generalRegistrationToken=t(body.generalRegistrationToken||body.generalToken,500);
    const hasManagerUserId=!!managerUserId,hasManagerToken=!!generalRegistrationToken;
    // RL87 ROOT CONTRACT:
    // owner/system permanent link has NO manager signature fields. Its trust proof is the exact active school contract.
    // manager link has BOTH managerUserId + generalRegistrationToken and must pass HMAC + active manager membership.
    // a half signature is corrupt and is never downgraded to owner mode.
    if(hasManagerUserId!==hasManagerToken)return json({error:'MANAGER_REGISTRATION_SIGNATURE_INCOMPLETE',contractVersion:REGISTRATION_CONTRACT_VERSION},403);
    if(hasManagerUserId&&hasManagerToken){
     if(!(await verifyGeneralLinkToken(generalRegistrationToken,schoolId,managerUserId)))return json({error:'MANAGER_REGISTRATION_LINK_INVALID_OR_EXPIRED',contractVersion:REGISTRATION_CONTRACT_VERSION},403);
     const mq0=await sb.from('school_members').select('user_id,role,status').eq('school_id',schoolId).eq('user_id',managerUserId).eq('status','active');if(mq0.error)throw mq0.error;
     const managerRoles=(mq0.data||[]).map((x:any)=>low(x.role));
     if(!managerRoles.some((r:string)=>managers.has(r)))return json({error:'GENERAL_REGISTRATION_REQUIRES_MANAGER',contractVersion:REGISTRATION_CONTRACT_VERSION},403);
    }
    supervisorUserId='';supervisorRole='';
   }
   let uq=await sb.from('users').select('*').eq('email',email).limit(1).maybeSingle();if(uq.error)throw uq.error;let user:any=uq.data||null;
   if(user&&t(user.password)&&t(user.password)!==password)return json({error:'EXISTING_IDENTITY_PASSWORD_MISMATCH'},409);
   if(!user){const ins=await sb.from('users').insert({school_id:schoolId,full_name:name,email,password,role,status:'pending',active:false}).select('*').single();if(ins.error)throw ins.error;user=ins.data}
   let mq=await sb.from('school_members').select('*').eq('school_id',schoolId).eq('user_id',user.id).eq('role',role).maybeSingle();if(mq.error)throw mq.error;
   const roleLabel=role==='administrative_employee'?`ADMIN_EMPLOYEE_SUPERVISOR:${supervisorRole}`:null;
   if(mq.data){const up=await sb.from('school_members').update({email,role_label:roleLabel,supervisor_user_id:supervisorUserId||null,status:'pending',updated_at:new Date().toISOString()}).eq('id',mq.data.id).select('*').single();if(up.error)throw up.error;mq=up}else{const ins=await sb.from('school_members').insert({school_id:schoolId,user_id:user.id,email,role,status:'pending',role_label:roleLabel,supervisor_user_id:supervisorUserId||null}).select('*').single();if(ins.error)throw ins.error;mq=ins}
   return json({ok:true,user:{id:user.id,email,full_name:name},membership:mq.data,school:{id:schoolId,school_name:school.school_name},contractVersion:REGISTRATION_CONTRACT_VERSION,requestId});
  }

  const raw=t(req.headers.get('x-platform-session'),600);if(!raw)return json({error:'SESSION_MISSING',requestId},401);const h=await sha256(raw),now=new Date().toISOString();const ss=await sb.from('platform_sessions').select('*').eq('session_token_hash',h).eq('status','active').gt('expires_at',now).maybeSingle();if(ss.error)throw ss.error;const s:any=ss.data;if(!s)return json({error:'SESSION_INVALID',requestId},401);
  const schoolId=String(s.school_id),userId=String(s.user_id),role=low(s.role),isManager=managers.has(role),isAgent=agents.has(role);
  const membership=await sb.from('school_members').select('*').eq('school_id',schoolId).eq('user_id',userId).eq('status','active');if(membership.error)throw membership.error;const roles=(membership.data||[]).map((x:any)=>low(x.role));if(!roles.includes(role)&&!isManager)return json({error:'MEMBERSHIP_ROLE_MISMATCH',requestId},403);
  const schoolQ=await sb.from('schools').select('id,school_name,school_code,status,school_edition').eq('id',schoolId).maybeSingle();if(schoolQ.error)throw schoolQ.error;if(!schoolQ.data)return json({error:'SCHOOL_NOT_FOUND'},404);
  const ownUser=async()=>{const q=await sb.from('users').select('id,full_name,email,role,status,active').eq('id',userId).maybeSingle();if(q.error)throw q.error;return q.data};
  const supervisorOwns=async(target:any)=>{
    if(!target)return false;if(String(target.supervisor_user_id||'')===userId)return true;
    if(target.supervisor_user_id)return false;
    const mm=String(target.role_label||'').match(/^ADMIN_EMPLOYEE_SUPERVISOR:(manager|agent)$/i),kind=mm?mm[1].toLowerCase():'manager';if((kind==='manager'&&!isManager)||(kind==='agent'&&!isAgent))return false;
    // Legacy safe recovery is allowed only when exactly one active supervisor of this role exists in the school.
    const q=await sb.from('school_members').select('user_id').eq('school_id',schoolId).eq('role',kind).eq('status','active');if(q.error)throw q.error;const ids=[...new Set((q.data||[]).map((x:any)=>String(x.user_id||'')).filter(Boolean))];if(ids.length!==1||ids[0]!==userId)return false;
    const up=await sb.from('school_members').update({supervisor_user_id:userId,updated_at:now}).eq('id',target.id).is('supervisor_user_id',null);if(up.error)throw up.error;return true;
  };
  if(action==='health')return json({ok:true,version:'1.2.0-RL86-registration-contract-v2',schoolId,userId,role,requestId});
  if(action==='school-registration-context'){
   if(!isManager&&!isAgent)return json({error:'SUPERVISOR_REQUIRED'},403);
   const full=await sb.from('schools').select('id,school_name,school_code,registration_code,status').eq('id',schoolId).maybeSingle();if(full.error)throw full.error;if(!full.data)return json({error:'SCHOOL_NOT_FOUND'},404);
   const sr=isAgent?'agent':'manager',exp=Date.now()+24*60*60*1000,adminRegistrationToken=await adminLinkToken(schoolId,userId,sr,exp);
   let generalRegistrationToken='',generalRegistrationOwnerUserId='',generalRegistrationExpiresAt='';
   if(isManager){const gexp=Date.now()+24*60*60*1000;generalRegistrationToken=await generalLinkToken(schoolId,userId,gexp);generalRegistrationOwnerUserId=userId;generalRegistrationExpiresAt=new Date(gexp).toISOString();}
   return json({ok:true,school:full.data,supervisorUserId:userId,supervisorRole:sr,adminRegistrationToken,adminRegistrationExpiresAt:new Date(exp).toISOString(),generalRegistrationToken,generalRegistrationOwnerUserId,generalRegistrationExpiresAt,canCreateGeneralRegistration:isManager,requestId});
  }
  if(action==='me'){return json({ok:true,user:await ownUser(),school:schoolQ.data,membership:(membership.data||[]).find((x:any)=>low(x.role)===role)||membership.data?.[0]||null,requestId});}
  if(action==='list-admin-employees'){
   if(!isManager&&!isAgent)return json({error:'SUPERVISOR_REQUIRED'},403);const q=await sb.from('school_members').select('*').eq('school_id',schoolId).in('role',['administrative_employee','admin_employee']).neq('status','deleted').order('created_at');if(q.error)throw q.error;const allowed=[];for(const m of q.data||[])if(await supervisorOwns(m))allowed.push(m);
   const ids=allowed.map((x:any)=>x.user_id).filter(Boolean);let users:any[]=[];if(ids.length){const uq=await sb.from('users').select('id,full_name,email,status,active').in('id',ids);if(uq.error)throw uq.error;users=uq.data||[]}
   return json({ok:true,memberships:allowed,users,school:schoolQ.data,supervisorUserId:userId,requestId});
  }
  if(action==='set-admin-status'||action==='remove-admin-employee'){
   if(!isManager&&!isAgent)return json({error:'SUPERVISOR_REQUIRED'},403);const targetId=t(body.userId||body.id,100);const mq=await sb.from('school_members').select('*').eq('school_id',schoolId).eq('user_id',targetId).in('role',['administrative_employee','admin_employee']).neq('status','deleted').maybeSingle();if(mq.error)throw mq.error;if(!mq.data||!(await supervisorOwns(mq.data)))return json({error:'ADMIN_NOT_OWNED_BY_SUPERVISOR'},403);
   if(action==='set-admin-status'){const status=low(body.status);if(!['pending','active','disabled'].includes(status))return json({error:'STATUS_INVALID'},400);const up=await sb.from('school_members').update({status,updated_at:now}).eq('id',mq.data.id).select('*').single();if(up.error)throw up.error;if(status==='active')await sb.from('users').update({status:'active',active:true}).eq('id',targetId);return json({ok:true,membership:up.data,requestId})}
   const del=await sb.from('school_members').delete().eq('id',mq.data.id).eq('school_id',schoolId);if(del.error)throw del.error;const remain=await sb.from('school_members').select('id').eq('user_id',targetId).neq('status','deleted').limit(1);if(remain.error)throw remain.error;if(!(remain.data||[]).length)await sb.from('users').delete().eq('id',targetId);return json({ok:true,userId:targetId,requestId});
  }
  if(action==='list-users'){
   if(!isManager)return json({error:'MANAGER_REQUIRED'},403);
   const [mq,uq]=await Promise.all([sb.from('school_members').select('*').eq('school_id',schoolId).neq('status','deleted').order('created_at'),sb.from('users').select('id,full_name,email,role,status,active,school_id').eq('school_id',schoolId).neq('status','deleted').order('created_at')]);if(mq.error)throw mq.error;if(uq.error)throw uq.error;
   const memberships:any[]=[...(mq.data||[])],byKey=new Set(memberships.map((m:any)=>`${String(m.user_id||'')}|${low(m.role)}`));
   for(const u of uq.data||[]){const k=`${String(u.id||'')}|${low(u.role)}`;if(!byKey.has(k)){memberships.push({id:`legacy:${u.id}`,school_id:schoolId,user_id:u.id,email:u.email,role:u.role,status:u.status||'active',role_label:null,supervisor_user_id:null,legacy_user_row:true});byKey.add(k)}}
   const ids=[...new Set(memberships.map((x:any)=>x.user_id).filter(Boolean))];let users:any[]=[];if(ids.length){const all=await sb.from('users').select('id,full_name,email,role,status,active,school_id').in('id',ids);if(all.error)throw all.error;users=all.data||[]}
   return json({ok:true,memberships,users,school:schoolQ.data,requestId});
  }
  if(action==='set-user-status'||action==='delete-user'||action==='upsert-user'){
   if(!isManager)return json({error:'MANAGER_REQUIRED'},403);
   const belongs=async(target:string)=>{if(!target)return null;const uq=await sb.from('users').select('*').eq('id',target).maybeSingle();if(uq.error)throw uq.error;if(!uq.data)return null;if(String(uq.data.school_id||'')===schoolId)return uq.data;const mq=await sb.from('school_members').select('id').eq('school_id',schoolId).eq('user_id',target).neq('status','deleted').limit(1);if(mq.error)throw mq.error;return (mq.data||[]).length?uq.data:null};
   if(action==='set-user-status'){
    const target=t(body.userId,100),status=low(body.status);if(!target||!['pending','active','disabled'].includes(status))return json({error:'INVALID_INPUT'},400);const targetUser=await belongs(target);if(!targetUser)return json({error:'TARGET_USER_OUTSIDE_SCHOOL'},403);if(['owner'].includes(low(targetUser.role)))return json({error:'PROTECTED_ACCOUNT'},403);
    const mq=await sb.from('school_members').update({status,updated_at:now}).eq('school_id',schoolId).eq('user_id',target).select('*');if(mq.error)throw mq.error;const uu=await sb.from('users').update({status,active:status==='active',updated_at:now}).eq('id',target).select('id').maybeSingle();if(uu.error)throw uu.error;return json({ok:true,memberships:mq.data||[],requestId});
   }
   if(action==='delete-user'){
    const target=t(body.userId,100);if(!target||target===userId)return json({error:'INVALID_TARGET'},400);const targetUser=await belongs(target);if(!targetUser)return json({error:'TARGET_USER_OUTSIDE_SCHOOL'},403);if(['owner','manager'].includes(low(targetUser.role)))return json({error:'PROTECTED_ACCOUNT'},403);
    const del=await sb.from('school_members').delete().eq('school_id',schoolId).eq('user_id',target);if(del.error)throw del.error;const remain=await sb.from('school_members').select('school_id,role,status').eq('user_id',target).neq('status','deleted').limit(1);if(remain.error)throw remain.error;if(!(remain.data||[]).length)await sb.from('users').delete().eq('id',target);else{const r=remain.data[0];await sb.from('users').update({school_id:r.school_id,role:r.role,status:r.status,active:r.status==='active'}).eq('id',target)}return json({ok:true,userId:target,requestId});
   }
   const x=body.user||{},email=low(x.email),name=t(x.full_name||x.name,300),target=t(x.id,100),targetRole=low(x.role);if(!email||!name||!targetRole)return json({error:'USER_FIELDS_REQUIRED'},400);let user:any=null;
   if(target){user=await belongs(target);if(!user)return json({error:'TARGET_USER_OUTSIDE_SCHOOL'},403)}else{const q=await sb.from('users').select('*').eq('email',email).limit(1).maybeSingle();if(q.error)throw q.error;user=q.data;if(user&&String(user.school_id||'')!==schoolId){const m=await sb.from('school_members').select('id').eq('school_id',schoolId).eq('user_id',user.id).neq('status','deleted').limit(1);if(m.error)throw m.error;if(!(m.data||[]).length)user=null}}
   if(user){if(['owner'].includes(low(user.role)))return json({error:'PROTECTED_ACCOUNT'},403);const up=await sb.from('users').update({full_name:name,email,status:x.status||user.status,active:x.active??user.active}).eq('id',user.id).select('*').single();if(up.error)throw up.error;user=up.data}else{const ins=await sb.from('users').insert({school_id:schoolId,full_name:name,email,password:t(x.password,300)||null,role:targetRole,status:x.status||'pending',active:!!x.active}).select('*').single();if(ins.error)throw ins.error;user=ins.data}
   const mem=await sb.from('school_members').upsert({school_id:schoolId,user_id:user.id,email,role:targetRole,status:x.status||'pending'},{onConflict:'school_id,email,role'}).select('*').single();if(mem.error)throw mem.error;return json({ok:true,user,membership:mem.data,school:schoolQ.data,requestId});
  }
  return json({error:'ACTION_UNSUPPORTED',requestId},400);
 }catch(e){console.error('[platform-directory]',requestId,e);return json({error:e instanceof Error?e.message:String(e),requestId},500)}
});
