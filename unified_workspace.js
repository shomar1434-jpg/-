(function(){
  'use strict';
  if (window.__UNIFIED_WORKSPACE_V2__) return;
  window.__UNIFIED_WORKSPACE_V2__ = true;

  var FILE=(location.pathname||'').split('/').pop()||'index.html';
  var ROOT_MAP={
    'activity_leader_records.html':'activity_leader.html',
    'student_advisor_analysis_tool.html':'student_advisor.html',
    'wakil-records.html':'agent.html',
    'administrative_employee_plan.html':'administrative_employee_portal.html',
    'administrative_employee_execution.html':'administrative_employee_portal.html',
    'administrative_employee_evaluation.html':'administrative_employee_portal.html',
    'administrative_employee_improvement.html':'administrative_employee_portal.html',
    'administrative_employee_library.html':'administrative_employee_portal.html',
    'admin_employee_management.html':'administrative_employee_portal.html',
    'self_evaluation_records.html':'manager.html',
    'manager_exams_management.html':'manager.html',
    'agent_exams_management.html':'agent.html',
    'teacher_comprehensive_record.html':'teacher.html',
    'teacher_data_analysis.html':'teacher.html',
    'health_advisor_comprehensive_record.html':'health_advisor.html',
    'kindergarten_teacher_comprehensive_record.html':'kindergarten_teacher.html'
  };
  var LABELS={
    ssCloud:['☁️','السحابة','إدارة الملفات والحفظ السحابي'],
    uwCloud:['☁️','السحابة','إدارة الملفات والحفظ السحابي'],
    ssAlert:['🔔','إرسال التنبيهات','إرسال تنبيه للمستخدمين'],
    ssInbox:['📥','التنبيهات','عرض التنبيهات الواردة'],
    ssMeetWallet:['🗂️','محفظة الاجتماعات','محاضر وملفات الاجتماعات'],
    ssMeetingRoom:['🎥','قاعة الاجتماعات','إدارة اجتماعات Microsoft Teams'],
    ssTeachers:['👩‍🏫','متابعة المعلمين','فتح متابعة حسابات المعلمين'],
    ssAgents:['🧑‍💼','متابعة الوكلاء','فتح متابعة حسابات الوكلاء'],
    ssStudentAdvisors:['🧭','متابعة الموجهين','فتح متابعة الموجهين الطلابيين'],
    ssActivityLeaders:['🏃','متابعة النشاط','فتح متابعة رواد النشاط'],
    ssActivate:['👥','إدارة الحسابات','تفعيل وتعطيل حسابات المستخدمين'],
    ssTeacherRecords:['📚','السجلات','فتح السجلات المرتبطة بالقسم'],
    ssAdvisorRecordsArchive:['🗄️','أرشيف السجلات','فتح أرشيف سجلات القسم'],
    ssDataAnalysis:['📊','تحليل البيانات','فتح أداة تحليل البيانات']
  };

  function css(){
    if(document.getElementById('uwV2Style')) return;
    var s=document.createElement('style'); s.id='uwV2Style'; s.textContent=`
      /* ===== توحيد مساحة العمل V2: لا قوائم جانبية أو عائمة ===== */
      #manualDockControlPanel,#manualDockTip,#ssFinalBar,.ss-final-bar,.uw-generic-bar,#smartSchoolFloatingBar,.smart-school-floating-bar,#top-floating-icons,.top-floating-icons,.floating-icons,.global-floating-icons,.top-actions-floating,.quick-actions-floating{display:none!important;visibility:hidden!important;pointer-events:none!important}
      html.mdw-focus-mode .mdw-managed,.mdw-managed,.mdw-focus-hidden,.mdw-collapsed-top,.mdw-collapsed-left,.mdw-collapsed-bottom{transform:none!important;opacity:1!important;filter:none!important;pointer-events:auto!important}
      header{position:relative!important}
      .uw-header-actions-cluster{position:absolute!important;left:22px!important;top:50%!important;transform:translateY(-50%)!important;display:flex!important;align-items:center!important;gap:8px!important;direction:ltr!important;z-index:80!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important}
      .uw-session-btn,.uw-header-icon-action{position:relative!important;width:40px!important;height:40px!important;min-width:40px!important;max-width:40px!important;min-height:40px!important;max-height:40px!important;padding:0!important;margin:0!important;border-radius:12px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:0!important;white-space:nowrap!important;text-decoration:none!important;font-size:18px!important;font-weight:900!important;cursor:pointer!important;border:1px solid #dbe7e5!important;background:#fff!important;color:#0f766e!important;box-shadow:0 4px 12px rgba(15,23,42,.05)!important;overflow:visible!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
      .uw-session-btn.home{background:#eff6ff!important;color:#1d4ed8!important;border-color:#bfdbfe!important}.uw-session-btn.exit{background:#fff1f2!important;color:#be123c!important;border-color:#fecdd3!important}
      .uw-header-icon-action.uw-settings{background:#f0fdfa!important;color:#0f766e!important;border-color:#b8e4dc!important}.uw-header-icon-action.uw-messages{background:#f8f5ff!important;color:#6d4cc4!important;border-color:#ddd4f8!important}
      .uw-session-btn>span,.uw-header-icon-action .uw-hide-label{display:none!important}
      .uw-session-btn:hover,.uw-header-icon-action:hover{transform:translateY(-2px)!important;box-shadow:0 8px 18px rgba(15,118,110,.12)!important}
      .uw-session-btn::after,.uw-header-icon-action::after{content:attr(data-uw-label);position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%) translateY(-3px);background:#0f2930;color:#fff;border-radius:8px;padding:6px 9px;font-size:10px;font-weight:800;line-height:1;white-space:nowrap;opacity:0;visibility:hidden;pointer-events:none;transition:.15s;box-shadow:0 6px 16px rgba(15,23,42,.18);direction:rtl;z-index:9999}
      .uw-session-btn:hover::after,.uw-header-icon-action:hover::after,.uw-session-btn:focus-visible::after,.uw-header-icon-action:focus-visible::after{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}
      .uw-ops-section{width:100%;margin:0 0 22px;padding:16px;border:1px solid #dbe7e2;border-radius:24px;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(240,253,250,.82));box-shadow:0 10px 24px rgba(15,118,110,.06)}
      .uw-ops-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.uw-ops-head h3{margin:0;font-size:15px;font-weight:900;color:#0f5132}.uw-ops-head p{margin:3px 0 0;color:#64748b;font-size:10px;font-weight:700}
      .uw-ops-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:stretch}
      .uw-operation-card{border:1px solid #e2e8f0;background:#fff;border-radius:18px;padding:11px 13px;min-height:78px;display:grid;grid-template-columns:44px minmax(0,1fr);grid-template-rows:auto auto;column-gap:11px;row-gap:2px;align-items:center;text-align:right;cursor:pointer;transition:.18s;box-shadow:0 5px 14px rgba(15,23,42,.04);font-family:inherit;color:#0f172a;width:100%}
      .uw-operation-card:hover{transform:translateY(-2px);border-color:#99d5c3;box-shadow:0 10px 20px rgba(15,118,110,.09)}
      .uw-operation-card .uw-icon{grid-row:1/3;width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:#f0fdfa;font-size:21px}.uw-operation-card strong{font-size:13px;align-self:end}.uw-operation-card small{font-size:10px;line-height:1.5;color:#64748b;font-weight:700;align-self:start}
      /* لا نغيّر أبعاد شبكات وبطاقات الأقسام الأصلية */
      #welcome-dashboard .content-overlay{padding-right:0!important}
      /* فتح الصفحات التشغيلية المستقلة بكامل الشاشة */
      .uw-fullscreen-internal{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;z-index:2147482500!important;background:#fff!important;overflow:hidden!important}
      .uw-fullscreen-internal>.content-overlay{width:100%!important;height:100%!important;max-width:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important}
      .uw-fullscreen-internal main{max-width:none!important;width:100%!important;flex:1!important;min-height:0!important;margin:0!important;padding:0!important}
      .uw-fullscreen-internal iframe{width:100%!important;height:100%!important;min-height:0!important;border:0!important;border-radius:0!important;display:block!important}
      #ssFinalBackdrop.uw-fullscreen-internal,#smartToolModal.uw-fullscreen-internal{padding:0!important;background:#fff!important;align-items:stretch!important;justify-content:stretch!important}
      #ssFinalBackdrop.uw-fullscreen-internal>#ssFinalPanel,#ssFinalBackdrop.uw-fullscreen-internal>[class*="panel"],#smartToolModal.uw-fullscreen-internal>div{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;box-shadow:none!important}
      .uw-fullscreen-internal main>div:has(>iframe),.uw-fullscreen-internal .agent-records-card,.uw-fullscreen-internal .self-eval-iframe-wrap{width:100%!important;height:100%!important;max-width:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
      .uw-backbar{position:sticky;top:0;z-index:2147482600;display:flex;align-items:center;gap:10px;padding:10px 16px;background:rgba(255,255,255,.96);border-bottom:1px solid #e2e8f0;backdrop-filter:blur(12px)}
      .uw-backbar a,.uw-backbar button{border:0;border-radius:12px;padding:9px 14px;background:#0f766e;color:white;font:800 12px inherit;cursor:pointer;text-decoration:none}.uw-backbar span{font-weight:900;color:#334155}
      @media(max-width:720px){.uw-header-actions-cluster{left:10px!important;gap:5px!important}.uw-session-btn,.uw-header-icon-action{width:36px!important;height:36px!important;min-width:36px!important;max-width:36px!important;min-height:36px!important;max-height:36px!important;font-size:16px!important}.uw-ops-section{padding:12px;border-radius:20px}.uw-ops-grid{grid-template-columns:1fr}.uw-operation-card{min-height:72px;padding:10px 12px}}
      @media print{.uw-session-btn,.uw-ops-section,.uw-backbar{display:none!important}}
    `; document.head.appendChild(s);
  }

  function clearLegacy(){
    ['manualDockControlPanel','manualDockTip'].forEach(function(id){var n=document.getElementById(id);if(n)n.remove()});
    document.documentElement.classList.remove('mdw-focus-mode');
    document.querySelectorAll('.mdw-managed,.mdw-focus-hidden,.mdw-collapsed-top,.mdw-collapsed-left,.mdw-collapsed-bottom').forEach(function(n){n.classList.remove('mdw-managed','mdw-focus-hidden','mdw-collapsed-top','mdw-collapsed-left','mdw-collapsed-bottom','mdw-top-rail','mdw-left-rail','mdw-bottom-rail')});
    try{localStorage.removeItem('manual_docking_workspace_state_v1');localStorage.removeItem('manual_docking_focus_mode_v1')}catch(e){}
  }

  function isSystemAdminContext(){
    try{
      var qp=new URLSearchParams(location.search||'');
      if(qp.get('systemAdmin')==='1'||qp.get('systemAdminReturn')==='1') return true;
      if(qp.get('returnHome')&&/index\.html/i.test(qp.get('returnHome'))) return true;
      if(sessionStorage.getItem('system_admin_context')==='1'||sessionStorage.getItem('system_admin_verified')==='true') return true;
    }catch(e){}
    return false;
  }
  function systemAdminHome(){
    try{var qp=new URLSearchParams(location.search||'');var r=qp.get('returnHome');if(r&&/index\.html/i.test(r))return r;}catch(e){}
    return 'index.html?systemAdminReturn=1';
  }

  function roleRoot(){
    if(isSystemAdminContext()) return systemAdminHome();
    try{
      var qp=new URLSearchParams(location.search||'');
      var rt=qp.get('return_to')||qp.get('returnTo')||'';
      if(rt && /\.html(?:$|[?#])/.test(rt)) return rt.split(/[?#]/)[0].split('/').pop();
      if(document.referrer){var rf=new URL(document.referrer).pathname.split('/').pop();if(/^(manager|agent|teacher|student_advisor|activity_leader|health_advisor|kindergarten_teacher|administrative_employee_portal)\.html$/.test(rf))return rf;}
    }catch(e){}
    if(ROOT_MAP[FILE]) return ROOT_MAP[FILE];
    if(/manager/.test(FILE)) return 'manager.html';
    if(/agent|wakil/.test(FILE)) return 'agent.html';
    if(/student_advisor/.test(FILE)) return 'student_advisor.html';
    if(/activity_leader/.test(FILE)) return 'activity_leader.html';
    if(/health_advisor/.test(FILE)) return 'health_advisor.html';
    if(/kindergarten_teacher/.test(FILE)) return 'kindergarten_teacher.html';
    if(/teacher/.test(FILE)) return 'teacher.html';
    if(/administrative_employee|admin_employee/.test(FILE)) return 'administrative_employee_portal.html';
    try{
      var ar=String(localStorage.getItem('smart_school_active_role')||localStorage.getItem('platform_file_session_role')||'').toLowerCase();
      if(/leadership|manager|principal|مدير/.test(ar)) return 'manager.html';
      if(/agency|agent|wakil|deputy|وكيل/.test(ar)) return 'agent.html';
      if(/student_advisor|counselor|موجه/.test(ar)) return 'student_advisor.html';
      if(/health_advisor|health|صحي/.test(ar)) return 'health_advisor.html';
      if(/kindergarten|رياض/.test(ar)) return 'kindergarten_teacher.html';
      if(/activity|نشاط/.test(ar)) return 'activity_leader.html';
      if(/administrative|admin_staff|إداري/.test(ar)) return 'administrative_employee_portal.html';
      if(/teacher|performance|معلم/.test(ar)) return 'teacher.html';
    }catch(e){}
    return 'school-login.html';
  }

  function isSectionRootPage(){
    var f=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    return ['index.html','manager.html','agent.html','student_advisor.html','health_advisor.html','teacher.html','kindergarten_teacher.html','activity_leader.html','administrative_employee_portal.html','school-login.html','register.html'].indexOf(f)>=0;
  }

  function addHeaderActions(){
    if(!isSectionRootPage()) return;
    var settings=document.querySelector('header button[onclick*="openAppSettings"]');
    var messages=document.querySelector('header .im-static-messaging-btn');
    var header=document.querySelector('#welcome-dashboard header, body>header, header');
    if(!header) return;

    var cluster=document.getElementById('uwHeaderActionsCluster');
    if(!cluster){
      cluster=document.createElement('div');
      cluster.id='uwHeaderActionsCluster';
      cluster.className='uw-header-actions-cluster';
      cluster.setAttribute('aria-label','أدوات الشريط العلوي');
      header.appendChild(cluster);
    }

    var home=document.getElementById('uwHomeHeader');
    if(!home){
      home=document.createElement('a');home.id='uwHomeHeader';home.className='uw-session-btn home';home.href=roleRoot();
      home.innerHTML='🏠<span>الرئيسية</span>';home.setAttribute('data-uw-label','الرئيسية');home.setAttribute('aria-label','الرئيسية');home.title='الرئيسية';
    }
    var exit=document.getElementById('uwExitHeader');
    if(!exit){
      exit=document.createElement('button');exit.id='uwExitHeader';exit.type='button';exit.className='uw-session-btn exit';
      exit.innerHTML='⏻<span>الخروج</span>';exit.setAttribute('data-uw-label','الخروج');exit.setAttribute('aria-label','الخروج');exit.title='الخروج';
      exit.addEventListener('click',async function(){
        if(isSystemAdminContext()){
          try{var sb=window.SmartSchoolSupabase&&window.SmartSchoolSupabase.getClient&&window.SmartSchoolSupabase.getClient();if(sb&&sb.auth&&sb.auth.signOut) await sb.auth.signOut();}catch(e){}
          try{sessionStorage.removeItem('system_admin_context');sessionStorage.removeItem('system_admin_verified');localStorage.removeItem('is_admin_session');localStorage.removeItem('admin_verified');}catch(e){}
          location.replace('index.html');return;
        }
        try{if(window.PlatformCloudSession&&typeof window.PlatformCloudSession.clear==='function') window.PlatformCloudSession.clear();}catch(e){}
        try{['smart_school_active_school_id','smart_school_active_membership_id','smart_school_active_role','active_school_id','active_school_name','current_school_id','current_school_name','currentRole','user_role'].forEach(function(k){localStorage.removeItem(k);sessionStorage.removeItem(k);});}catch(e){}
        location.replace('school-login.html');
      });
    }

    function iconify(el,kind,label,icon){
      if(!el)return null;
      el.classList.add('uw-header-icon-action',kind);
      el.setAttribute('data-uw-label',label);el.setAttribute('aria-label',label);el.title=label;
      if(!el.dataset.uwIconified){
        el.dataset.uwIconified='1';
        Array.from(el.childNodes).forEach(function(n){
          if(n.nodeType===3 && String(n.textContent||'').trim()){var sp=document.createElement('span');sp.className='uw-hide-label';sp.textContent=n.textContent;n.replaceWith(sp)}
          else if(n.nodeType===1){n.classList.add('uw-hide-label')}
        });
        var ico=document.createElement('span');ico.className='uw-action-glyph';ico.setAttribute('aria-hidden','true');ico.textContent=icon;el.insertBefore(ico,el.firstChild);
      }
      return el;
    }
    settings=iconify(settings,'uw-settings','إعدادات مخصصة','⚙️');
    messages=iconify(messages,'uw-messages','المراسلات الداخلية','✉️');

    /* ترتيب ثابت من أقصى يسار الشريط: الرئيسية، الخروج، الإعدادات، المراسلات */
    [home,exit,settings,messages].forEach(function(el){if(el)cluster.appendChild(el)});
  }

  function tipText(el){var t=el.querySelector&&el.querySelector('.ss-tip');return (t&&t.textContent||el.title||el.getAttribute('aria-label')||'').trim()}
  function infoFor(el){var x=LABELS[el.id];if(x)return x;var text=tipText(el)||'أداة القسم';var icon=(el.textContent||'').trim().charAt(0)||'◈';return [icon,text,'فتح '+text]}

  var TOOL_SKIP={ssBack:1,ssExit:1,ssRegLink:1,uwSettings:1,uwMessages:1};
  var lastToolsSignature='';

  function operationHost(){
    var main=document.querySelector('#welcome-dashboard main');
    if(!main) return null;

    /* تنظيف أي نسخة مكررة قد تكون نتجت عن الإصدارات السابقة */
    var sections=Array.from(document.querySelectorAll('#uwOperationsSection'));
    var sec=null;
    sections.forEach(function(node,idx){
      if(!sec && main.contains(node)) sec=node;
      else if(node&&node.parentNode) node.parentNode.removeChild(node);
    });
    if(!sec){
      sec=document.createElement('section');
      sec.id='uwOperationsSection';
      sec.className='uw-ops-section';
      sec.innerHTML='<div class="uw-ops-head"><div><h3>الأدوات والخدمات</h3><p>خدمات القسم أصبحت بطاقات داخل مساحة العمل بدل الأيقونات الجانبية.</p></div></div><div class="uw-ops-grid"></div>';
      main.appendChild(sec);
    }
    return sec.querySelector('.uw-ops-grid');
  }

  function collectTools(){
    var unique={};
    document.querySelectorAll('#ssFinalBar,.ss-final-bar').forEach(function(bar){
      Array.from(bar.children||[]).forEach(function(el){
        if(!el||!el.id||TOOL_SKIP[el.id]||el.classList.contains('uw-separator')) return;
        if(!unique[el.id]) unique[el.id]=el;
      });
      bar.style.setProperty('display','none','important');
      bar.style.setProperty('visibility','hidden','important');
      bar.setAttribute('aria-hidden','true');
    });
    return unique;
  }

  function syncOperations(force){
    var tools=collectTools();
    var ids=Object.keys(tools).sort();
    if(!ids.length) return false;
    var grid=operationHost();
    if(!grid) return false;
    var signature=ids.join('|');

    /* إذا كانت البنية سليمة بالفعل فلا نلمس DOM مطلقًا */
    var existing=Array.from(grid.querySelectorAll('.uw-operation-card'));
    var existingIds=existing.map(function(c){return c.getAttribute('data-source-id')||''}).sort();
    var uniqueExisting=new Set(existingIds.filter(Boolean));
    var healthy=existing.length===ids.length && uniqueExisting.size===ids.length && existingIds.join('|')===signature;
    if(!force && healthy && lastToolsSignature===signature) return true;

    /* إعادة بناء حتمية: بطاقة واحدة فقط لكل أداة */
    grid.replaceChildren();
    ids.forEach(function(id){
      var el=tools[id],info=infoFor(el),card=document.createElement('button');
      card.type='button';
      card.className='uw-operation-card';
      card.setAttribute('data-source-id',id);
      card.innerHTML='<span class="uw-icon">'+info[0]+'</span><strong>'+info[1]+'</strong><small>'+info[2]+'</small>';
      card.addEventListener('click',function(ev){
        ev.preventDefault();
        var source=document.getElementById(id);
        if(source) source.click();
      });
      grid.appendChild(card);
    });
    lastToolsSignature=signature;
    return true;
  }

  function addBackToStandalone(){ /* handled by verified per-page audit */ }

  function fullscreenView(view){
    if(!view)return;
    view.classList.add('uw-fullscreen-internal');
    view.style.setProperty('position','fixed','important');
    view.style.setProperty('inset','0','important');
    view.style.setProperty('width','100vw','important');
    view.style.setProperty('height','100vh','important');
    view.style.setProperty('max-width','none','important');
    view.style.setProperty('max-height','none','important');
    view.style.setProperty('margin','0','important');
    view.style.setProperty('padding','0','important');
    view.style.setProperty('border-radius','0','important');
  }


  function operationalFrame(frame){
    if(!frame||frame.dataset.uwSkipFullscreen==='1') return false;
    if(frame.hasAttribute('srcdoc')) return false;
    var src=(frame.getAttribute('src')||'').split('?')[0].toLowerCase();
    if(!src||src==='about:blank'||src.indexOf('blob:')===0||src.indexOf('.pdf')>-1)return false;
    return /\.html?$/.test(src);
  }
  function fullscreenFrames(){
    document.querySelectorAll('iframe').forEach(function(frame){
      if(!operationalFrame(frame))return;
      var view=frame.closest('.global-app-bg,[id$="-view"],[id$="View"],.modal,.popup,[role="dialog"],#smartToolModal,#ssFinalBackdrop');
      if(!view)view=frame.parentElement;
      fullscreenView(view);
      frame.style.setProperty('width','100%','important');
      frame.style.setProperty('height','100%','important');
      frame.style.setProperty('min-height','0','important');
      frame.style.setProperty('border','0','important');
      frame.style.setProperty('border-radius','0','important');
      var wrap=frame.parentElement;
      if(wrap){
        wrap.style.setProperty('width','100%','important');
        wrap.style.setProperty('height','100%','important');
        wrap.style.setProperty('max-width','none','important');
        wrap.style.setProperty('margin','0','important');
        wrap.style.setProperty('padding','0','important');
        wrap.style.setProperty('border','0','important');
        wrap.style.setProperty('border-radius','0','important');
      }
    });
    /* أطر about:blank التي تستقبل صفحة HTML لاحقًا: نراقب src نفسه فقط. */
    document.querySelectorAll('iframe[src="about:blank"],iframe:not([src])').forEach(function(frame){
      if(frame.dataset.uwSrcWatch==='1')return;
      frame.dataset.uwSrcWatch='1';
      new MutationObserver(function(){
        if(operationalFrame(frame))fullscreenFrames();
      }).observe(frame,{attributes:true,attributeFilter:['src']});
    });
  }


  function removeStrayFloating(){
    document.querySelectorAll('.ss-cloud-toolbar').forEach(function(n){n.style.display='none'});
  }

  function boot(){
    css();clearLegacy();addHeaderActions();addBackToStandalone();
    /* تنظيف فوري ثم محاولات محدودة فقط لاستيعاب أي شريط يُبنى عند DOMContentLoaded */
    syncOperations(true);fullscreenFrames();removeStrayFloating();
    var tries=0,t=setInterval(function(){
      tries++;
      addHeaderActions();
      syncOperations(false);
      fullscreenFrames();
      removeStrayFloating();
      if(tries>=12) clearInterval(t);
    },180);
    window.addEventListener('load',function(){syncOperations(true);fullscreenFrames();removeStrayFloating();},{once:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
