import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(v:unknown)=>String(v??'').trim();
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return json({error:'إعدادات الخدمة غير مكتملة'},500);
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const raw=req.headers.get('x-platform-session')||'';if(!raw)return json({error:'جلسة المنصة مفقودة'},401);
  const hash=await sha256(raw),now=new Date().toISOString();
  const {data:s,error:se}=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();
  if(se)throw se;if(!s)return json({error:'انتهت جلسة المنصة'},401);
  const body=await req.json().catch(()=>({})),year=text(body.academicYear||'1448'),action=new URL(req.url).searchParams.get('action')||'load';
  const ensureSchoolUser=async(uid:string)=>{
   const q1=await sb.from('users').select('id').eq('id',uid).eq('school_id',s.school_id).eq('active',true).limit(1).maybeSingle();
   if(q1.error)throw q1.error;if(q1.data)return true;
   const q2=await sb.from('school_members').select('id').eq('school_id',s.school_id).eq('user_id',uid).eq('status','active').limit(1).maybeSingle();
   if(q2.error)throw q2.error;return !!q2.data;
  };
  if(action==='health')return json({ok:true,service:'platform-discipline',version:'2.0.0-atomic-movement-state'});
  if(action==='load'){
   const [{data:st,error:ste},{data:mov,error:me}]=await Promise.all([
    sb.from('school_staff_discipline_states').select('state,updated_at').eq('school_id',s.school_id).eq('academic_year',year).maybeSingle(),
    sb.from('staff_discipline_movements').select('*').eq('school_id',s.school_id).neq('status','deleted').order('start_at',{ascending:false}).limit(5000)
   ]);
   if(ste)throw ste;if(me)throw me;return json({state:st?.state||null,updatedAt:st?.updated_at||null,movements:mov||[]});
  }
  if(action==='save'){
   const state=body.state&&typeof body.state==='object'?body.state:{};
   const {error}=await sb.from('school_staff_discipline_states').upsert({school_id:s.school_id,academic_year:year,state,updated_by:s.user_id,updated_at:now},{onConflict:'school_id,academic_year'});
   if(error)throw error;return json({ok:true});
  }
  if(action==='upsert_movement'||action==='save_movement'){
   const m=body.movement||{},id=text(m.id),uid=text(m.userId||m.user_id);
   if(!uuid.test(id))return json({error:'معرف الحركة غير صالح'},400);
   if(!uuid.test(uid))return json({error:'تعذر ربط الحركة بحساب المستخدم في المدرسة'},400);
   if(!(await ensureSchoolUser(uid)))return json({error:'الموظف غير مرتبط بهذه المدرسة'},403);
   const date=text(m.date).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return json({error:'تاريخ الحركة غير صالح'},400);
   const type=text(m.type||m.movement_type||'حاضر');
   const absence=type==='غياب بعذر'||type==='غياب بدون عذر';
   const row={id,school_id:s.school_id,user_id:uid,movement_type:type,start_at:date+'T00:00:00.000Z',end_at:null,
    minutes:absence?0:Math.max(0,Number(m.minutes||0)||0),
    absence_days:absence?Math.max(1,Number(m.days||m.absence_days||1)||1):0,
    excuse_type:absence?text(m.excuse||m.excuse_type)||null:null,
    excuse_status:absence?text(m.excuseStatus||m.excuse_status)||null:null,
    notes:text(m.notes),source:text(m.source||'attendance-discipline'),created_by:s.user_id,status:'active',updated_at:now};
   const {data,error}=await sb.from('staff_discipline_movements').upsert(row,{onConflict:'id'}).select('*').single();if(error)throw error;
   if(action==='save_movement'){
    const state=body.state&&typeof body.state==='object'?body.state:{};
    const sr=await sb.from('school_staff_discipline_states').upsert({school_id:s.school_id,academic_year:year,state,updated_by:s.user_id,updated_at:now},{onConflict:'school_id,academic_year'});
    if(sr.error)throw sr.error;
   }
   return json({ok:true,movement:data,stateSaved:action==='save_movement'});
  }
  if(action==='delete_movement'){
   const id=text(body.id);if(!uuid.test(id))return json({error:'معرف الحركة غير صالح'},400);
   const {error}=await sb.from('staff_discipline_movements').update({status:'deleted',updated_at:now}).eq('id',id).eq('school_id',s.school_id);if(error)throw error;
   if(body.state&&typeof body.state==='object'){
    const sr=await sb.from('school_staff_discipline_states').upsert({school_id:s.school_id,academic_year:year,state:body.state,updated_by:s.user_id,updated_at:now},{onConflict:'school_id,academic_year'});if(sr.error)throw sr.error;
   }
   return json({ok:true});
  }
  return json({error:'إجراء غير مدعوم'},400);
 }catch(e){console.error('[platform-discipline]',e);return json({error:e instanceof Error?e.message:String(e)},500)}
});