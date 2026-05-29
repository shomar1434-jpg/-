
(function(){
  'use strict';
  if(window.__MANUAL_DOCKING_WORKSPACE__) return;
  window.__MANUAL_DOCKING_WORKSPACE__ = true;

  var STORE = 'manual_docking_workspace_state_v1';
  var FOCUS = 'manual_docking_focus_mode_v1';

  var state = readState();
  var focusMode = localStorage.getItem(FOCUS) === 'on';

  function readState(){
    try{
      return JSON.parse(localStorage.getItem(STORE) || '{"top":false,"left":false,"bottom":false}');
    }catch(e){
      return {top:false,left:false,bottom:false};
    }
  }

  function saveState(){
    try{ localStorage.setItem(STORE, JSON.stringify(state)); }catch(e){}
  }

  function isVisible(el){
    if(!el || !el.getBoundingClientRect) return false;
    var cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden') return false;
    var r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }

  function isExcluded(el){
    if(!el) return true;
    var s = ((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '')).toLowerCase();
    if(/modal|overlay|shade|toast|swal|dialog|print|loader|spinner|dropdown|select|calendar|flatpickr|ai-modal|meeting-ai|ipmodal|multischoolmodal|manualdock/.test(s)) return true;
    if(el.closest && el.closest('#ipModal,#multiSchoolModal,.modal,.swal2-container,.toast-container,#toast-container,#manualDockControlPanel')) return true;
    return false;
  }

  function isCandidate(el){
    if(!isVisible(el) || isExcluded(el)) return false;
    var cs = getComputedStyle(el);
    var zi = parseInt(cs.zIndex || '0', 10);
    var pos = cs.position;
    if(pos === 'fixed') return true;
    if(pos === 'sticky' && zi >= 10) return true;
    return false;
  }

  function classify(el){
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    if(r.top <= 125 && r.bottom < vh * .58) return 'top';
    if(r.left <= 125 && r.right < vw * .58) return 'left';
    if(vh - r.bottom <= 125 && r.top > vh * .42) return 'bottom';
    return '';
  }

  function clearClasses(el){
    el.classList.remove('mdw-top-rail','mdw-left-rail','mdw-bottom-rail','mdw-collapsed-top','mdw-collapsed-left','mdw-collapsed-bottom','mdw-focus-hidden');
  }

  function collectRails(){
    document.querySelectorAll('.mdw-managed').forEach(function(el){
      if(document.body.contains(el)) clearClasses(el);
    });

    Array.prototype.slice.call(document.body.querySelectorAll('*')).forEach(function(el){
      if(!isCandidate(el)) return;
      var rail = classify(el);
      if(!rail) return;
      el.classList.add('mdw-managed','mdw-' + rail + '-rail');
      if(focusMode){
        el.classList.add('mdw-focus-hidden');
      }else if(state[rail]){
        el.classList.add('mdw-collapsed-' + rail);
      }
    });

    document.documentElement.classList.toggle('mdw-focus-mode', focusMode);
  }

  function setCollapsed(rail, collapsed){
    state[rail] = !!collapsed;
    saveState();
    collectRails();
    updateControls();
  }

  function toggleRail(rail){
    setCollapsed(rail, !state[rail]);
  }

  function setFocus(on){
    focusMode = !!on;
    localStorage.setItem(FOCUS, focusMode ? 'on' : 'off');
    collectRails();
    updateControls();
  }

  function ensureStyle(){
    if(document.getElementById('manualDockingWorkspaceStyle')) return;
    var st = document.createElement('style');
    st.id = 'manualDockingWorkspaceStyle';
    st.textContent = `
      :root{
        --mdw-speed:.22s;
        --mdw-ease:cubic-bezier(.2,.8,.2,1);
      }
      .mdw-managed{
        transition:transform var(--mdw-speed) var(--mdw-ease), opacity var(--mdw-speed) var(--mdw-ease), filter var(--mdw-speed) var(--mdw-ease)!important;
        will-change:transform,opacity!important;
      }
      .mdw-collapsed-top{transform:translateY(calc(-100% - 8px))!important; opacity:.04!important; pointer-events:none!important;}
      .mdw-collapsed-left{transform:translateX(calc(-100% - 8px))!important; opacity:.04!important; pointer-events:none!important;}
      .mdw-collapsed-bottom{transform:translateY(calc(100% + 8px))!important; opacity:.04!important; pointer-events:none!important;}
      .mdw-focus-hidden{transform:scale(.98)!important; opacity:0!important; pointer-events:none!important; filter:blur(.5px)!important;}

      #manualDockControlPanel{
        position:fixed;
        right:14px;
        bottom:14px;
        z-index:2147483644;
        display:flex;
        gap:7px;
        align-items:center;
        direction:rtl;
        font-family:Cairo,Tahoma,Arial,sans-serif;
      }
      #manualDockControlPanel button{
        border:0;
        border-radius:999px;
        padding:8px 11px;
        background:rgba(255,255,255,.94);
        color:#0f766e;
        font:900 11px Cairo,Tahoma,Arial,sans-serif;
        box-shadow:0 10px 24px rgba(15,23,42,.18);
        cursor:pointer;
        backdrop-filter:blur(8px);
        border:1px solid rgba(15,118,110,.16);
      }
      #manualDockControlPanel button.active{
        background:#0f766e;
        color:white;
      }
      #manualDockControlPanel button.focus-active{
        background:#991b1b;
        color:white;
      }
      #manualDockTip{
        position:fixed;
        right:14px;
        bottom:60px;
        z-index:2147483643;
        background:rgba(15,23,42,.88);
        color:#fff;
        border-radius:14px;
        padding:8px 11px;
        font:800 10px Cairo,Tahoma,Arial,sans-serif;
        opacity:0;
        pointer-events:none;
        transition:opacity .2s ease;
      }
      #manualDockTip.show{opacity:1;}
      @media print{
        #manualDockControlPanel,#manualDockTip{display:none!important}
        .mdw-managed{transform:none!important;opacity:1!important;filter:none!important}
      }`;
    document.head.appendChild(st);
  }

  function showTip(txt){
    var tip = document.getElementById('manualDockTip');
    if(!tip) return;
    tip.textContent = txt;
    tip.classList.add('show');
    clearTimeout(tip._timer);
    tip._timer = setTimeout(function(){ tip.classList.remove('show'); }, 1600);
  }

  function ensureControls(){
    if(document.getElementById('manualDockControlPanel')) return;

    var panel = document.createElement('div');
    panel.id = 'manualDockControlPanel';
    panel.innerHTML =
      '<button type="button" data-rail="top" title="طي/إظهار الشريط العلوي">⌃ علوي</button>'+
      '<button type="button" data-rail="left" title="طي/إظهار الشريط الجانبي">❮ جانبي</button>'+
      '<button type="button" data-rail="bottom" title="طي/إظهار الشريط السفلي">⌄ سفلي</button>'+
      '<button type="button" id="manualDockFocus" title="وضع التركيز">تركيز</button>';
    document.body.appendChild(panel);

    var tip = document.createElement('div');
    tip.id = 'manualDockTip';
    document.body.appendChild(tip);

    Array.prototype.forEach.call(panel.querySelectorAll('[data-rail]'), function(btn){
      btn.onclick = function(){
        var rail = btn.getAttribute('data-rail');
        toggleRail(rail);
        showTip(state[rail] ? 'تم طي الشريط' : 'تم إظهار الشريط');
      };
    });

    panel.querySelector('#manualDockFocus').onclick = function(){
      setFocus(!focusMode);
      showTip(focusMode ? 'تم تفعيل وضع التركيز' : 'تم إلغاء وضع التركيز');
    };
  }

  function updateControls(){
    var panel = document.getElementById('manualDockControlPanel');
    if(!panel) return;
    Array.prototype.forEach.call(panel.querySelectorAll('[data-rail]'), function(btn){
      var rail = btn.getAttribute('data-rail');
      btn.classList.toggle('active', !!state[rail]);
    });
    var focus = panel.querySelector('#manualDockFocus');
    if(focus) focus.classList.toggle('focus-active', focusMode);
  }

  function boot(){
    ensureStyle();
    ensureControls();
    collectRails();
    updateControls();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('resize', function(){ setTimeout(collectRails, 120); });
  setTimeout(boot, 500);
  setTimeout(collectRails, 1500);
  setInterval(collectRails, 5000);

  window.ManualDockingWorkspace = {
    toggle: toggleRail,
    setCollapsed: setCollapsed,
    focus: setFocus,
    collect: collectRails,
    state: function(){ return {top:!!state.top,left:!!state.left,bottom:!!state.bottom,focus:!!focusMode}; }
  };
})();
