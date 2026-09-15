import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigin='https://shomar1434-jpg.github.io';
const cors=(req:Request)=>({
  'Access-Control-Allow-Origin':req.headers.get('origin')===allowedOrigin?allowedOrigin:allowedOrigin,
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Vary':'Origin'
});
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const text=(v:unknown,n=300)=>String(v??'').trim().slice(0,n);
const digits=(v:unknown)=>text(v,40).replace(/[^0-9٠-٩۰-۹]/g,'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const studentAffairsLabels=new Set(['student affairs','deputy students','وكيل شؤون الطلاب','وكيلة شؤون الطلاب','وكيل الشؤون الطلابية','وكيلة الشؤون الطلابية','شؤون الطلاب','الشؤون الطلابية']);
const labels=(v:unknown)=>text(v,1000).toLowerCase().replace(/[_-]+/g,' ').split(/[،,|;/]+/).map(x=>x.trim()).filter(Boolean);

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return json(req,{error:'طريقة الطلب غير مدعومة'},405);
  const origin=req.headers.get('origin');
  if(origin&&origin!==allowedOrigin)return json(req,{error:'مصدر الطلب غير معتمد'},403);
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)return json(req,{error:'إعدادات الخدمة غير مكتملة'},500);
  const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),requestId=crypto.randomUUID();
  try{
    const raw=text(req.headers.get('x-platform-session'),700);
    if(!raw)return json(req,{error:'جلسة المنصة مفقودة',code:'SESSION_MISSING',requestId},401);
    const sq=await sb.from('platform_sessions').select('*').eq('session_token_hash',await sha256(raw)).eq('status','active').gt('expires_at',new Date().toISOString()).maybeSingle();
    if(sq.error)throw sq.error;const session:any=sq.data;
    if(!session?.school_id||!session?.user_id)return json(req,{error:'جلسة المنصة غير صالحة أو غير مرتبطة بمدرسة',code:'SESSION_INVALID',requestId},401);
    const mq=await sb.from('school_members').select('role,role_label,status').eq('school_id',session.school_id).eq('user_id',session.user_id).maybeSingle();
    if(mq.error)throw mq.error;const member:any=mq.data,role=text(member?.role,100).toLowerCase();
    const roleOk=member&&text(member.status||'active',30).toLowerCase()==='active'&&(role==='student_affairs'||(role==='agent'&&labels(member.role_label).some(x=>studentAffairsLabels.has(x))));
    if(!roleOk)return json(req,{error:'المزامنة متاحة لوكيل/وكيلة شؤون الطلاب فقط',code:'ROLE_DENIED',requestId},403);

    const body:any=await req.json().catch(()=>({})),date=text(body.date,10),records=Array.isArray(body.records)?body.records:[];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z')))return json(req,{error:'تاريخ يوم العمل غير صالح',code:'DATE_INVALID',requestId},400);
    if(!records.length)return json(req,{error:'لا توجد سجلات غياب للحفظ',code:'RECORDS_EMPTY',requestId},400);
    if(records.length>1500)return json(req,{error:'عدد السجلات يتجاوز الحد المسموح للدفعة',code:'BATCH_TOO_LARGE',requestId},413);

    const requested=new Map<string,any>();
    for(const r of records){const nid=digits(r?.nationalId);if(nid&&nid.length>=8&&!requested.has(nid))requested.set(nid,r)}
    const ids=[...requested.keys()],students:any[]=[];
    for(let i=0;i<ids.length;i+=200){const q=await sb.from('students').select('id,student_name,national_id,stage,grade,section_name,student_status').eq('school_id',session.school_id).in('national_id',ids.slice(i,i+200)).neq('student_status','محذوف').limit(500);if(q.error)throw q.error;students.push(...(q.data||[]))}
    const canonical=new Map(students.map(s=>[digits(s.national_id),s])),valid:any[]=[];
    for(const [nid,input] of requested){const st=canonical.get(nid);if(!st)continue;valid.push({school_id:String(session.school_id),student_id:String(st.id),national_id:nid,student_name:text(st.student_name),stage:text(st.stage)||null,grade:text(st.grade)||null,class_name:text(st.section_name)||null,movement_type:'absence',movement_date:date,source:'noor',notes:text(input?.notes,1000)||null,synced_by:String(session.user_id)})}
    if(!valid.length)return json(req,{ok:true,inserted:0,duplicates:0,rejected:records.length,records:[],requestId});
    const existingQ=await sb.from('student_daily_attendance').select('national_id').eq('school_id',session.school_id).eq('movement_date',date).eq('movement_type','absence').in('national_id',valid.map(x=>x.national_id));
    if(existingQ.error)throw existingQ.error;const existing=new Set((existingQ.data||[]).map(x=>digits(x.national_id))),insertRows=valid.filter(x=>!existing.has(x.national_id));
    if(insertRows.length){const ins=await sb.from('student_daily_attendance').upsert(insertRows,{onConflict:'school_id,national_id,movement_date,movement_type',ignoreDuplicates:true});if(ins.error)throw ins.error}
    await sb.from('platform_sessions').update({last_seen_at:new Date().toISOString()}).eq('id',session.id);
    return json(req,{ok:true,inserted:insertRows.length,duplicates:valid.length-insertRows.length,rejected:records.length-valid.length,records:valid,schoolId:String(session.school_id),requestId});
  }catch(error){console.error('[student-attendance-sync]',requestId,error);return json(req,{error:'تعذر حفظ مزامنة الغياب. لم يتم حذف أي سجل سابق.',code:'SYNC_FAILED',requestId},500)}
});
