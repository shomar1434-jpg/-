(function(){
  'use strict';
  const name=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const page=name.replace(/\.html?$/,'').replace(/_/g,'-');
  function init(){
    if(!document.body) return;
    document.body.dataset.premiumPage=page;
    document.documentElement.classList.add('premium-ui-ready');
    document.addEventListener('pointerdown',function(e){
      const el=e.target.closest('button,.btn,.action-btn,[role="button"]');
      if(!el||el.classList.contains('no-ripple')||el.disabled) return;
      const cs=getComputedStyle(el); if(cs.position==='static') el.style.position='relative';
      if(cs.overflow==='visible') el.style.overflow='hidden';
      const r=el.getBoundingClientRect(), s=Math.max(r.width,r.height), x=e.clientX-r.left-s/2, y=e.clientY-r.top-s/2;
      const wave=document.createElement('span'); wave.className='ui-premium-ripple';
      Object.assign(wave.style,{width:s+'px',height:s+'px',left:x+'px',top:y+'px'});el.appendChild(wave);setTimeout(()=>wave.remove(),650);
    },{passive:true});
    if(document.documentElement.scrollHeight>window.innerHeight*1.5 && !document.querySelector('.ui-scroll-top')){
      const b=document.createElement('button');b.className='ui-scroll-top';b.type='button';b.setAttribute('aria-label','العودة إلى أعلى الصفحة');
      b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m18 15-6-6-6 6"/></svg>';
      b.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});document.body.appendChild(b);
      const sync=()=>b.classList.toggle('show',window.scrollY>500);addEventListener('scroll',sync,{passive:true});sync();
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
