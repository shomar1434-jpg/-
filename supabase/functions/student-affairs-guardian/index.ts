import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const safe=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n);
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const sha256Bytes=async(v:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',v))).map(x=>x.toString(16).padStart(2,'0')).join('');
const normalizeName=(v:unknown)=>safe(v,300).replace(/\s+/g,' ').trim();
const normalizePhone=(v:unknown)=>{let p=String(v??'').replace(/\D/g,'');if(p.startsWith('05'))p='966'+p.slice(1);if(p.startsWith('5')&&p.length===9)p='966'+p;return p;};
const randToken=(bytes=12)=>{const a=new Uint8Array(bytes);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
const decodeSignature=(data:unknown)=>{
  const x=String(data||''),m=x.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if(!m)throw new Error('SIGNATURE_INVALID');
  if(m[2].length>2800000)throw new Error('SIGNATURE_TOO_LARGE');
  const raw=atob(m[2]),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const ext=m[1].toLowerCase()==='jpeg'?'jpg':m[1].toLowerCase();
  return{bytes,mime:'image/'+m[1].toLowerCase(),ext};
};
const isSystemAdminRole=(v:unknown)=>['system_admin','system-admin','مدير النظام'].includes(safe(v,100).toLowerCase());
const isStudentAffairsLabel=(v:unknown)=>{
  const x=safe(v,500).toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  return x==='student affairs'||x==='deputy students'||x==='وكيل شؤون الطلاب'||x==='وكيلة شؤون الطلاب'||x==='وكيل الشؤون الطلابية'||x==='وكيلة الشؤون الطلابية'||x==='شؤون الطلاب'||x==='الشؤون الطلابية';
};
const labels=(v:unknown)=>safe(v,1000).split(/[،,|;/]+/).map(x=>x.trim()).filter(Boolean);

type Access={kind:'student_affairs'|'system_admin',schoolId:string,userId:string};

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'طريقة الطلب غير مدعومة'},405);

  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)return json({error:'إعدادات الخدمة غير مكتملة'},500);
  const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

  try{
    const body=await req.json().catch(()=>({})),action=safe(body.action||'public-info',80);

    const internalSession=async()=>{
      const raw=safe(req.headers.get('x-platform-session'),500);
      if(!raw)return null;
      const h=await sha256(raw),now=new Date().toISOString();
      const q=await sb.from('platform_sessions').select('*').eq('session_token_hash',h).eq('status','active').gt('expires_at',now).maybeSingle();
      if(q.error)throw q.error;
      return q.data||null;
    };

    const resolveAccess=async(s:any):Promise<Access|null>=>{
      if(!s)return null;
      const schoolId=String(s.school_id||''),userId=String(s.user_id||'');
      if(!schoolId||!userId)return null;

      if(isSystemAdminRole(s.role))return{kind:'system_admin',schoolId,userId};

      const q=await sb.from('school_members').select('role,role_label,status').eq('school_id',schoolId).eq('user_id',userId).maybeSingle();
      if(q.error)throw q.error;
      if(!q.data||String(q.data.status||'active').toLowerCase()!=='active')return null;
      const role=String(q.data.role||'').toLowerCase();
      const sa=labels(q.data.role_label).some(isStudentAffairsLabel);
      if((role==='agent'||role==='student_affairs')&&sa)return{kind:'student_affairs',schoolId,userId};
      return null;
    };

    if(['create','list','status','revoke'].includes(action)){
      const s=await internalSession();
      if(!s)return json({error:'جلسة المنصة غير صالحة أو منتهية'},401);
      const access=await resolveAccess(s);
      if(!access)return json({error:'لا توجد صلاحية للوصول إلى إجراءات شؤون الطلاب'},403);

      const {schoolId,userId,kind}=access;

      if(action==='create'){
        if(kind!=='student_affairs')return json({error:'مدير النظام في وضع المراجعة فقط ولا ينشئ معاملات تشغيلية.'},403);
        const formKey=safe(body.formKey,120),formTitle=safe(body.formTitle,300),studentName=normalizeName(body.studentName),guardianName=normalizeName(body.guardianName),phone=normalizePhone(body.guardianPhone),payload=body.payload&&typeof body.payload==='object'?body.payload:{};
        if(!formKey||!formTitle||!studentName||!guardianName||phone.length<9)return json({error:'بيانات الطالب/الطالبة وولي الأمر غير مكتملة'},400);

        const token=randToken(12),tokenHash=await sha256(token),phoneHash=await sha256(phone),last4=phone.slice(-4);
        const prior=await sb.from('student_affairs_guardian_transactions')
          .select('archive_sequence')
          .eq('school_id',schoolId).eq('created_by',userId).eq('form_key',formKey).eq('student_name',studentName)
          .order('archive_sequence',{ascending:false}).limit(1);
        if(prior.error)throw prior.error;

        const seq=Math.max(1,Number(prior.data?.[0]?.archive_sequence||0)+1),archiveName=seq>1?`${studentName} (${seq})`:studentName;
        const ins=await sb.from('student_affairs_guardian_transactions').insert({
          school_id:schoolId,created_by:userId,form_key:formKey,form_title:formTitle,student_name:studentName,guardian_name:guardianName,
          guardian_phone_hash:phoneHash,guardian_phone_last4:last4,token_hash:tokenHash,token_hint:token.slice(0,4),payload,
          status:'waiting_guardian',archive_folder:formTitle,archive_name:archiveName,archive_sequence:seq
        }).select('id,status,archive_folder,archive_name,archive_sequence,created_at').single();
        if(ins.error)throw ins.error;
        return json({ok:true,transaction:ins.data,token,shortPath:`?guardian=1&t=${token}`});
      }

      if(action==='list'){
        let q=sb.from('student_affairs_guardian_transactions')
          .select('id,created_by,form_key,form_title,student_name,guardian_name,status,opened_at,verified_at,signed_at,archived_at,archive_folder,archive_name,archive_sequence,created_at,updated_at')
          .eq('school_id',schoolId)
          .order('created_at',{ascending:false}).limit(500);
        if(kind==='student_affairs')q=q.eq('created_by',userId);
        if(body.formKey)q=q.eq('form_key',safe(body.formKey,120));
        const r=await q;
        if(r.error)throw r.error;
        return json({ok:true,viewerKind:kind,transactions:r.data||[]});
      }

      if(action==='status'){
        const id=safe(body.id,80);
        let q=sb.from('student_affairs_guardian_transactions').select('*').eq('school_id',schoolId).eq('id',id);
        if(kind==='student_affairs')q=q.eq('created_by',userId);
        const r=await q.maybeSingle();
        if(r.error)throw r.error;
        if(!r.data)return json({error:'المعاملة غير موجودة ضمن نطاق هذا المستخدم والمدرسة'},404);
        let signatureUrl=null;
        if(r.data.signature_storage_path){
          const su=await sb.storage.from('student-affairs-guardian-signatures').createSignedUrl(r.data.signature_storage_path,300);
          if(!su.error)signatureUrl=su.data.signedUrl;
        }
        const x={...r.data,guardian_phone_hash:undefined,token_hash:undefined,verification_hash:undefined,verification_expires_at:undefined,signature_url:signatureUrl};
        return json({ok:true,viewerKind:kind,transaction:x});
      }

      if(action==='revoke'){
        if(kind!=='student_affairs')return json({error:'مدير النظام في وضع المراجعة فقط ولا يلغي معاملات تشغيلية.'},403);
        const id=safe(body.id,80);
        const owned=await sb.from('student_affairs_guardian_transactions').select('id,status').eq('school_id',schoolId).eq('created_by',userId).eq('id',id).maybeSingle();
        if(owned.error)throw owned.error;
        if(!owned.data)return json({error:'المعاملة غير موجودة ضمن نطاق هذا المستخدم والمدرسة'},404);
        if(['signed','archived'].includes(String(owned.data.status)))return json({error:'لا يمكن إلغاء معاملة مكتملة وموقعة.'},409);
        const r=await sb.from('student_affairs_guardian_transactions').update({status:'revoked',updated_at:new Date().toISOString()})
          .eq('school_id',schoolId).eq('created_by',userId).eq('id',id).select('id,status').maybeSingle();
        if(r.error)throw r.error;
        return json({ok:true,transaction:r.data});
      }
    }

    const token=safe(body.token,200);
    if(!token)return json({error:'رابط المعاملة غير صالح'},400);
    const tokenHash=await sha256(token);
    const qr=await sb.from('student_affairs_guardian_transactions').select('*').eq('token_hash',tokenHash).maybeSingle();
    if(qr.error)throw qr.error;
    const tx=qr.data;
    if(!tx||tx.status==='revoked')return json({error:'الرابط غير صالح أو لم يعد متاحًا'},404);

    if(action==='public-info'){
      const now=new Date().toISOString();
      if(!tx.opened_at)await sb.from('student_affairs_guardian_transactions').update({opened_at:now,status:tx.status==='waiting_guardian'?'opened':tx.status,updated_at:now}).eq('id',tx.id);
      const school=await sb.from('schools').select('school_name,school_code').eq('id',tx.school_id).maybeSingle();
      return json({ok:true,transaction:{formTitle:tx.form_title,status:tx.status==='waiting_guardian'?'opened':tx.status,schoolName:school.data?.school_name||'المدرسة',schoolCode:school.data?.school_code||'',tokenHint:tx.token_hint||''}});
    }

    if(action==='verify'){
      const guardianName=normalizeName(body.guardianName),last4=String(body.phoneLast4||'').replace(/\D/g,'').slice(-4);
      if(!guardianName||last4.length!==4)return json({error:'أدخل اسم ولي الأمر وآخر أربعة أرقام من الجوال'},400);
      if(normalizeName(tx.guardian_name)!==guardianName||String(tx.guardian_phone_last4)!==last4)return json({error:'بيانات التحقق غير مطابقة للسجل'},403);
      const verificationToken=randToken(18),verificationHash=await sha256(verificationToken),now=new Date(),expires=new Date(now.getTime()+10*60*1000).toISOString();
      const up=await sb.from('student_affairs_guardian_transactions').update({verified_at:now.toISOString(),verification_hash:verificationHash,verification_expires_at:expires,status:['signed','archived'].includes(tx.status)?tx.status:'verified',updated_at:now.toISOString()}).eq('id',tx.id);
      if(up.error)throw up.error;
      return json({ok:true,verificationToken,expiresAt:expires,transaction:{id:tx.id,formTitle:tx.form_title,status:tx.status,payload:tx.payload,studentName:tx.student_name,guardianName:tx.guardian_name}});
    }

    if(action==='sign'){
      if(['signed','archived'].includes(tx.status)&&tx.signed_at)return json({ok:true,alreadySigned:true,status:tx.status,signedAt:tx.signed_at,archiveFolder:tx.archive_folder,archiveName:tx.archive_name});
      const verificationToken=safe(body.verificationToken,300);
      if(!verificationToken||!tx.verification_hash)return json({error:'يلزم التحقق من ولي الأمر قبل التوقيع'},403);
      if(tx.verification_expires_at&&Date.parse(tx.verification_expires_at)<Date.now())return json({error:'انتهت مهلة التحقق. أعد التحقق ثم وقع.'},403);
      if(await sha256(verificationToken)!==tx.verification_hash)return json({error:'جلسة التحقق غير صالحة'},403);

      const sig=decodeSignature(body.signatureData),sigHash=await sha256Bytes(sig.bytes),path=`${tx.school_id}/${tx.created_by||'unknown'}/${tx.id}/${crypto.randomUUID()}.${sig.ext}`;
      const upload=await sb.storage.from('student-affairs-guardian-signatures').upload(path,sig.bytes,{contentType:sig.mime,upsert:false,cacheControl:'31536000'});
      if(upload.error)throw upload.error;
      const now=new Date().toISOString();
      const update=await sb.from('student_affairs_guardian_transactions').update({
        status:'archived',signed_at:now,archived_at:now,signature_storage_path:path,signature_hash:sigHash,signature_mime_type:sig.mime,
        verification_hash:null,verification_expires_at:null,updated_at:now
      }).eq('id',tx.id).select('id,status,signed_at,archived_at,archive_folder,archive_name,archive_sequence').single();
      if(update.error)throw update.error;
      return json({ok:true,status:'archived',transaction:update.data});
    }

    return json({error:'عملية غير مدعومة'},400);
  }catch(e){
    console.error('[student-affairs-guardian]',e);
    const m=e instanceof Error?e.message:String(e);
    return json({error:m==='SIGNATURE_INVALID'?'صيغة التوقيع غير صالحة':m==='SIGNATURE_TOO_LARGE'?'حجم التوقيع أكبر من المسموح':m},500);
  }
});
