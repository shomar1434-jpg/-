import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type,x-platform-session','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const txt=(v:unknown,n=20000)=>String(v??'').trim().slice(0,n);
const sha256=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const managers=new Set(['manager','owner','school_manager','principal','leadership','مدير','مديرة','مدير المدرسة','مديرة المدرسة']);
const canonicalRole=(v:unknown)=>{const r=txt(v,100).toLowerCase().replace(/\s+/g,'_');const map:Record<string,string>={owner:'manager',school_manager:'manager',principal:'manager',leadership:'manager','مدير':'manager','مديرة':'manager','مدير_المدرسة':'manager','مديرة_المدرسة':'manager',agent:'agent',wakil:'agent',deputy:'agent',vice:'agent',agency:'agent','وكيل':'agent','وكيلة':'agent',teacher:'teacher',school_teacher:'teacher',performance:'teacher','معلم':'teacher','معلمة':'teacher',administrative_employee:'admin_employee',admin_employee:'admin_employee',employee_admin:'admin_employee',administrative:'admin_employee','موظف_إداري':'admin_employee','موظفة_إدارية':'admin_employee',student_advisor:'student_advisor',advisor:'student_advisor',counselor:'student_advisor','مرشد':'student_advisor','موجه':'student_advisor','موجه_طلابي':'student_advisor','الموجه_الطلابي':'student_advisor','موجهة_طلابية':'student_advisor',activity_leader:'activity_leader','activity-leader':'activity_leader',activity:'activity_leader','رائد_النشاط':'activity_leader','رائدة_النشاط':'activity_leader',health_advisor:'health_advisor','health-advisor':'health_advisor',health:'health_advisor','موجه_صحي':'health_advisor','الموجه_الصحي':'health_advisor','موجهة_صحية':'health_advisor',kindergarten_teacher:'kindergarten_teacher','kindergarten-teacher':'kindergarten_teacher',kindergarten:'kindergarten_teacher','معلمة_رياض_الأطفال':'kindergarten_teacher','معلمة_رياض_اطفال':'kindergarten_teacher'};return map[r]||r};
const allowedSurveyStatus=new Set(['draft','active','closed','archived']);
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors}); if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(!url||!service)return json({error:'ENV_MISSING'},500);
 const sb=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),requestId=crypto.randomUUID();
 try{
  const raw=txt(req.headers.get('x-platform-session'),600); if(!raw)return json({error:'SESSION_MISSING',requestId},401);
  const h=await sha256(raw),now=new Date().toISOString(); const sq=await sb.from('platform_sessions').select('*').eq('session_token_hash',h).eq('status','active').gt('expires_at',now).maybeSingle(); if(sq.error)throw sq.error;
  const s:any=sq.data; if(!s?.school_id||!s?.user_id)return json({error:'SESSION_INVALID',requestId},401);
  const mq=await sb.from('school_members').select('role,status').eq('school_id',s.school_id).eq('user_id',s.user_id).eq('status','active'); if(mq.error)throw mq.error;
  const sessionRole=txt(s.role,100), memberRoles=(mq.data||[]).map((x:any)=>txt(x.role,100)),sessionCanonical=canonicalRole(sessionRole),memberCanonical=memberRoles.map(canonicalRole);
  // RL107: the authoritative security boundary is an ACTIVE membership for the same user in the SAME school.
  // Role labels can legitimately differ between legacy/new UI contracts, so a textual role mismatch must not block the survey.
  if(!memberRoles.length)return json({error:'MEMBERSHIP_INACTIVE',requestId},403);
  const effectiveCanonical = memberCanonical.includes(sessionCanonical) ? sessionCanonical : (memberCanonical[0] || sessionCanonical);
  const body:any=await req.json().catch(()=>({})),action=txt(body.action,80),schoolId=String(s.school_id),userId=String(s.user_id),isManager=sessionCanonical==='manager'||memberCanonical.includes('manager');
  const ownerSurvey=async(id:string)=>{const q=await sb.from('impact_surveys').select('*').eq('id',id).eq('school_id',schoolId).eq('creator_user_id',userId).maybeSingle();if(q.error)throw q.error;return q.data};
  if(action==='health')return json({ok:true,version:'1.3.0-RL107-active-membership-school-scope',schoolId,userId,role:sessionRole,requestId});
  if(action==='list'){
   const managerView=body.managerView===true&&isManager;
   let sqry=sb.from('impact_surveys').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}); if(!managerView)sqry=sqry.eq('creator_user_id',userId);
   let aqry=sb.from('impact_assessments').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}); if(!managerView)aqry=aqry.eq('creator_user_id',userId);
   const [sr,ar]=await Promise.all([sqry,aqry]);if(sr.error)throw sr.error;if(ar.error)throw ar.error;
   const ids=(sr.data||[]).map((x:any)=>x.id);let responses:any[]=[];if(ids.length){const rr=await sb.from('impact_survey_responses').select('*').eq('school_id',schoolId).in('survey_id',ids).order('created_at',{ascending:false});if(rr.error)throw rr.error;responses=rr.data||[]}
   return json({ok:true,surveys:sr.data||[],responses,assessments:ar.data||[],managerView,schoolId,userId,requestId});
  }
  if(action==='bank'){
   if(!isManager)return json({error:'MANAGER_REQUIRED',requestId},403);
   const [sr,rr,ar]=await Promise.all([sb.from('impact_surveys').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}),sb.from('impact_survey_responses').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}),sb.from('impact_assessments').select('*').eq('school_id',schoolId).order('created_at',{ascending:false})]);for(const q of[sr,rr,ar])if(q.error)throw q.error;
   const ids=[...new Set([...(sr.data||[]).map((x:any)=>x.creator_user_id),...(ar.data||[]).map((x:any)=>x.creator_user_id)].filter(Boolean))];let users:any[]=[];if(ids.length){const uq=await sb.from('users').select('id,full_name,role').in('id',ids);if(uq.error)throw uq.error;users=uq.data||[]}
   return json({ok:true,surveys:sr.data||[],responses:rr.data||[],assessments:ar.data||[],users,schoolId,requestId});
  }
  if(action==='create-survey'){
   const x=body.survey||{};const id=txt(x.id,160),token=txt(x.public_token||x.publicToken,220),assessmentId=txt(x.assessment_id||x.assessmentId,180),program=txt(x.program_name||x.programName,400),title=txt(x.title,500);if(!id||!token||!program||!title)return json({error:'SURVEY_FIELDS_REQUIRED',requestId},400);
   if(assessmentId){const aq=await sb.from('impact_assessments').select('id').eq('id',assessmentId).eq('school_id',schoolId).eq('creator_user_id',userId).maybeSingle();if(aq.error)throw aq.error;if(!aq.data)return json({error:'ASSESSMENT_NOT_OWNED',requestId},403)}
   const row={id,public_token:token,school_id:schoolId,creator_user_id:userId,source_section:txt(x.source_section||x.sourceSection,160)||null,source_record_id:txt(x.source_record_id||x.sourceRecordId,200)||null,assessment_id:assessmentId||null,survey_type:txt(x.survey_type||x.template,120)||'custom',program_name:program,title,audience:txt(x.audience,300)||null,role:sessionRole,role_label:txt(x.role_label||x.roleLabel,200)||sessionRole,template:txt(x.template||x.survey_type,120)||'custom',questions:Array.isArray(x.questions)?x.questions:[],status:'active',measure_date:x.measure_date||x.measureDate||null};
   const ins=await sb.from('impact_surveys').insert(row).select('*').single();if(ins.error)throw ins.error;const vr=await ownerSurvey(id);if(!vr)return json({error:'SURVEY_VERIFY_FAILED',requestId},500);return json({ok:true,survey:vr,requestId});
  }
  if(action==='update-survey'){
   const id=txt(body.id,160),owned=await ownerSurvey(id);if(!owned)return json({error:'NOT_FOUND_OR_NOT_OWNED',requestId},404);const p=body.patch||{};const patch:any={updated_at:now};if(p.title!==undefined)patch.title=txt(p.title,500);if(p.audience!==undefined)patch.audience=txt(p.audience,300)||null;if(p.questions!==undefined)patch.questions=Array.isArray(p.questions)?p.questions:[];if(p.template!==undefined){patch.template=txt(p.template,120)||'custom';patch.survey_type=patch.template;}const up=await sb.from('impact_surveys').update(patch).eq('id',id).eq('school_id',schoolId).eq('creator_user_id',userId).select('*').single();if(up.error)throw up.error;return json({ok:true,survey:up.data,requestId});
  }
  if(action==='set-survey-status'){
   const id=txt(body.id,160),status=txt(body.status,40);if(!allowedSurveyStatus.has(status))return json({error:'STATUS_INVALID',requestId},400);if(!(await ownerSurvey(id)))return json({error:'NOT_FOUND_OR_NOT_OWNED',requestId},404);const patch:any={status,updated_at:now};if(status==='closed')patch.closed_at=now;if(status==='active')patch.closed_at=null;if(status==='archived')patch.archived_at=now;const up=await sb.from('impact_surveys').update(patch).eq('id',id).eq('school_id',schoolId).eq('creator_user_id',userId).select('*').single();if(up.error)throw up.error;return json({ok:true,survey:up.data,requestId});
  }
  if(action==='delete-survey'){
   const id=txt(body.id,160),owned=await ownerSurvey(id);if(!owned)return json({error:'NOT_FOUND_OR_NOT_OWNED',requestId},404);const rc=await sb.from('impact_survey_responses').select('id',{count:'exact',head:true}).eq('survey_id',id).eq('school_id',schoolId);if(rc.error)throw rc.error;if((rc.count||0)>0)return json({error:'SURVEY_HAS_RESPONSES',requestId},409);const del=await sb.from('impact_surveys').delete().eq('id',id).eq('school_id',schoolId).eq('creator_user_id',userId);if(del.error)throw del.error;return json({ok:true,id,requestId});
  }
  if(action==='save-assessment'){
   const x=body.assessment||{},id=txt(x.id,180),program=txt(x.program_name||x.programName,400);if(!id||!program)return json({error:'ASSESSMENT_FIELDS_REQUIRED',requestId},400);
   const existing=await sb.from('impact_assessments').select('id,school_id,creator_user_id').eq('id',id).maybeSingle();if(existing.error)throw existing.error;if(existing.data&&(String(existing.data.school_id)!==schoolId||String(existing.data.creator_user_id||'')!==userId))return json({error:'ASSESSMENT_ID_OWNERSHIP_CONFLICT',requestId},409);
   const row={id,school_id:schoolId,creator_user_id:userId,source_section:txt(x.source_section||x.sourceSection,160)||null,source_record_id:txt(x.source_record_id||x.sourceRecordId,200)||null,program_name:program,role:sessionRole,target_group:txt(x.target_group||x.target,200)||null,program_type:txt(x.program_type||x.programType,200)||null,measure_date:x.measure_date||x.measureDate||null,period_label:txt(x.period_label||x.period,200)||null,metrics:Array.isArray(x.metrics)?x.metrics:[],avg_improvement:Number(x.avg_improvement??x.avgImprovement??0)||0,impact_level:txt(x.impact_level||x.impactLevel,100)||null,findings:txt(x.findings)||null,conclusion:txt(x.conclusion)||null,recommendations:txt(x.recommendations)||null,evidence:Array.isArray(x.evidence)?x.evidence:[],external_evaluation:true,status:'active',survey_score:Number(x.survey_score??x.surveyScore??0)||0,response_count:Number(x.response_count??x.responseCount??0)||0,positive_rate:Number(x.positive_rate??x.positiveRate??0)||0,analysis:x.analysis&&typeof x.analysis==='object'?x.analysis:{},updated_at:now};
   const up=await sb.from('impact_assessments').upsert(row,{onConflict:'id'}).select('*').single();if(up.error)throw up.error;const vr=await sb.from('impact_assessments').select('*').eq('id',id).eq('school_id',schoolId).eq('creator_user_id',userId).maybeSingle();if(vr.error)throw vr.error;if(!vr.data)return json({error:'ASSESSMENT_VERIFY_FAILED',requestId},500);return json({ok:true,assessment:vr.data,requestId});
  }
  return json({error:'ACTION_UNSUPPORTED',requestId},400);
 }catch(e){console.error('[impact-measurement]',requestId,e);return json({error:e instanceof Error?e.message:String(e),requestId},500)}
});
