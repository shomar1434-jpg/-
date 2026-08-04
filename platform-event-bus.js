(function(){
'use strict';
const listeners=new Map();
function on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>off(name,fn)}
function off(name,fn){listeners.get(name)?.delete(fn)}
async function emit(name,payload={},options={}){
 for(const fn of listeners.get(name)||[]){try{await fn(payload)}catch(e){console.error('[PlatformEventBus]',name,e)}}
 window.dispatchEvent(new CustomEvent('platform:'+name,{detail:payload}));
 if(options.cloud&&window.PlatformRecordRegistry){return PlatformRecordRegistry.emit(options.moduleKey,options.recordType,options.recordId,name,payload,{taskId:options.taskId,executionRole:options.executionRole})}
 return {local:true};
}
window.PlatformEventBus={on,off,emit};
})();
