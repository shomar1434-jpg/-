/* منصة القيادة المدرسية — Service Worker لإشعارات Push */
'use strict';
self.addEventListener('push', function(event){
  let data={};
  try{ data=event.data?event.data.json():{}; }catch(_){ data={title:'منصة القيادة المدرسية',body:event.data?event.data.text():'لديك تنبيه جديد'}; }
  const title=String(data.title||'منصة القيادة المدرسية');
  const options={
    body:String(data.body||'لديك تنبيه جديد'),
    icon:String(data.icon||'assets/manager_embedded_1.png'),
    badge:String(data.badge||'assets/manager_embedded_1.png'),
    dir:'rtl',lang:'ar',
    tag:String(data.tag||data.notificationId||'school-notification'),
    renotify:!!data.renotify,requireInteraction:!!data.requireInteraction,
    data:{url:String(data.url||'manager.html'),notificationId:String(data.notificationId||''),schoolId:String(data.schoolId||'')}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  const target=(event.notification.data&&event.notification.data.url)||'manager.html';
  event.waitUntil((async()=>{
    const clientsList=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clientsList){
      try{const u=new URL(client.url),t=new URL(target,self.location.origin);if(u.origin===t.origin){await client.focus();client.postMessage({type:'PLATFORM_PUSH_OPEN',url:t.href,notificationId:event.notification.data?.notificationId||''});return;}}catch(_){}
    }
    return clients.openWindow(target);
  })());
});
