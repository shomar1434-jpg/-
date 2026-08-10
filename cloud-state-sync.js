/* Deprecated compatibility shim.
   Operational persistence now uses platform-state-engine.js + platform-persistence-guard.js.
   Kept only so an old cached page does not fail while the new deployment propagates. */
(function(){
  if(window.PlatformPersistenceGuard) return;
  function load(src,next){const s=document.createElement('script');s.src=src;s.onload=()=>next&&next();document.head.appendChild(s)}
  load('platform-state-engine.js',()=>load('platform-persistence-guard.js'));
})();
