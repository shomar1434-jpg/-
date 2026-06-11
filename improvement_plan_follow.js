
(function(){
  'use strict';
  if (window.__IMPROVEMENT_PLAN_FOLLOW_EXTERNAL_V3__) return;
  window.__IMPROVEMENT_PLAN_FOLLOW_EXTERNAL_V3__ = true;

  var NS = 'smartSchoolUnifiedOpsV2';
  var PLAN_URL = 'improvement_plan_linked.html';
  var unlockTimer = null;

  function qs(){ return new URLSearchParams(location.search || ''); }
  function parse(v,d){ try { return JSON.parse(v || JSON.stringify(d)); } catch(e){ return d; } }
  function read(k,d){ try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch(e){ return d; } }
  function write(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ alert('تعذر الحفظ بسبب امتلاء مساحة التخزين في المتصفح.'); } }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function uid(p){ return (p || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

  function isFollowMode(){
    var q = qs();
    var mode = String(q.get('mode') || '').toLowerCase();
    return q.get('follow') === '1' || q.get('readonly') === '1' || q.get('monitoring') === 'true' || mode.indexOf('supervisor') > -1;
  }

  function viewerAllowed(){
    var q = qs();
    var v = String(q.get('viewerRole') || q.get('viewer') || q.get('returnRole') || window.FOLLOW_VIEWER_ROLE || '').toLowerCase();
    return /manager|agent|مدير|وكيل/.test(v);
  }

  function allUsers(){
    var out = [];
    ['smartSchoolUnifiedOpsV2_users','offline_users_backup','smart_school_users',NS+'_users'].forEach(function(k){
      var a = parse(localStorage.getItem(k), []);
      if (Array.isArray(a)) out = out.concat(a);
    });
    return out;
  }

  function targetInfo(){
    var q = qs();
    var last = parse(sessionStorage.getItem(NS + '_last_follow_target'), {});
    var t = window.FOLLOW_TARGET_USER || last || {};
    var id = q.get('targetUser') || q.get('followUserId') || q.get('userId') || q.get('uid') || window.FOLLOW_TARGET_ID || t.id || '';
    var email = String(q.get('followEmail') || q.get('targetEmail') || window.FOLLOW_TARGET_EMAIL || t.email || t.schoolEmail || '').trim().toLowerCase();
    var role = q.get('targetRole') || window.FOLLOW_TARGET_ROLE || t.role || '';

    var found = allUsers().find(function(u){
      return String(u.id || '') === String(id || '') ||
             (email && String(u.email || u.schoolEmail || '').trim().toLowerCase() === email);
    });
    if (found){
      t = Object.assign({}, t, found);
      id = id || found.id || '';
      email = email || String(found.email || found.schoolEmail || '').trim().toLowerCase();
      role = role || found.role || '';
    }

    if (!role){
      var file = String(location.pathname.split('/').pop() || '');
      if (/agent/i.test(file)) role = 'agent';
      else if (/student_advisor/i.test(file)) role = 'student_advisor';
      else if (/activity_leader/i.test(file)) role = 'activity_leader';
      else role = 'teacher';
    }

    return {
      id: String(id || email || role),
      email: email,
      role: String(role),
      name: String(t.name || t.fullName || t.username || q.get('followName') || q.get('targetName') || 'المستخدم المستهدف')
    };
  }

  function roleName(r){
    r = String(r || '');
    if (/agent/.test(r)) return 'الوكيل';
    if (/student_advisor/.test(r)) return 'الموجه الطلابي';
    if (/activity_leader/.test(r)) return 'رائد النشاط';
    if (/teacher|performance/.test(r)) return 'المعلم';
    return 'المستخدم';
  }

  function viewerRole(){
    var q = qs();
    var v = String(q.get('viewerRole') || q.get('viewer') || q.get('returnRole') || window.FOLLOW_VIEWER_ROLE || 'manager').toLowerCase();
    return /agent|وكيل/.test(v) ? 'agent' : 'manager';
  }

  function nextPlanNo(){
    var key = NS + '_improvement_plan_counter';
    var n = parseInt(localStorage.getItem(key) || '0', 10);
    n = isFinite(n) ? n + 1 : 1;
    localStorage.setItem(key, String(n));
    return n;
  }

  function saveNotif(role, n){
    var key = NS + '_notifications_' + role;
    var arr = read(key, []);
    arr.unshift(Object.assign({id:uid('notif'), createdAt:new Date().toISOString(), read:false}, n));
    write(key, arr);
  }

  function collectValues(doc){
    var values = [];
    if (!doc) return values;
    doc.querySelectorAll('input,textarea,select').forEach(function(el){
      values.push({tag:el.tagName.toLowerCase(), id:el.id || '', name:el.name || '', value:el.value || ''});
    });
    return values;
  }

  function applyValues(doc, values){
    if (!doc || !Array.isArray(values)) return;
    var els = doc.querySelectorAll('input,textarea,select');
    values.forEach(function(v,i){ if (els[i]) els[i].value = v.value || ''; });
  }

  function prefill(doc){
    if (!doc) return;
    var t = targetInfo();
    var inputs = doc.querySelectorAll('.primaryInfo input');
    if (inputs[0] && !inputs[0].value) inputs[0].value = t.name;
    var targetName = doc.getElementById('targetName');
    if (targetName && !targetName.value) targetName.value = t.name;
  }

  function printableHtmlFromFrame(frame){
    var d = frame && frame.contentDocument;
    if (!d) return '';
    var clone = d.documentElement.cloneNode(true);
    var srcEls = d.querySelectorAll('input,textarea,select');
    var cloneEls = clone.querySelectorAll('input,textarea,select');

    srcEls.forEach(function(src,i){
      var el = cloneEls[i];
      if (!el) return;
      var tag = el.tagName.toLowerCase();
      if (tag === 'textarea') {
        el.textContent = src.value || '';
      } else if (tag === 'select') {
        Array.prototype.forEach.call(el.options || [], function(o){
          if (o.value === src.value || o.text === src.value) o.setAttribute('selected','selected');
          else o.removeAttribute('selected');
        });
      } else {
        el.setAttribute('value', src.value || '');
      }
    });

    Array.prototype.forEach.call(clone.querySelectorAll('.platformPlanBar,.actions,.plusBtn,.delBtn,.noPrint'), function(x){ x.remove(); });
    var style = clone.querySelector('style');
    if (style) style.textContent += '\n@media print{.platformPlanBar,.actions,.plusBtn,.delBtn,.noPrint{display:none!important}}';

    return '<!DOCTYPE html>\n' + clone.outerHTML;
  }

  function makeDataUrl(html){ return 'data:text/html;charset=utf-8,' + encodeURIComponent(html || ''); }

  function ensureStyle(){
    if (document.getElementById('ipExternalStyleV3')) return;
    var st = document.createElement('style');
    st.id = 'ipExternalStyleV3';
    st.textContent =
      '#ipFollowBtn{position:fixed;top:10px;left:18px;z-index:2147483646;background:#0f766e;color:#fff;border:0;border-radius:999px;padding:10px 16px;font:900 12px Cairo,Tahoma,Arial;box-shadow:0 10px 24px rgba(0,0,0,.25);cursor:pointer}' +
      '#ipFollowBtn:hover{background:#065f46}' +
      '#ipModal{position:fixed;inset:0;z-index:2147483647;font-family:Cairo,Tahoma,Arial,sans-serif;direction:rtl}' +
      '#ipModal .ipShade{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(3px)}' +
      '#ipModal .ipBox{position:absolute;inset:16px;background:#eef3f1;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 80px rgba(0,0,0,.35)}' +
      '#ipModal .ipTop{display:flex;justify-content:space-between;align-items:center;gap:10px;background:linear-gradient(135deg,#064e3b,#0f766e);color:white;padding:10px 14px}' +
      '#ipModal .ipTitle b{display:block;font-size:14px}#ipModal .ipTitle span{font-size:11px;opacity:.9}' +
      '#ipModal .ipBtns{display:flex;gap:8px;flex-wrap:wrap}' +
      '#ipModal button{border:0;border-radius:12px;padding:8px 12px;font-weight:900;cursor:pointer;font-family:inherit;background:white;color:#064e3b;pointer-events:auto!important;opacity:1!important;filter:none!important}' +
      '#ipModal #ipSend{background:#facc15;color:#1f2937}#ipModal #ipClose{background:#991b1b;color:white}' +
      '#ipModal iframe{border:0;width:100%;height:100%;flex:1;background:#f4f7f6}' +
      '@media print{#ipFollowBtn,#ipModal{display:none!important}}';
    document.head.appendChild(st);
  }

  function unlockButtons(){
    ['ipSend','ipPrint','ipClose','ipFollowBtn'].forEach(function(id){
      var b = document.getElementById(id);
      if (b){
        b.disabled = false;
        b.classList.remove('supervisor-readonly-lock');
        b.removeAttribute('data-supervisor-hidden');
        b.style.pointerEvents = 'auto';
        b.style.opacity = '1';
        b.style.filter = 'none';
        b.style.display = '';
      }
    });
  }

  function startUnlock(){
    unlockButtons();
    if (unlockTimer) clearInterval(unlockTimer);
    unlockTimer = setInterval(function(){
      if (!document.getElementById('ipModal')) { clearInterval(unlockTimer); unlockTimer = null; }
      unlockButtons();
    }, 350);
  }

  function openPlan(existing){
    ensureStyle();
    var old = document.getElementById('ipModal');
    if (old) old.remove();

    var t = targetInfo();
    var planNo = existing && existing.planNo ? existing.planNo : nextPlanNo();

    var modal = document.createElement('div');
    modal.id = 'ipModal';
    modal.innerHTML =
      '<div class="ipShade"></div><div class="ipBox">' +
      '<div class="ipTop platformPlanBar"><div class="ipTitle"><b>نموذج خطة تحسين الأداء رقم '+esc(planNo)+'</b><span>مرتبط الآن بـ '+esc(roleName(t.role))+' / '+esc(t.name)+'</span></div>' +
      '<div class="ipBtns"><button type="button" id="ipSend">إرسال النموذج للمستهدف</button><button type="button" id="ipPrint">طباعة / حفظ PDF</button><button type="button" id="ipClose">إغلاق</button></div></div>' +
      '<iframe id="ipFrame" title="نموذج خطة تحسين الأداء" src="'+PLAN_URL+'"></iframe></div>';

    document.body.appendChild(modal);

    var frame = document.getElementById('ipFrame');
    frame.onload = function(){
      try {
        prefill(frame.contentDocument);
        if (existing && existing.formValues) applyValues(frame.contentDocument, existing.formValues);
      } catch(e){}
      startUnlock();
    };

    document.getElementById('ipClose').onclick = function(){ modal.remove(); };
    document.getElementById('ipPrint').onclick = function(){
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch(e){ alert('تعذر فتح الطباعة.'); }
    };
    document.getElementById('ipSend').onclick = function(){
      try {
        var html = printableHtmlFromFrame(frame);
        if (!html) { alert('لم يكتمل تحميل النموذج بعد.'); return; }

        var source = viewerRole();
        var note = {
          title:'نموذج خطة تحسين الأداء رقم '+planNo,
          message:'تم إرسال نموذج خطة تحسين الأداء رقم '+planNo+' إليك للعرض والطباعة.',
          source:source,
          color:source === 'manager' ? 'red' : 'blue',
          type:'improvement_plan',
          planNo:planNo,
          targetUserIds:[t.id],
          targetEmails:[t.email],
          targetName:t.name,
          targetRole:t.role,
          formValues:collectValues(frame.contentDocument),
          printableHtml:html,
          link:makeDataUrl(html),
          files:[{name:'نموذج_خطة_تحسين_الأداء_'+planNo+'.html', data:makeDataUrl(html)}]
        };

        saveNotif(t.role, note);
        alert('تم إرسال نموذج خطة تحسين الأداء رقم '+planNo+' إلى تنبيهات '+t.name);
        modal.remove();
      } catch(e) {
        alert('تعذر إرسال النموذج: ' + (e && e.message ? e.message : e));
      }
    };

    startUnlock();
  }

  function addButton(){
    if (!isFollowMode() || !viewerAllowed()) return;
    if (document.getElementById('ipFollowBtn')) return;

    ensureStyle();

    var t = targetInfo();
    var btn = document.createElement('button');
    btn.id = 'ipFollowBtn';
    btn.type = 'button';
    btn.textContent = '📄 خطة تحسين الأداء';
    btn.title = 'فتح نموذج خطة تحسين مرتبط بالمستخدم الحالي: ' + t.name;
    btn.onclick = function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      openPlan();
      return false;
    };

    document.body.appendChild(btn);
    unlockButtons();
  }

  function patchNotificationOpen(){
    if (window.__IP_NOTIFICATION_OPEN_PATCH_V3__) return;
    window.__IP_NOTIFICATION_OPEN_PATCH_V3__ = true;

    function currentRole(){
      if (typeof window.ROLE !== 'undefined' && window.ROLE) return window.ROLE;
      if (typeof ROLE !== 'undefined' && ROLE) return ROLE;
      var file = String(location.pathname.split('/').pop() || '');
      if (/agent/i.test(file)) return 'agent';
      if (/student_advisor/i.test(file)) return 'student_advisor';
      if (/activity_leader/i.test(file)) return 'activity_leader';
      if (/manager/i.test(file)) return 'manager';
      return 'teacher';
    }

    var oldOpen = window.ssOpenNotification;
    if (typeof oldOpen === 'function' && !oldOpen.__ipWrapped){
      var wrapped = function(i){
        var role = currentRole();
        var arr = read(NS + '_notifications_' + role, []);
        var n = arr[i];
        if (n && n.type === 'improvement_plan'){
          n.read = true;
          arr[i] = n;
          write(NS + '_notifications_' + role, arr);
          var html = '<div class="ss-card"><h3 style="margin:0 0 8px;font-weight:900;color:#0f766e">'+esc(n.title||'نموذج خطة تحسين الأداء')+'</h3>'+
            '<div class="ss-muted">'+esc(n.createdAt||'')+'</div>'+
            '<div style="white-space:pre-wrap;margin-top:10px;line-height:1.9">'+esc(n.message||'')+'</div>'+
            '<div class="ss-actions" style="margin-top:14px"><a class="ss-action blue" target="_blank" rel="noopener noreferrer" href="'+esc(n.link||makeDataUrl(n.printableHtml||''))+'">📄 عرض النموذج / حفظ PDF</a></div></div>';
          if (typeof panel === 'function') panel('نموذج خطة تحسين الأداء', html);
          else {
            var w = window.open('', '_blank');
            if (w) { w.document.open(); w.document.write(n.printableHtml || ''); w.document.close(); }
          }
          if (typeof updateBadges === 'function') updateBadges();
          return;
        }
        return oldOpen.apply(this, arguments);
      };
      wrapped.__ipWrapped = true;
      window.ssOpenNotification = wrapped;
    }
  }


  function installFollowModeGuard(){
    if (!isFollowMode()) return;
    if (window.__FOLLOW_MODE_STRICT_GUARD__) return;
    window.__FOLLOW_MODE_STRICT_GUARD__ = true;

    var allowedRe = /فتح|عرض|معاينة|الأرشيف|ارشيف|بحث|طباعة|حفظ\s*PDF|PDF|رجوع|عودة|الرئيسية|إغلاق|اغلاق|إلغاء|الغاء|تفاصيل|مشاهدة/i;
    var blockedRe = /تقرير\s*جديد|جديد|إضافة|اضافة|حفظ(?!\s*PDF)|رفع|حذف|مسح|تعديل|تحرير|اعتماد|إرسال|ارسال|تنزيل|استيراد|تصدير|نسخ|تنشيط|إلغاء\s*التنشيط|تفعيل|حفظ\s*التقرير|حفظ\s*النموذج/i;

    function textOf(el){
      return String((el && (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || el.title || el.placeholder)) || '').trim();
    }

    function isInsidePlanModal(el){
      return !!(el && el.closest && el.closest('#ipModal'));
    }

    function hideNewReport(){
      document.querySelectorAll('button,a,[role="button"],.cursor-pointer,.card,div').forEach(function(el){
        if (isInsidePlanModal(el)) return;
        var t = textOf(el);
        if (/^تقرير\s*جديد$|التقرير\s*الجديد|إنشاء\s*تقرير|إضافة\s*تقرير/i.test(t)){
          var box = el.closest('.group,.card,.rounded-\\[2rem\\],.rounded-3xl,.bg-white,.cursor-pointer') || el;
          box.style.setProperty('display','none','important');
          box.setAttribute('data-supervisor-hidden','true');
        }
      });
    }

    function lockFields(){
      document.querySelectorAll('input,textarea,select,[contenteditable="true"]').forEach(function(el){
        if (isInsidePlanModal(el)) return;
        var type = String(el.type || '').toLowerCase();
        if (type === 'search') return;
        if (el.tagName === 'SELECT') el.setAttribute('disabled','disabled');
        else el.setAttribute('readonly','readonly');
        if (el.getAttribute('contenteditable') === 'true') el.setAttribute('contenteditable','false');
      });
    }

    function lockButtons(){
      document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],.btn,.ss-action').forEach(function(el){
        if (isInsidePlanModal(el) || el.id === 'ipFollowBtn') return;
        var t = textOf(el);
        if (!t) return;
        if (blockedRe.test(t) && !allowedRe.test(t)){
          el.classList.add('supervisor-readonly-lock');
          el.setAttribute('aria-disabled','true');
          if ('disabled' in el) el.disabled = true;
          el.style.setProperty('pointer-events','none','important');
          el.style.setProperty('opacity','.45','important');
          el.onclick = function(ev){ ev.preventDefault(); ev.stopPropagation(); return false; };
        }
      });
    }

    function fadeFollowBanners(){
      ['follow-readonly-banner-fixed','supervisor-follow-banner','followModeBanner'].forEach(function(id){
        var b = document.getElementById(id);
        if (b && !b.dataset.autoHideApplied){
          b.dataset.autoHideApplied = '1';
          setTimeout(function(){
            try{
              b.style.transition = 'opacity .35s ease, transform .35s ease';
              b.style.opacity = '0';
              b.style.transform = 'translateY(-8px)';
              setTimeout(function(){ if (b && b.parentNode) b.parentNode.removeChild(b); }, 450);
            }catch(e){}
          }, 10000);
        }
      });

      document.querySelectorAll('[id*="follow"][id*="banner"],[id*="readonly"][id*="banner"]').forEach(function(b){
        if (b && !b.dataset.autoHideApplied){
          b.dataset.autoHideApplied = '1';
          setTimeout(function(){
            try{
              b.style.transition = 'opacity .35s ease, transform .35s ease';
              b.style.opacity = '0';
              b.style.transform = 'translateY(-8px)';
              setTimeout(function(){ if (b && b.parentNode) b.parentNode.removeChild(b); }, 450);
            }catch(e){}
          }, 10000);
        }
      });
    }

    function runGuard(){
      hideNewReport();
      lockFields();
      lockButtons();
      fadeFollowBanners();
      unlockButtons();
    }

    document.addEventListener('click', function(ev){
      var el = ev.target && ev.target.closest && ev.target.closest('button,a,[role="button"],input[type="button"],input[type="submit"],.btn,.ss-action');
      if (!el || isInsidePlanModal(el) || el.id === 'ipFollowBtn') return;
      var t = textOf(el);
      if (blockedRe.test(t) && !allowedRe.test(t)){
        ev.preventDefault();
        ev.stopPropagation();
        return false;
      }
    }, true);

    runGuard();
    setTimeout(runGuard, 300);
    setTimeout(runGuard, 900);
    setTimeout(runGuard, 1800);
    setInterval(runGuard, 3000);
  }


  document.addEventListener('DOMContentLoaded', function(){
    addButton();
    patchNotificationOpen();
    installFollowModeGuard();
  });
  setTimeout(function(){ addButton(); installFollowModeGuard(); },500);
  setTimeout(function(){ addButton(); installFollowModeGuard(); },1500);
  setTimeout(function(){ addButton(); installFollowModeGuard(); },3000);
  setTimeout(patchNotificationOpen,700);
  setTimeout(patchNotificationOpen,2000);
})();
