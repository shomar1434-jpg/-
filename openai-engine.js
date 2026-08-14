(function(){
'use strict';
if(window.__OPENAI_ENGINE_SERVER_V2__)return;window.__OPENAI_ENGINE_SERVER_V2__=true;
async function call(systemPrompt,userPrompt,options){
 if(!window.AgentCoreV2)throw new Error('Agent Core V2 لم يكتمل تحميله.');
 const prompt=(systemPrompt?systemPrompt+'\n\n':'')+(userPrompt||'');
 const res=await AgentCoreV2.api('chat',{message:prompt,conversation:[],options:options||{},compatibilityMode:true});return res.answer||'';
}
window.OpenAIEngine={call,isConfigured:function(){return !!(window.PlatformCloudSession?.valid?.()||localStorage.getItem('platform_file_session_token'))},getModel:function(){return'agent-managed'},setModel:function(){},getApiKey:function(){return''},setApiKey:function(){throw new Error('مفتاح OpenAI يُدار بأمان في Supabase Secrets ولا يُحفظ في المتصفح.')}};
window.callOpenAI=async function(a,b,o){return b?call(a,b,o):call('أنت وكيل مدرسي ذكي.',a,o)};
})();
