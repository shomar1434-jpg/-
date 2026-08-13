import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-platform-session','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)return json({error:'إعدادات الخدمة غير مكتملة'},500);
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const raw=req.headers.get('x-platform-session')||'';if(!raw)return json({error:'جلسة المنصة مفقودة'},401);
  const hash=await sha256(raw),now=new Date().toISOString();
  const {data:s,error:se}=await sb.from('platform_sessions').select('*').eq('session_token_hash',hash).eq('status','active').gt('expires_at',now).maybeSingle();
  if(se)throw se;if(!s)return json({error:'انتهت جلسة المنصة'},401);
  const body=await req.json().catch(()=>({})),year=String(body.academicYear||'1448').trim(),action=new URL(req.url).searchParams.get('action')||'load';
  if(action==='load'){const {data,error}=await sb.from('school_staff_discipline_states').select('state,updated_at').eq('school_id',s.school_id).eq('academic_year',year).maybeSingle();if(error)throw error;return json({state:data?.state||null,updatedAt:data?.updated_at||null})}
  if(action==='save'){
   const state=body.state&&typeof body.state==='object'?body.state:{};
   const {error}=await sb.from('school_staff_discipline_states').upsert({school_id:s.school_id,academic_year:year,state,updated_by:s.user_id,updated_at:now},{onConflict:'school_id,academic_year'});if(error)throw error;return json({ok:true});
  }
  return json({error:'إجراء غير مدعوم'},400);
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:String(e)},500)}
});