(function(){
 'use strict';
 if(!window.CloudFilePageContext||document.getElementById('cloudFilesLauncher'))return;
 function mount(){
  if(document.getElementById('cloudFilesLauncher'))return;
  const a=document.createElement('a');a.id='cloudFilesLauncher';a.href=(location.pathname.includes('/records/')?'../../':'')+'cloud_files_center.html';a.title='مركز ملفاتي السحابية';a.textContent='☁️';a.style.cssText='position:fixed;left:18px;bottom:78px;z-index:999999;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#0f7f86;color:#fff;text-decoration:none;font-size:22px;box-shadow:0 10px 25px rgba(12,75,83,.28);border:2px solid rgba(255,255,255,.8)';document.body.appendChild(a);
 }
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
