(function(){
'use strict';
if(window.InternalMessaging)return;
const cfg={url:()=> (localStorage.getItem('smartSchoolSupabaseUrl')||'https://cijhgvbtrvmmlcssgxht.supabase.co').replace(/\/$/,''),key:()=>localStorage.getItem('smartSchoolSupabaseAnonKey')||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjaWpoZ3ZidHJ2bW1sY3NzZ3hodCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4Njk2ODM1LCJleHAiOjIwOTQyNzI4MzV9.1sbfDvL1V12kj9oVcYJqYhj8NPuLpYjId7CO9QGj3bM'};
const token=()=>localStorage.getItem('platform_file_session_token')||'';
async function call(action,body){
 const r=await fetch(`${cfg.url()}/functions/v1/platform-messages?action=${encodeURIComponent(action)}`,{method:body?'POST':'GET',headers:{apikey:cfg.key(),'content-type':'application/json','x-platform-session':token()},body:body?JSON.stringify(body):undefined});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'تعذر الاتصال بالمراسلات');return j;
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function addStyles(){
 if(document.getElementById('im-style'))return;const st=document.createElement('style');st.id='im-style';st.textContent=`
 .im-fab{position:fixed;top:14px;left:78px;z-index:9000;width:42px;height:42px;border:1px solid #d5e8e6;border-radius:14px;background:#fff;color:#087f78;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 18px #0b4b4518;cursor:pointer;font-size:20px}
 .im-badge{position:absolute;top:-6px;right:-6px;min-width:19px;height:19px;padding:0 4px;border-radius:10px;background:#d94a4a;color:#fff;font:700 11px/19px Tahoma;text-align:center;display:none}
 .im-panel{position:fixed;top:64px;left:18px;width:min(390px,calc(100vw - 36px));max-height:70vh;background:#fff;border:1px solid #d9e5e5;border-radius:20px;box-shadow:0 18px 50px #173a3a30;z-index:9001;display:none;direction:rtl;overflow:hidden;font-family:Tajawal,Arial,sans-serif}
 .im-head{padding:15px 17px;border-bottom:1px solid #edf2f2;display:flex;justify-content:space-between;align-items:center}.im-head b{color:#087f78}
 .im-list{max-height:48vh;overflow:auto}.im-item{padding:12px 16px;border-bottom:1px solid #f0f3f3;cursor:pointer}.im-item:hover{background:#f5fbfa}.im-item.unread{background:#effaf8}.im-sub{font-weight:700;color:#263b3a}.im-meta{font-size:12px;color:#7b8b8a;margin-top:4px}
 .im-actions{padding:12px;display:flex;gap:8px}.im-actions button{border:0;border-radius:10px;padding:9px 12px;cursor:pointer}.im-open{background:#087f78;color:white}.im-new{background:#e8f7f5;color:#087f78}
 `;document.head.appendChild(st);
}
async function refresh(){
 try{const d=await call('inbox');const b=document.querySelector('.im-badge');if(b){b.textContent=d.unread||0;b.style.display=d.unread?'block':'none'};render(d.messages||[])}catch(e){console.warn('[InternalMessaging]',e.message)}
}
function render(msgs){
 const list=document.querySelector('.im-list');if(!list)return;
 list.innerHTML=msgs.length?msgs.slice(0,8).map(m=>`<div class="im-item ${m.read_at?'':'unread'}" data-id="${esc(m.id)}"><div class="im-sub">${esc(m.subject)}</div><div class="im-meta">من: ${esc(m.sender_name||'مستخدم')} · ${new Date(m.created_at).toLocaleString('ar-SA')}</div></div>`).join(''):'<div style="padding:28px;text-align:center;color:#84908f">لا توجد رسائل جديدة</div>';
 list.querySelectorAll('.im-item').forEach(x=>x.onclick=()=>{location.href='internal_messages.html?message='+encodeURIComponent(x.dataset.id)});
}
function mount(){
 if(document.querySelector('.im-fab'))return;addStyles();
 const fab=document.createElement('button');fab.className='im-fab';fab.title='المراسلات الداخلية';fab.innerHTML='✉️<span class="im-badge"></span>';
 const panel=document.createElement('div');panel.className='im-panel';panel.innerHTML=`<div class="im-head"><b>المراسلات الداخلية</b><button style="border:0;background:none;font-size:20px;cursor:pointer" aria-label="إغلاق">×</button></div><div class="im-list"></div><div class="im-actions"><button class="im-open">فتح مركز المراسلات</button><button class="im-new">رسالة جديدة</button></div>`;
 document.body.append(fab,panel);fab.onclick=()=>{panel.style.display=panel.style.display==='block'?'none':'block';if(panel.style.display==='block')refresh()};panel.querySelector('.im-head button').onclick=()=>panel.style.display='none';panel.querySelector('.im-open').onclick=()=>location.href='internal_messages.html';panel.querySelector('.im-new').onclick=()=>location.href='internal_messages.html?compose=1';refresh();setInterval(refresh,60000);
}
window.InternalMessaging={call,refresh,mount};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();