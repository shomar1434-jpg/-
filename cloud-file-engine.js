(function(){
  'use strict';
  const VERSION='3.0.0';
  const DEFAULT_TIMEOUT=45000;
  const cfg={
    base:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,'')+'/functions/v1/platform-files',
    anon:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamhndmJ0cnZtbWxjc3NneGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTY4MzUsImV4cCI6MjA5NDI3MjgzNX0.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM',
    token:()=>localStorage.getItem('platform_file_session_token')||''
  };
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent('cloudfiles:'+name,{detail}))}catch(_){} }
  async function ensureSession(){
    if(window.PlatformCloudSession&&typeof window.PlatformCloudSession.ensure==='function'){
      await window.PlatformCloudSession.ensure();
      if(cfg.token())return cfg.token();
    }
    if(cfg.token())return cfg.token();
    throw new Error('تعذر استعادة الجلسة السحابية تلقائيًا.');
  }
  async function request(action,{method='POST',body,form,timeout=DEFAULT_TIMEOUT,signal}={}){
    await ensureSession();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    if(signal)signal.addEventListener('abort',()=>controller.abort(),{once:true});
    const headers={apikey:cfg.anon(),'x-platform-session':cfg.token(),'x-client-version':VERSION};
    let payload;
    if(form){payload=form}else if(body!==undefined){headers['content-type']='application/json';payload=JSON.stringify(body)}
    emit('request',{action});
    try{
      const send=async()=>{
        headers['x-platform-session']=cfg.token();
        const r=await fetch(`${cfg.base()}?action=${encodeURIComponent(action)}`,{method,headers,body:payload,signal:controller.signal});
        const j=await r.json().catch(()=>({}));
        return {r,j};
      };
      let res=await send();
      if(res.r.status===401&&window.PlatformCloudSession&&typeof window.PlatformCloudSession.recover==='function'){
        await window.PlatformCloudSession.recover();
        res=await send();
      }
      if(!res.r.ok)throw new Error(res.j.error||`فشلت عملية الملفات (${res.r.status})`);
      emit('success',{action,response:res.j});
      return res.j;
    }catch(e){
      const err=e&&e.name==='AbortError'?new Error('انتهت مهلة الاتصال بمحرك الملفات.'):e;
      emit('error',{action,error:err});
      throw err;
    }finally{clearTimeout(timer)}
  }
  async function upload(o){
    if(!o||!o.file)throw new Error('لم يتم اختيار ملف');
    const f=new FormData();f.append('file',o.file);
    ['ownershipScope','moduleKey','folderId','recordType','recordId','relationType','displayName','replaceFileId'].forEach(k=>o[k]!=null&&f.append(k,String(o[k])));
    if(o.metadata)f.append('metadata',JSON.stringify(o.metadata));
    return request('upload',{form:f,timeout:o.timeout||120000,signal:o.signal});
  }
  async function uploadMany(options){
    const files=[...(options.files||[])], results=[], errors=[];
    for(let i=0;i<files.length;i++){
      try{const r=await upload({...options,file:files[i],files:undefined});results.push(r);options.onProgress&&options.onProgress({index:i+1,total:files.length,file:files[i],result:r})}
      catch(error){errors.push({file:files[i],error});options.onProgress&&options.onProgress({index:i+1,total:files.length,file:files[i],error});if(!options.continueOnError)throw error}
    }
    return {results,errors,total:files.length};
  }
  const list=o=>request('list',{body:o||{}});
  const listByLink=o=>request('list-by-link',{body:o||{}});
  const listFolders=o=>request('list-folders',{body:o||{}});
  const createFolder=o=>request('create-folder',{body:o});
  const renameFolder=(folderId,folderName)=>request('rename-folder',{body:{folderId,folderName}});
  const trashFolder=(folderId,recursive=false)=>request('trash-folder',{body:{folderId,recursive}});
  const restoreFolder=folderId=>request('restore-folder',{body:{folderId}});
  const renameFile=(fileId,displayName)=>request('rename-file',{body:{fileId,displayName}});
  const moveFile=(fileId,folderId)=>request('move-file',{body:{fileId,folderId:folderId||null}});
  const signedUrl=(fileId,expiresIn=300)=>request('signed-url',{body:{fileId,expiresIn}});
  const trash=fileId=>request('trash',{body:{fileId}});
  const restore=fileId=>request('restore',{body:{fileId}});
  const purge=fileId=>request('purge',{body:{fileId}});
  const link=o=>request('link',{body:o});
  const unlink=linkId=>request('unlink',{body:{linkId}});
  const usage=fileId=>request('usage',{body:{fileId}});
  const audit=o=>request('audit',{body:o||{}});
  const stats=o=>request('stats',{body:o||{}});
  const health=()=>request('health',{method:'GET'});
  async function getBlob(fileId){const x=await signedUrl(fileId);const r=await fetch(x.signedUrl);if(!r.ok)throw new Error('تعذر قراءة الملف');return r.blob()}
  async function open(fileId){const x=await signedUrl(fileId);window.open(x.signedUrl,'_blank','noopener,noreferrer');return x}
  async function download(fileId,fileName){const blob=await getBlob(fileId);const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=fileName||'file';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
  window.CloudFileEngine={VERSION,request,upload,uploadMany,list,listByLink,listFolders,createFolder,renameFolder,trashFolder,restoreFolder,renameFile,moveFile,signedUrl,trash,restore,purge,link,unlink,usage,audit,stats,health,getBlob,open,download};
})();
