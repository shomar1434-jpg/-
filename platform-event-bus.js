(function(){
'use strict';
const listeners=new Map();
function on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>off(name,fn)}
function off(name,fn){listeners.get(name)?.delete(fn)}
async function emit(name,payload={},options={}){
 for(const fn of listeners.get(name)||[]){try{await fn(payload)}catch(e){console.error('[PlatformEventBus]',name,e)}}
 window.dispatchEvent(new CustomEvent('platform:'+name,{detail:payload}));
 let cloudResult={local:true};
 if(options.cloud&&window.PlatformRecordRegistry){cloudResult=await PlatformRecordRegistry.emit(options.moduleKey,options.recordType,options.recordId,name,payload,{taskId:options.taskId,executionRole:options.executionRole})}
 try{
   const token=String(localStorage.getItem('platform_file_session_token')||'');
   if(token){
     const base=String(localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'');
     const key=String(localStorage.getItem('smartSchoolSupabaseAnonKey')||'');
     const data=payload&&typeof payload==='object'?payload:{value:payload};
     fetch(base+'/functions/v1/platform-notifications?action=record-event',{method:'POST',headers:{'content-type':'application/json','apikey':key,'x-platform-session':token},body:JSON.stringify({eventType:name,moduleKey:options.moduleKey||data.module_key||'',recordType:options.recordType||data.record_type||'',recordId:options.recordId||data.record_id||'',recipientUserId:data.recipient_user_id||data.reviewer_id||data.requester_id||data.supervisor_id||'',actionUrl:data.action_url||data.actionUrl||'',summary:data.summary||data.title||data.notes||'',severity:data.severity||'',notifyManager:data.notifyManager===true,notifyPush:data.notifyPush===true,data})}).catch(function(e){console.warn('[PlatformEventBus notification mirror]',e)});
   }
 }catch(e){console.warn('[PlatformEventBus notification mirror]',e)}
 return cloudResult;
}
window.PlatformEventBus={on,off,emit};
})();
