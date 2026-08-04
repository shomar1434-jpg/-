(function(){
'use strict';
const local=new Map();
function key(m,r){return String(m||'general')+'::'+String(r||'record')}
function register(def){if(!def||!def.moduleKey||!def.recordType)throw new Error('moduleKey و recordType مطلوبان');local.set(key(def.moduleKey,def.recordType),Object.freeze({...def}));return def}
function get(moduleKey,recordType){return local.get(key(moduleKey,recordType))||null}
async function resolve(moduleKey,recordType){const cached=get(moduleKey,recordType);if(cached)return cached;if(!window.PlatformCore)return null;const r=await PlatformCore.registry(moduleKey,recordType);if(r.recordType)register({moduleKey,recordType,...r.recordType});return r.recordType||null}
function emit(moduleKey,recordType,recordId,eventType,data={},extra={}){if(!window.PlatformCore)throw new Error('Platform Core غير متاح');return PlatformCore.emitRecordEvent({moduleKey,recordType,recordId,eventType,data,...extra})}
window.PlatformRecordRegistry={register,get,resolve,emit,list:()=>Array.from(local.values())};
})();
