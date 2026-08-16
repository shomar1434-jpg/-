(function(){
  'use strict';
  if(window.__MULTI_SCHOOL_SWITCHER_ALL_USERS_V2__) return;
  window.__MULTI_SCHOOL_SWITCHER_ALL_USERS_V2__=true;

  var NS='smartSchoolUnifiedOpsV2';
  var ACTIVE_MEMBERSHIP='smart_school_active_membership_id';
  var ROLE_META={
    manager:{app:'leadership',file:'manager.html',label:'مدير/ة المدرسة'}, leadership:{app:'leadership',file:'manager.html',label:'مدير/ة المدرسة'}, principal:{app:'leadership',file:'manager.html',label:'مدير/ة المدرسة'},
    agency:{app:'agency',file:'agent.html',label:'وكيل/ة'}, agent:{app:'agency',file:'agent.html',label:'وكيل/ة'}, deputy:{app:'agency',file:'agent.html',label:'وكيل/ة'}, deputy_admin:{app:'agency',file:'agent.html',label:'وكيل الشؤون المدرسية'}, deputy_academic:{app:'agency',file:'agent.html',label:'وكيل الشؤون التعليمية'}, deputy_students:{app:'agency',file:'agent.html',label:'وكيل شؤون الطلاب'},
    performance:{app:'performance',file:'teacher.html',label:'معلم/ة'}, teacher:{app:'performance',file:'teacher.html',label:'معلم/ة'},
    student_advisor:{app:'student_advisor',file:'student_advisor.html',label:'موجه/ة طلابي/ة'}, counselor:{app:'student_advisor',file:'student_advisor.html',label:'موجه/ة طلابي/ة'},
    health_advisor:{app:'health_advisor',file:'health_advisor.html',label:'الموجه الصحي'}, health_guidance:{app:'health_advisor',file:'health_advisor.html',label:'الموجه الصحي'},
    activity_leader:{app:'activity_leader',file:'activity_leader.html',label:'رائد/ة النشاط'}, activity:{app:'activity_leader',file:'activity_leader.html',label:'رائد/ة النشاط'},
    kindergarten_teacher:{app:'kindergarten_teacher',file:'kindergarten_teacher.html',label:'معلمة رياض الأطفال'}, kindergarten:{app:'kindergarten_teacher',file:'kindergarten_teacher.html',label:'معلمة رياض الأطفال'},
    administrative_employee:{app:'administrative_employee',file:'administrative_employee_portal.html',label:'موظف/ة إداري/ة'}, admin_staff:{app:'administrative_employee',file:'administrative_employee_portal.html',label:'موظف/ة إداري/ة'}, administrative:{app:'administrative_employee',file:'administrative_employee_portal.html',label:'موظف/ة إداري/ة'}
  };

  function parse(v,d){try{return JSON.parse(v||'')}catch(e){return d}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function norm(v){return String(v||'').trim().toLowerCase()}
  function user(){return parse(localStorage.getItem('currentSchoolUser'),null)||parse(localStorage.getItem('currentUser'),null)||parse(localStorage.getItem('smart_school_current_session'),null)||{}}
  function email(){var u=user();return norm(u.email||u.microsoftEmail||localStorage.getItem('currentUserEmail')||'')}
  function userId(){var u=user();return String(u.id||u.user_id||localStorage.getItem('currentUserId')||'')}
  function activeSchoolId(){var q=new URLSearchParams(location.search||'');return String(q.get('schoolId')||q.get('school_id')||localStorage.getItem('active_school_id')||localStorage.getItem('current_school_id')||localStorage.getItem('school_id')||'')}
  function activeRole(){var u=user();return norm(localStorage.getItem('smart_school_active_role')||localStorage.getItem('currentRole')||u.activeRole||u.role||u.dbRole||'')}
  function roleMeta(role){var r=norm(role);if(ROLE_META[r])return ROLE_META[r];if(/مدير|principal/.test(r))return ROLE_META.manager;if(/وكيل|deputy/.test(r))return ROLE_META.agency;if(/رياض/.test(r))return ROLE_META.kindergarten_teacher;if(/صحي|health/.test(r))return ROLE_META.health_advisor;if(/طلاب|مرشد|موجه/.test(r))return ROLE_META.student_advisor;if(/نشاط|activity/.test(r))return ROLE_META.activity_leader;if(/إداري|اداري|administrative|admin_staff/.test(r))return ROLE_META.administrative_employee;if(/معلم|teacher|performance/.test(r))return ROLE_META.performance;return {app:r||'performance',file:'index.html',label:role||'مستخدم'} }
  function roleLabel(role,label){return label||roleMeta(role).label||role||'مستخدم'}

  function normalizeMembership(m){
    if(!m)return null;
    var role=norm(m.role||m.dbRole||m.activeRole||'');
    var meta=roleMeta(role);
    return {
      membershipId:String(m.membershipId||m.membership_id||m.id||''),
      schoolId:String(m.schoolId||m.school_id||m.school?.id||''),
      schoolName:String(m.schoolName||m.school_name||m.school?.school_name||m.school?.schoolName||''),
      schoolCode:String(m.schoolCode||m.school_code||m.school?.school_code||m.school?.schoolCode||''),
      role:role||meta.app,
      roleLabel:String(m.roleLabel||m.role_label||meta.label),
      app:meta.app,file:meta.file,
      userId:String(m.userId||m.user_id||''),
      status:m.status||'active',isPrimary:!!(m.isPrimary||m.is_primary||m.is_primary_manager)
    };
  }
  function unique(rows){var seen={};return (rows||[]).map(normalizeMembership).filter(function(m){if(!m||!m.schoolId||!m.role)return false;var k=m.schoolId+'|'+m.role;if(seen[k])return false;seen[k]=1;return !/inactive|disabled|blocked|deleted|archived|موقوف|معطل|محذوف/i.test(String(m.status||''))})}

  async function cloudMemberships(){
    try{if(window.PlatformCloudSession&&PlatformCloudSession.valid&&PlatformCloudSession.valid()&&PlatformCloudSession.memberships){var p=await PlatformCloudSession.memberships();return unique(p.memberships||p||[])}}catch(e){console.warn('[MultiSchool] cloud memberships',e)}
    return [];
  }
  async function directMemberships(){
    var out=[],em=email(),uid=userId();
    try{
      if(window.SmartSchoolSupabase&&SmartSchoolSupabase.getClient){var sb=SmartSchoolSupabase.getClient();if(sb){
        var rows=[];
        if(uid){try{var q1=await sb.from('school_members').select('*').eq('user_id',uid);if(q1.data)rows=rows.concat(q1.data)}catch(e){}}
        if(em){try{var q2=await sb.from('school_members').select('*').eq('email',em);if(q2.data)rows=rows.concat(q2.data)}catch(e){} try{var q3=await sb.from('school_members').select('*').eq('microsoft_email',em);if(q3.data)rows=rows.concat(q3.data)}catch(e){}}
        rows=unique(rows);var ids=[...new Set(rows.map(function(x){return x.schoolId}).filter(Boolean))];var schools={};
        if(ids.length){try{var qs=await sb.from('schools').select('*').in('id',ids);(qs.data||[]).forEach(function(s){schools[String(s.id)]=s})}catch(e){}}
        rows.forEach(function(m){var s=schools[m.schoolId]||{};m.schoolName=m.schoolName||s.school_name||s.schoolName||'';m.schoolCode=m.schoolCode||s.school_code||s.schoolCode||'';out.push(m)});
        if(em){try{var qu=await sb.from('users').select('id,school_id,email,role,status,name').eq('email',em).neq('status','deleted');var us=qu.data||[];var uids=[...new Set(us.map(function(x){return String(x.school_id||'')}).filter(Boolean))];var missing=uids.filter(function(id){return !schools[id]});if(missing.length){var qss=await sb.from('schools').select('*').in('id',missing);(qss.data||[]).forEach(function(s){schools[String(s.id)]=s})}us.forEach(function(x){var s=schools[String(x.school_id)]||{};out.push({membershipId:'user:'+x.id,schoolId:x.school_id,schoolName:s.school_name||s.schoolName||'',schoolCode:s.school_code||s.schoolCode||'',role:x.role,userId:x.id,status:x.status})})}catch(e){}}
        if(em){['manager_email','email','principal_email','admin_email','owner_email'].forEach(function(col){out.__managerPromises=out.__managerPromises||[];out.__managerPromises.push((async function(){try{var q=await sb.from('schools').select('*').eq(col,em).limit(1000);(q.data||[]).forEach(function(s){out.push({membershipId:'manager:'+s.id,schoolId:s.id,schoolName:s.school_name||s.schoolName||'',schoolCode:s.school_code||s.schoolCode||'',role:'manager',userId:uid||userId(),status:s.status||'active',isPrimary:true})})}catch(e){}})())})}
        if(out.__managerPromises){await Promise.all(out.__managerPromises);delete out.__managerPromises}
      }}
    }catch(e){console.warn('[MultiSchool] direct memberships',e)}
    return unique(out);
  }
  function localMemberships(){
    var out=[],u=user(),em=email();
    var lists=['smart_school_memberships','school_memberships','user_school_memberships'];
    lists.forEach(function(k){var a=parse(localStorage.getItem(k),[]);if(Array.isArray(a))a.forEach(function(m){if(!em||!m.email||norm(m.email)===em)out.push(m)})});
    if(Array.isArray(u.memberships))out=out.concat(u.memberships);
    if(Array.isArray(u.managedSchools))u.managedSchools.forEach(function(s){out.push({schoolId:s.schoolId||s.id,schoolName:s.schoolName||s.school_name,schoolCode:s.schoolCode||s.school_code,role:u.role||'manager',userId:u.id})});
    var sid=activeSchoolId();if(sid)out.push({membershipId:localStorage.getItem(ACTIVE_MEMBERSHIP)||'current',schoolId:sid,schoolName:localStorage.getItem('current_school_name')||localStorage.getItem('active_school_name')||u.schoolName||'',schoolCode:localStorage.getItem('school_code')||u.schoolCode||'',role:activeRole()||u.role||'performance',userId:u.id,status:'active'});
    return unique(out);
  }
  async function getMemberships(){var a=await cloudMemberships();var b=await directMemberships();return unique([].concat(a||[],b||[],localMemberships()||[]))}

  var SCOPE_RX=/(reports?_archive|category_goals|readiness|meeting|attendance|survey|evaluation|improvement|evidence|portfolio|discipline|student[_-]|teacher[_-]records|advisor[_-]|activity[_-]|weekly[_-]tasks|section[_-]library|records?_index|records?_participation|records?_attendance|records?_student|school_data|schoolData|operational|execution|plan_data|draft)/i;
  var GLOBAL_RX=/(supabase|session|token|password|currentuser|current_user|currentrole|active_school|current_school|school_id|school_name|membership|multiSchool|theme|app_activated|device|microsoft|onedrive|system_admin|smart_school_schools|smartSchool\.currentSchool|cloud|auth)/i;
  function scopeKeys(){var a=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&SCOPE_RX.test(k)&&!GLOBAL_RX.test(k)&&!/^schoolWorkspaceVault:/.test(k))a.push(k)}return a}
  function saveWorkspace(sid){if(!sid)return;var d={};scopeKeys().forEach(function(k){try{d[k]=localStorage.getItem(k)}catch(e){}});try{localStorage.setItem('schoolWorkspaceVault:'+sid,JSON.stringify(d))}catch(e){}}
  function restoreWorkspace(sid){if(!sid)return;scopeKeys().forEach(function(k){try{localStorage.removeItem(k)}catch(e){}});var d=parse(localStorage.getItem('schoolWorkspaceVault:'+sid),{});Object.keys(d||{}).forEach(function(k){try{localStorage.setItem(k,d[k])}catch(e){}})}

  function setContext(m){
    var old=activeSchoolId();if(old&&old!==m.schoolId)saveWorkspace(old);if(old!==m.schoolId)restoreWorkspace(m.schoolId);
    var pairs={active_school_id:m.schoolId,current_school_id:m.schoolId,school_id:m.schoolId,smart_school_id:m.schoolId,active_school_name:m.schoolName,current_school_name:m.schoolName,school_name:m.schoolName,persist_school:m.schoolName,smart_school_active_role:m.app,currentRole:m.role,currentUserId:m.userId||userId()};
    Object.keys(pairs).forEach(function(k){if(pairs[k]!=null)localStorage.setItem(k,String(pairs[k]))});if(m.schoolCode){localStorage.setItem('active_school_code',m.schoolCode);localStorage.setItem('school_code',m.schoolCode)}if(m.membershipId)localStorage.setItem(ACTIVE_MEMBERSHIP,m.membershipId);
    localStorage.removeItem(NS+'_follow_context');sessionStorage.removeItem(NS+'_follow_context');
    var u=user();u.schoolId=m.schoolId;u.activeSchoolId=m.schoolId;u.schoolName=m.schoolName;u.schoolCode=m.schoolCode;u.role=m.role;u.dbRole=m.role;u.activeRole=m.app;u.membershipId=m.membershipId;if(m.userId)u.id=m.userId;
    try{localStorage.setItem('currentSchoolUser',JSON.stringify(u));localStorage.setItem('currentUser',JSON.stringify(u));localStorage.setItem('smart_school_current_session',JSON.stringify(u));localStorage.setItem('smartSchool.currentSchool',JSON.stringify({id:m.schoolId,schoolId:m.schoolId,schoolName:m.schoolName,schoolCode:m.schoolCode}))}catch(e){}
    window.dispatchEvent(new CustomEvent('smart-school-context-changed',{detail:m}));
  }

  async function switchTo(m){
    if(!m)return;var curSid=activeSchoolId(),curRole=activeRole();if(String(curSid)===String(m.schoolId)&&roleMeta(curRole).app===m.app){closeModal();return}
    window.dispatchEvent(new CustomEvent('smart-school-context-changing',{detail:m}));setBusy(true,'جاري نقل مساحة العمل بأمان...');
    try{
      if(window.PlatformCloudSession&&PlatformCloudSession.valid&&PlatformCloudSession.valid()){
        if(!PlatformCloudSession.switchSchool)throw new Error('محرك الجلسة السحابية يحتاج إلى تحديث دعم تعدد المدارس.');
        var switched=await PlatformCloudSession.switchSchool(m.schoolId,m.role,m.membershipId);if(switched){m.userId=switched.userId||m.userId;m.membershipId=switched.membershipId||m.membershipId;m.schoolName=switched.schoolName||m.schoolName;m.schoolCode=switched.schoolCode||m.schoolCode;m.role=switched.role||m.role;var mm=normalizeMembership(m);m=mm||m;}
      }
      setContext(m);sessionStorage.setItem(NS+'_last_school_switch_at',new Date().toISOString());
      var q='?role='+encodeURIComponent(m.role)+'&uid='+encodeURIComponent(m.userId||'')+'&schoolId='+encodeURIComponent(m.schoolId)+'&school_name='+encodeURIComponent(m.schoolName||'')+'&membershipId='+encodeURIComponent(m.membershipId||'')+'&schoolMode=independent&independent=true';
      location.replace((m.file||roleMeta(m.role).file)+q);
    }catch(e){setBusy(false);alert('تعذر تبديل المدرسة بأمان:\n'+(e&&e.message?e.message:e)+'\n\nلم يتم تغيير المدرسة الحالية.');}
  }

  function ensureStyle(){if(document.getElementById('multiSchoolSwitcherStyle'))return;var st=document.createElement('style');st.id='multiSchoolSwitcherStyle';st.textContent=`
  #multiSchoolContextBtn{display:inline-flex;align-items:center;gap:7px;border:1px solid #bae6df;background:#f0fdfa;color:#0f766e;padding:8px 11px;border-radius:12px;font:800 11px Cairo,Tahoma,Arial;cursor:pointer;max-width:260px;white-space:nowrap;box-shadow:0 2px 8px rgba(15,118,110,.08)}#multiSchoolContextBtn .msSchool{max-width:135px;overflow:hidden;text-overflow:ellipsis}#multiSchoolContextBtn .msChevron{font-size:10px;opacity:.7}
  #multiSchoolModal{position:fixed;inset:0;z-index:2147483600;font-family:Cairo,Tahoma,Arial,sans-serif;direction:rtl}#multiSchoolModal .msShade{position:absolute;inset:0;background:rgba(15,23,42,.58);backdrop-filter:blur(4px)}#multiSchoolModal .msBox{position:absolute;inset:5vh max(18px,calc((100vw - 920px)/2));background:#fff;border-radius:26px;box-shadow:0 25px 90px rgba(0,0,0,.36);padding:24px;overflow:auto}#multiSchoolModal .msHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:18px}#multiSchoolModal h2{margin:0;color:#064e3b;font-size:22px;font-weight:900}#multiSchoolModal p{margin:7px 0 0;color:#64748b;font-size:12px;font-weight:700;line-height:1.8}#multiSchoolModal .msClose{border:0;background:#f1f5f9;color:#334155;width:38px;height:38px;border-radius:12px;font-size:18px;cursor:pointer}#multiSchoolModal .msGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}#multiSchoolModal .msCard{border:1px solid #dbe7e4;background:linear-gradient(145deg,#fff,#f7fffc);border-radius:20px;padding:16px;box-shadow:0 8px 24px rgba(15,118,110,.06)}#multiSchoolModal .msCard.current{border-color:#14b8a6;box-shadow:0 0 0 2px rgba(20,184,166,.12)}#multiSchoolModal .msSchoolName{font-size:15px;font-weight:900;color:#0f5132;display:flex;align-items:center;justify-content:space-between;gap:10px}#multiSchoolModal .msState{font-size:9px;font-weight:900;border-radius:999px;padding:5px 8px;background:#f1f5f9;color:#64748b;white-space:nowrap}#multiSchoolModal .msState.active{background:#ccfbf1;color:#0f766e}#multiSchoolModal .msCode{font-size:10px;color:#94a3b8;margin-top:4px;direction:ltr;text-align:right}#multiSchoolModal .msRoles{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}#multiSchoolModal .msRole{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:12px;padding:8px 10px;font-size:11px;font-weight:900;cursor:pointer}#multiSchoolModal .msRole:hover,#multiSchoolModal .msRole.current{background:#0f766e;color:#fff;border-color:#0f766e}#multiSchoolModal .msEmpty{padding:36px;text-align:center;color:#64748b;background:#f8fafc;border-radius:18px}#multiSchoolBusy{position:fixed;inset:0;z-index:2147483700;background:rgba(255,255,255,.88);display:flex;align-items:center;justify-content:center;font:900 14px Cairo,Tahoma;color:#0f766e;backdrop-filter:blur(3px)}@media(max-width:800px){#multiSchoolContextBtn .msRoleTxt{display:none}#multiSchoolModal .msBox{inset:2vh 10px;padding:16px}}@media print{#multiSchoolContextBtn,#multiSchoolModal,#multiSchoolBusy{display:none!important}}`;document.head.appendChild(st)}
  function setBusy(on,text){var b=document.getElementById('multiSchoolBusy');if(!on){if(b)b.remove();return}if(!b){b=document.createElement('div');b.id='multiSchoolBusy';document.body.appendChild(b)}b.textContent=text||'جاري تبديل المدرسة...'}
  var cache=[];
  function group(rows){var map={};rows.forEach(function(m){if(!map[m.schoolId])map[m.schoolId]={id:m.schoolId,name:m.schoolName||'المدرسة',code:m.schoolCode||'',roles:[]};map[m.schoolId].roles.push(m)});return Object.values(map)}
  function closeModal(){var m=document.getElementById('multiSchoolModal');if(m)m.remove()}
  function openModal(rows,force){ensureStyle();closeModal();rows=rows||cache;var sid=activeSchoolId(),ar=roleMeta(activeRole()).app,groups=group(rows);var modal=document.createElement('div');modal.id='multiSchoolModal';modal.innerHTML='<div class="msShade"></div><div class="msBox"><div class="msHead"><div><h2>المدرسة والدور الحالي</h2><p>يمكن للحساب الواحد العمل في أكثر من مدرسة أو دور. كل مدرسة تحتفظ ببياناتها وتقاريرها وملفاتها مستقلة تمامًا.</p></div><button class="msClose" type="button">×</button></div>'+(groups.length?'<div class="msGrid">'+groups.map(function(g){var cur=String(g.id)===String(sid);return '<section class="msCard '+(cur?'current':'')+'"><div class="msSchoolName"><span>🏫 '+esc(g.name)+'</span><span class="msState '+(cur?'active':'')+'">'+(cur?'المدرسة النشطة':'غير نشطة')+'</span></div><div class="msCode">'+esc(g.code||g.id)+'</div><div class="msRoles">'+g.roles.map(function(m){var c=cur&&m.app===ar;return '<button type="button" class="msRole '+(c?'current':'')+'" data-ms="'+esc(m.membershipId||m.schoolId+'|'+m.role)+'">'+esc(roleLabel(m.role,m.roleLabel))+(c?' — الحالي':'')+'</button>'}).join('')+'</div></section>'}).join('')+'</div>':'<div class="msEmpty">لم يتم العثور على عضويات مدارس لهذا الحساب. ستبقى المدرسة الحالية دون تغيير.</div>')+'</div>';document.body.appendChild(modal);modal.querySelector('.msClose').onclick=function(){if(!force)closeModal()};modal.querySelector('.msShade').onclick=function(){if(!force)closeModal()};Array.from(modal.querySelectorAll('.msRole')).forEach(function(btn){btn.onclick=function(){var id=btn.getAttribute('data-ms');var m=rows.find(function(x){return (x.membershipId||x.schoolId+'|'+x.role)===id});switchTo(m)}})}
  function buttonText(m){var sn=m&&m.schoolName||localStorage.getItem('current_school_name')||localStorage.getItem('active_school_name')||'المدرسة الحالية';var rl=m?roleLabel(m.role,m.roleLabel):roleLabel(activeRole());return '<span>🏫</span><span class="msSchool">'+esc(sn)+'</span><span class="msRoleTxt">— '+esc(rl)+'</span><span class="msChevron">▼</span>'}
  function mountButton(rows){ensureStyle();var sid=activeSchoolId(),ar=roleMeta(activeRole()).app;var cur=rows.find(function(m){return String(m.schoolId)===String(sid)&&m.app===ar})||rows.find(function(m){return String(m.schoolId)===String(sid)})||rows[0];var btn=document.getElementById('multiSchoolContextBtn');if(!btn){btn=document.createElement('button');btn.id='multiSchoolContextBtn';btn.type='button';var anchor=document.querySelector('.im-static-messaging-btn');var host=anchor&&anchor.parentElement;if(host)host.insertBefore(btn,anchor);else{var toolbar=document.querySelector('.toolbar,#supervisorToolbar,header .flex.gap-2,header');if(toolbar)toolbar.appendChild(btn);else document.body.insertBefore(btn,document.body.firstChild)}}btn.innerHTML=buttonText(cur);btn.title='تغيير المدرسة أو الدور';btn.onclick=function(){openModal(cache,false)}}
  async function boot(){try{cache=await getMemberships();mountButton(cache);var sid=activeSchoolId(),ar=roleMeta(activeRole()).app;var valid=cache.some(function(m){return String(m.schoolId)===String(sid)&&m.app===ar});if(cache.length>1&&(!sid||!valid)&&!sessionStorage.getItem(NS+'_membership_prompted')){sessionStorage.setItem(NS+'_membership_prompted','1');setTimeout(function(){openModal(cache,true)},350)}}catch(e){console.warn('[MultiSchool] boot',e);mountButton(localMemberships())}}
  document.addEventListener('DOMContentLoaded',boot);window.addEventListener('platform-cloud-session-ready',function(){setTimeout(boot,100)});setTimeout(boot,900);
  window.MultiSchoolSwitcher={open:async function(){cache=await getMemberships();mountButton(cache);openModal(cache,false)},getMemberships:getMemberships,switchTo:switchTo,setContext:setContext,current:function(){return {schoolId:activeSchoolId(),role:activeRole(),membershipId:localStorage.getItem(ACTIVE_MEMBERSHIP)||''}}};
})();