(function(){
'use strict';
const cfg={url:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,''),key:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM'};
const token=()=>window.PlatformCloudSession?.token?.()||localStorage.getItem('platform_file_session_token')||'';
const sid=()=>window.PlatformCloudSession?.schoolId?.()||localStorage.getItem('platform_file_session_school_id')||localStorage.getItem('active_school_id')||localStorage.getItem('current_school_id')||'';
const uid=()=>window.PlatformCloudSession?.userId?.()||localStorage.getItem('platform_file_session_user_id')||'';
const norm=v=>String(v||'').trim().replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
async function call(action,body){const r=await fetch(`${cfg.url()}/functions/v1/platform-performance?action=${encodeURIComponent(action)}`,{method:'POST',headers:{apikey:cfg.key(),'content-type':'application/json','x-platform-session':token()},body:JSON.stringify(body||{})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'تعذر الاتصال بحفظ تقييم الأداء');return j}
window.schoolInfoCenter={async getUsers(){
  if(!window.SchoolInformationSource)throw new Error('مركز المعلومات المدرسية غير جاهز');
  const staff=await SchoolInformationSource.getStaff();
  return staff.filter(u=>!/(manager|school_manager|principal|owner|مدير)/.test(norm((u.role||'')+' '+(u.role_label||'')))).map(u=>{const role=norm(u.role||''),label=String(u.role_label||'').trim();let jobTitle=label||u.role||'';if(/student_advisor|counselor/.test(role))jobTitle='موجه طلابي';else if(/activity_leader/.test(role))jobTitle='رائد نشاط';else if(/agent|deputy/.test(role))jobTitle='وكيل المدرسة';else if(/teacher/.test(role)&&!/رياض/.test(norm(label)))jobTitle='معلم';return {id:u.id,name:u.name,jobTitle,email:u.email||'',role:u.role||''}});
}};
window.platformSession={async getContext(){const b=window.SchoolBaseSettings?.read?.()||{};return {school_id:sid(),manager_id:uid(),academic_year:(String(b.year||'1448').replace(/\D/g,'')+'هـ'),school_name:b.school||'',education_admin:b.education||'',education_office:'',term:'الفصل الدراسي الأول',manager_name:b.manager||'',manager_job_title:'مدير/مديرة المدرسة',signature:b.signature||'',stamp:b.stamp||'',source:'مركز المعلومات المدرسية'}}};
window.platformMessenger={async send(message){if(!window.InternalMessaging)throw new Error('نظام المراسلات الداخلية غير جاهز');return InternalMessaging.call('send',{recipientIds:[message.toUserId],subject:message.subject,body:message.body,priority:'normal',messageType:'notice',linked:{module:'performance_evaluation',recordType:'performance_evaluation',recordId:message.evaluationId||'',title:'بطاقة تقييم الأداء الوظيفي',url:'performance_evaluation.html'},metadata:{evaluationId:message.evaluationId||'',payload:message.payload||{}}})}};
window.performanceCloud={
 async load(year){return call('load',{academicYear:String(year||'').replace(/\D/g,'')})},
 async save(data,year){return call('save',{academicYear:String(year||'').replace(/\D/g,''),data})},
 async reset(year){return call('reset',{academicYear:String(year||'').replace(/\D/g,'')})}
};
window.addEventListener('school-information-updated',()=>{try{window.dispatchEvent(new Event('performance-users-refresh'))}catch(_){}});
})();