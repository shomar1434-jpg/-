/* =========================================================
   إصلاح واجهة الأقسام: إزالة محفظة التميز الرقمية من المعلم والموجه
   واستبدالها بتنبيهات المساعد الذكي، مع عدم المساس ببقية النوافذ.
   ========================================================= */
(function(){
  'use strict';
  if(window.__SS_SECTION_DASHBOARD_SAFE_FIX__) return;
  window.__SS_SECTION_DASHBOARD_SAFE_FIX__ = true;
  function closestCard(el){
    while(el && el !== document.body){
      var cls = String(el.className||'');
      var onclick = el.getAttribute && el.getAttribute('onclick');
      if(onclick || /rounded|shadow|cursor-pointer/.test(cls)) return el;
      el = el.parentElement;
    }
    return null;
  }
  function alertCardHtml(){
    return '<div class="flex items-center gap-4">'+
      '<div class="w-14 h-14 bg-white/10 text-white rounded-2xl flex items-center justify-center shadow-lg">'+
      '<svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>'+
      '</div><div><h3 class="font-bold text-base text-white">تنبيهات المساعد الذكي</h3>'+
      '<p class="text-[9px] text-teal-100 font-bold uppercase">عرض تنبيهات مدير النظام وتنزيل المرفقات</p></div></div>'+
      '<span id="assistant-alert-count" class="bg-white/15 px-3 py-1 rounded-full text-xs font-black">0</span>';
  }
  function fixPortfolioCard(){
    try{
      var heads=[].slice.call(document.querySelectorAll('h3')).filter(function(h){return (h.textContent||'').trim()==='محفظة التميز الرقمية';});
      heads.forEach(function(h){
        var card=closestCard(h);
        if(!card) return;
        card.setAttribute('onclick','openAssistantAlerts()');
        card.className='bg-teal-700 p-8 rounded-[45px] shadow-2xl cursor-pointer transition-all flex items-center justify-between group hover:scale-[1.02] border-2 border-white/20';
        card.innerHTML=alertCardHtml();
        card.setAttribute('data-ss-alert-card','1');
      });
      var alertHeads=[].slice.call(document.querySelectorAll('h3')).filter(function(h){return (h.textContent||'').trim()==='تنبيهات المساعد الذكي';});
      var kept=false;
      alertHeads.forEach(function(h){
        var card=closestCard(h); if(!card) return;
        if(card.getAttribute('data-ss-alert-card')==='1'){kept=true; return;}
        if(kept){ var wrap=card.parentElement; if(wrap && /w-full/.test(String(wrap.className||''))) wrap.remove(); else card.remove(); }
      });
    }catch(e){console.warn('section dashboard fix',e);}
  }
  function fallbackAssistantAlerts(){
    if(typeof window.openAssistantAlerts==='function') return;
    window.openAssistantAlerts=function(){
      alert('لا توجد تنبيهات جديدة من المساعد الذكي حالياً.');
    };
  }
  function boot(){ fallbackAssistantAlerts(); fixPortfolioCard(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  setTimeout(boot,300); setTimeout(boot,1200);
})();
