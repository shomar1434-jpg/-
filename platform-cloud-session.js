(function(){
  'use strict';
  const url=()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'');
  const key=()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM';
  async function open(login,password,schoolId){
    const r=await fetch(`${url()}/functions/v1/platform-session`,{method:'POST',headers:{'content-type':'application/json','apikey':key()},body:JSON.stringify({login,password,schoolId})});
    const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'تعذر إنشاء الجلسة السحابية');
    localStorage.setItem('platform_file_session_token',j.token);localStorage.setItem('platform_file_session_expires_at',j.expiresAt||'');return j;
  }
  function token(){return localStorage.getItem('platform_file_session_token')||''}
  function expiresAt(){return localStorage.getItem('platform_file_session_expires_at')||''}
  function valid(){const t=token(),e=expiresAt();return !!t&&(!e||Date.parse(e)>Date.now()+60000)}
  async function ensure(){if(valid())return token();clear();throw new Error('انتهت جلسة الملفات السحابية. سجّل الخروج ثم ادخل مجددًا لتجديدها.')}
  function clear(){localStorage.removeItem('platform_file_session_token');localStorage.removeItem('platform_file_session_expires_at')}
  window.PlatformCloudSession={open,token,expiresAt,valid,ensure,clear};
})();
