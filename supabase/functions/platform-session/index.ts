import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json; charset=utf-8'}});
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const {login,password,schoolId}=await req.json();
  if(!login||!password||!schoolId)return json({error:'بيانات الجلسة غير مكتملة'},400);
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const normalized=String(login).trim().toLowerCase();
  const {data:users,error}=await sb.from('users').select('*').or(`email.eq.${normalized},name.eq.${login},full_name.eq.${login}`).limit(20);
  if(error)throw error;
  const user=(users||[]).find((u:any)=>String(u.school_id||'')===String(schoolId)&&String(u.status||'active')==='active'&&String(u.password||u.pass||'')===String(password));
  if(!user)return json({error:'بيانات الدخول غير صحيحة أو الحساب غير مرتبط بالمدرسة'},401);
  const {data:member}=await sb.from('school_members').select('id,status').eq('school_id',schoolId).or(`user_id.eq.${user.id},email.eq.${normalized}`).limit(1).maybeSingle();
  if(member&&member.status&&member.status!=='active')return json({error:'عضوية المستخدم غير فعالة'},403);
  const raw=crypto.randomUUID()+crypto.randomUUID(); const hash=await sha256(raw); const expires=new Date(Date.now()+12*60*60*1000).toISOString();
  await sb.from('platform_sessions').insert({session_token_hash:hash,user_id:user.id,school_id:schoolId,role:user.role||'member',expires_at:expires});
  return json({token:raw,expiresAt:expires,userId:user.id,schoolId,role:user.role||'member'});
 }catch(e){return json({error:e instanceof Error?e.message:String(e)},500)}
});
