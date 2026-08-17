(function(){
  'use strict';
  if(window.PlatformStateEngine) return;
  const VERSION='1.0.0';
  const cfg={
    base:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'')+'/functions/v1/platform-state',
    anon:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM',
    token:()=>localStorage.getItem('platform_file_session_token')||''
  };
  async function ensureSession(){
    if(window.PlatformCloudSession&&typeof window.PlatformCloudSession.ensure==='function'){
      try{await window.PlatformCloudSession.ensure();}catch(_){ }
      if(cfg.token()) return cfg.token();
    }
    if(cfg.token()) return cfg.token();
    return '';
  }
  async function request(action,body={},opts={}){
    const token=await ensureSession();
    if(!token) throw new Error('الجلسة السحابية غير متاحة');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),opts.timeout||30000);
    try{
      const send=async()=>{
        const r=await fetch(`${cfg.base()}?action=${encodeURIComponent(action)}`,{
          method:'POST',
          headers:{apikey:cfg.anon(),'x-platform-session':cfg.token(),'x-client-version':VERSION,'content-type':'application/json'},
          body:JSON.stringify(body),
          signal:controller.signal,
          keepalive:!!opts.keepalive
        });
        const j=await r.json().catch(()=>({}));
        return {r,j};
      };
      let res=await send();
      if(res.r.status===401&&window.PlatformCloudSession?.recover){await window.PlatformCloudSession.recover();res=await send();}
      if(!res.r.ok) throw new Error(res.j.error||`فشلت مزامنة الحالة (${res.r.status})`);
      return res.j;
    }finally{clearTimeout(timer)}
  }
  const pull=(moduleKey,scope='user',keys)=>request('pull',{moduleKey,scope,keys});
  const bulkUpsert=(moduleKey,scope='user',items,opts)=>request('bulk-upsert',{moduleKey,scope,items},opts);
  const health=()=>request('health',{});
  window.PlatformStateEngine={VERSION,request,pull,bulkUpsert,health};
})();
