(function(){
  'use strict';
  // RL148 — Fast first-paint + safe legacy session bridge, non-destructive cache/version guard.
  // Never clears browser storage and never touches cloud records/files.
  const EMBEDDED_BUILD='2026.09.14-RL148-legacy-session-bridge';
  const MANIFEST_URL='platform-build.json';
  const BUILD_SEEN_KEY='platform_runtime_build_seen_v1';
  const RELOAD_ATTEMPT_KEY='platform_runtime_refresh_attempt_v1';
  const RELOAD_PARAM='__platform_build';
  let userInteracted=false;

  try{document.documentElement.setAttribute('data-platform-runtime-build',EMBEDDED_BUILD)}catch(_){}
  try{
    const old=JSON.parse(localStorage.getItem(BUILD_SEEN_KEY)||'null')||{};
    localStorage.setItem(BUILD_SEEN_KEY,JSON.stringify({build:EMBEDDED_BUILD,previousBuild:String(old.build||''),seenAt:new Date().toISOString()}));
  }catch(_){}

  ['pointerdown','keydown','input','change','touchstart'].forEach(function(type){
    addEventListener(type,function(){userInteracted=true;},{once:true,passive:true,capture:true});
  });

  function cleanBuild(v){return String(v||'').trim().replace(/[^0-9A-Za-z._-]/g,'').slice(0,96)}
  function currentTarget(){try{return new URL(location.href).searchParams.get(RELOAD_PARAM)||''}catch(_){return ''}}

  function showUpdateNotice(target){
    if(document.getElementById('platform-runtime-update-notice'))return;
    const mount=function(){
      if(!document.body)return setTimeout(mount,50);
      const box=document.createElement('div');
      box.id='platform-runtime-update-notice';box.setAttribute('dir','rtl');
      box.style.cssText='position:fixed;z-index:2147483647;inset:auto 12px 12px 12px;max-width:620px;margin:auto;padding:12px 14px;border-radius:12px;background:#fff;border:1px solid #15445A;box-shadow:0 8px 30px rgba(0,0,0,.18);font:600 14px/1.7 Tajawal,Arial,sans-serif;color:#15445A';
      box.innerHTML='<span>يتوفر تحديث للمنصة. لن يتم حذف أي بيانات محلية أو سحابية.</span> <button type="button" style="margin-inline-start:8px;border:0;border-radius:8px;padding:7px 12px;background:#15445A;color:#fff;cursor:pointer">تحديث آمن</button>';
      box.querySelector('button').onclick=function(){refreshTo(target,true)};
      document.body.appendChild(box);
    };mount();
  }

  function refreshTo(target,manual){
    const safe=cleanBuild(target);if(!safe)return false;
    try{
      const u=new URL(location.href),already=u.searchParams.get(RELOAD_PARAM)===safe;
      u.searchParams.set(RELOAD_PARAM,safe);u.searchParams.set('__platform_refresh',String(Date.now()));
      sessionStorage.setItem(RELOAD_ATTEMPT_KEY,JSON.stringify({target:safe,at:Date.now(),manual:Boolean(manual)}));
      if(already&&!manual)return false;
      location.replace(u.toString());return true;
    }catch(_){return false}
  }

  async function checkBuild(){
    const ctrl=('AbortController' in window)?new AbortController():null;
    const timer=setTimeout(function(){try{if(ctrl)ctrl.abort()}catch(_){}},1200);
    try{
      const sep=MANIFEST_URL.indexOf('?')>=0?'&':'?';
      const res=await fetch(MANIFEST_URL+sep+'t='+Date.now(),{cache:'no-store',credentials:'same-origin',headers:{'cache-control':'no-cache','pragma':'no-cache'},signal:ctrl?ctrl.signal:undefined});
      if(!res.ok)throw new Error('manifest_http_'+res.status);
      const data=await res.json(),target=cleanBuild(data&&data.build);
      if(!target||target===EMBEDDED_BUILD)return true;
      // Never interrupt a user who has started working. Before interaction, a single
      // cache-busting reload is safe and updates stale HTML/JS without deleting state.
      if(!userInteracted&&currentTarget()!==target)return refreshTo(target,false);
      showUpdateNotice(target);return false;
    }catch(_){return false}finally{clearTimeout(timer)}
  }

  function scheduleCheck(){
    // Version I/O is deliberately outside the critical startup path.
    const run=function(){checkBuild().catch(function(){})};
    if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:1800});
    else setTimeout(run,700);
  }

  window.PlatformRuntimeGuard=Object.freeze({BUILD:EMBEDDED_BUILD,check:checkBuild});
  if(document.readyState==='complete')scheduleCheck();
  else addEventListener('load',scheduleCheck,{once:true});
})();
