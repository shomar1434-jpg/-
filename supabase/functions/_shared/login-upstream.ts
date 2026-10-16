// RL243: one bounded budget for a login request; retry only safe reads.
export function loginUpstreamFetch(budgetMs=18000, transport:typeof fetch=fetch){
 const deadline=Date.now()+budgetMs;
 return async (input:RequestInfo|URL, init?:RequestInit):Promise<Response>=>{
  const method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  const originalSignal=init?.signal||(input instanceof Request?input.signal:undefined);
  for(let attempt=0;attempt<2;attempt++){
   const remaining=deadline-Date.now();
   if(remaining<=0)throw new DOMException('Login upstream deadline exceeded','TimeoutError');
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),Math.min(6000,remaining));
   const abort=()=>controller.abort();
   originalSignal?.addEventListener('abort',abort,{once:true});
   if(originalSignal?.aborted)controller.abort();
   try{
    const response=await transport(input,{...init,signal:controller.signal});
    // Keep the timer until the body arrives, including stalled gateway responses.
    const body=await response.arrayBuffer();
    if(method==='GET'&&attempt===0&&[502,503,504,522,524].includes(response.status)&&!originalSignal?.aborted&&Date.now()<deadline)continue;
    return new Response([101,204,205,304].includes(response.status)?null:body,{status:response.status,statusText:response.statusText,headers:response.headers});
   }catch(error){
    // Never replay sign-in, password changes, session inserts, or other writes.
    if(method==='GET'&&attempt===0&&!originalSignal?.aborted&&Date.now()<deadline)continue;
    throw error;
   }finally{
    clearTimeout(timer);
    originalSignal?.removeEventListener('abort',abort);
   }
  }
  throw new DOMException('Login upstream unavailable','TimeoutError');
 };
}
export function loginServiceFailure(error:any,requestId:string){
 const message=String(error?.message||error||'');
 const transient=Number(error?.status)>=500||['AbortError','TimeoutError','AuthRetryableFetchError'].includes(error?.name)||['PGRST002','PGRST001','PGRST000'].includes(error?.code)||/timeout|timed out|fetch failed|failed to fetch|network|schema cache|<!doctype|<html/i.test(message);
 return {status:transient?503:500,body:{
  error:transient?'خدمة التحقق السحابية غير متاحة مؤقتًا. انتظر قليلًا ثم أعد المحاولة من رابط المدرسة نفسه.':'تعذر إكمال التحقق من الحساب. تواصل مع إدارة المنصة مع رمز التشخيص.',
  code:transient?'SESSION_SERVICE_UNAVAILABLE':'SESSION_FATAL_ERROR',retryable:transient,requestId
 }};
}
