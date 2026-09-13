(function(){
  'use strict';
  // RL146 — Non-destructive runtime/cache upgrade guard.
  // This file NEVER clears localStorage/sessionStorage and NEVER edits cloud data.
  const EMBEDDED_BUILD='2026.09.14-RL146-safe-runtime-cache';
  const MANIFEST_URL='platform-build.json';
  const BUILD_SEEN_KEY='platform_runtime_build_seen_v1';
  const RELOAD_ATTEMPT_KEY='platform_runtime_refresh_attempt_v1';
  const RELOAD_PARAM='__platform_build';
  const STARTED_AT=(performance && performance.now)?performance.now():0;

  try{document.documentElement.setAttribute('data-platform-runtime-build',EMBEDDED_BUILD)}catch(_){}
  try{
    const old=JSON.parse(localStorage.getItem(BUILD_SEEN_KEY)||'null')||{};
    localStorage.setItem(BUILD_SEEN_KEY,JSON.stringify({
      build:EMBEDDED_BUILD,
      previousBuild:String(old.build||''),
      seenAt:new Date().toISOString()
    }));
  }catch(_){}

  // Hide only during the very short startup version check so a stale cached page
  // cannot become interactive before the guard knows whether a refresh is needed.
  let gate=null;
  try{
    gate=document.createElement('style');
    gate.id='platform-runtime-version-gate';
    gate.textContent='html[data-platform-runtime-checking="1"] body{visibility:hidden!important}';
    document.documentElement.setAttribute('data-platform-runtime-checking','1');
    (document.head||document.documentElement).appendChild(gate);
  }catch(_){}

  function reveal(){
    try{document.documentElement.removeAttribute('data-platform-runtime-checking')}catch(_){}
    try{gate&&gate.remove()}catch(_){}
  }
  function cleanBuild(v){return String(v||'').trim().replace(/[^0-9A-Za-z._-]/g,'').slice(0,96)}
  function runtimeAge(){try{return performance.now()-STARTED_AT}catch(_){return 999999}}
  function currentTarget(){try{return new URL(location.href).searchParams.get(RELOAD_PARAM)||''}catch(_){return ''}}

  function showUpdateNotice(target){
    reveal();
    if(document.getElementById('platform-runtime-update-notice'))return;
    const mount=()=>{
      if(!document.body)return setTimeout(mount,25);
      const box=document.createElement('div');
      box.id='platform-runtime-update-notice';
      box.setAttribute('dir','rtl');
      box.style.cssText='position:fixed;z-index:2147483647;inset:auto 12px 12px 12px;max-width:620px;margin:auto;padding:12px 14px;border-radius:12px;background:#fff;border:1px solid #15445A;box-shadow:0 8px 30px rgba(0,0,0,.18);font:600 14px/1.7 Tajawal,Arial,sans-serif;color:#15445A';
      box.innerHTML='<span>يتوفر تحديث للمنصة. لن يتم حذف أي بيانات محلية أو سحابية.</span> <button type="button" style="margin-inline-start:8px;border:0;border-radius:8px;padding:7px 12px;background:#15445A;color:#fff;cursor:pointer">تحديث آمن</button>';
      box.querySelector('button').onclick=()=>refreshTo(target,true);
      document.body.appendChild(box);
    };
    mount();
  }

  function refreshTo(target,manual){
    const safe=cleanBuild(target); if(!safe)return false;
    try{
      const u=new URL(location.href);
      const already=u.searchParams.get(RELOAD_PARAM)===safe;
      const stamp=String(Date.now());
      u.searchParams.set(RELOAD_PARAM,safe);
      u.searchParams.set('__platform_refresh',stamp);
      sessionStorage.setItem(RELOAD_ATTEMPT_KEY,JSON.stringify({target:safe,at:Date.now(),manual:Boolean(manual)}));
      if(already && !manual){reveal();return false;}
      location.replace(u.toString());
      return true;
    }catch(_){reveal();return false;}
  }

  async function checkBuild(){
    const ctrl=('AbortController' in window)?new AbortController():null;
    const timer=setTimeout(()=>{try{ctrl&&ctrl.abort()}catch(_){}},2500);
    try{
      const sep=MANIFEST_URL.includes('?')?'&':'?';
      const res=await fetch(MANIFEST_URL+sep+'t='+Date.now(),{
        cache:'no-store',
        credentials:'same-origin',
        headers:{'cache-control':'no-cache','pragma':'no-cache'},
        signal:ctrl?ctrl.signal:undefined
      });
      if(!res.ok)throw new Error('manifest_http_'+res.status);
      const data=await res.json();
      const target=cleanBuild(data&&data.build);
      if(!target || target===EMBEDDED_BUILD){reveal();return true;}

      // At initial page startup it is safe to refresh immediately. If the page has
      // already been in use, never auto-reload because the user may have unsaved work.
      if(runtimeAge()<5000 && currentTarget()!==target){
        return refreshTo(target,false);
      }
      showUpdateNotice(target);
      return false;
    }catch(_){
      // Network/CDN failure is not an authorization failure. Keep the current page
      // usable and preserve all stored state.
      reveal();
      return false;
    }finally{clearTimeout(timer)}
  }

  window.PlatformRuntimeGuard=Object.freeze({BUILD:EMBEDDED_BUILD,check:checkBuild});
  checkBuild();
})();
