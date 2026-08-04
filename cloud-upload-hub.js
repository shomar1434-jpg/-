(function(){
  'use strict';

  const HUB_ID='unifiedCloudUploadHub';
  const STYLE_ID='unifiedCloudUploadHubStyles';
  const ctx=()=>window.CloudFilePageContext||{moduleKey:'general_files',ownershipScope:'user',recordType:'attachment'};
  const rootPrefix=()=>location.pathname.includes('/records/')?'../../':'';

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function addStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${HUB_ID}{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(8,25,38,.72);backdrop-filter:blur(5px);font-family:Cairo,Tajawal,Tahoma,sans-serif;direction:rtl}
      #${HUB_ID}.is-open{display:flex}
      #${HUB_ID} .cuh-dialog{width:min(900px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.75)}
      #${HUB_ID} .cuh-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:20px 22px;border-bottom:1px solid #e5edef}
      #${HUB_ID} .cuh-title{margin:0;color:#0f6871;font-size:22px;font-weight:900}
      #${HUB_ID} .cuh-close{border:0;border-radius:12px;padding:9px 16px;background:#ef4444;color:#fff;font:800 14px inherit;cursor:pointer}
      #${HUB_ID} .cuh-body{padding:20px 22px 24px}
      #${HUB_ID} .cuh-note{padding:14px 16px;border:1px solid #d8e7ea;border-radius:16px;background:#f7fbfc;color:#465b62;font-size:13px;line-height:1.8;margin-bottom:16px}
      #${HUB_ID} .cuh-providers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:16px}
      #${HUB_ID} .cuh-provider{position:relative;border:2px solid #dce8ea;border-radius:18px;padding:16px;background:#fff;cursor:pointer;text-align:right;transition:.18s}
      #${HUB_ID} .cuh-provider.active{border-color:#11858d;background:#eefafa;box-shadow:0 10px 25px rgba(17,133,141,.12)}
      #${HUB_ID} .cuh-provider strong{display:block;color:#173f47;font-size:16px;margin-bottom:5px}
      #${HUB_ID} .cuh-provider span{display:block;color:#6d7f85;font-size:12px;line-height:1.6}
      #${HUB_ID} .cuh-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      #${HUB_ID} .cuh-field{display:flex;flex-direction:column;gap:7px}
      #${HUB_ID} .cuh-field.full{grid-column:1/-1}
      #${HUB_ID} label{color:#49616a;font-size:12px;font-weight:800}
      #${HUB_ID} select,#${HUB_ID} input[type=text]{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cedde0;border-radius:12px;background:#fff;font:700 13px inherit;color:#27464d}
      #${HUB_ID} .cuh-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
      #${HUB_ID} .cuh-btn{border:0;border-radius:12px;padding:11px 16px;font:900 13px inherit;cursor:pointer;background:#e9f1f3;color:#294f57}
      #${HUB_ID} .cuh-btn.primary{background:#0f8790;color:#fff}
      #${HUB_ID} .cuh-btn.blue{background:#2563eb;color:#fff}
      #${HUB_ID} .cuh-btn:disabled{opacity:.55;cursor:not-allowed}
      #${HUB_ID} .cuh-status{display:none;margin-top:14px;padding:11px 14px;border-radius:12px;font-size:13px;font-weight:800}
      #${HUB_ID} .cuh-status.show{display:block}
      #${HUB_ID} .cuh-status.ok{background:#eafaf5;color:#08735a;border:1px solid #a2dfcc}
      #${HUB_ID} .cuh-status.bad{background:#fff0f0;color:#a91d1d;border:1px solid #f0b7b7}
      #${HUB_ID} .cuh-status.info{background:#eef6ff;color:#1e5da8;border:1px solid #bad5f4}
      #${HUB_ID} .cuh-files{margin-top:12px;display:grid;gap:8px}
      #${HUB_ID} .cuh-file{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #e2ecee;border-radius:12px;padding:10px 12px;background:#fff}
      #${HUB_ID} .cuh-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#37535a;font-size:12px;font-weight:800}
      @media(max-width:680px){#${HUB_ID} .cuh-providers,#${HUB_ID} .cuh-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function build(){
    let hub=document.getElementById(HUB_ID);
    if(hub)return hub;
    addStyles();
    hub=document.createElement('div');
    hub.id=HUB_ID;
    hub.setAttribute('aria-hidden','true');
    hub.innerHTML=`
      <div class="cuh-dialog" role="dialog" aria-modal="true" aria-labelledby="cuhTitle">
        <div class="cuh-head">
          <h2 class="cuh-title" id="cuhTitle">الرفع والتخزين السحابي</h2>
          <button type="button" class="cuh-close" data-cuh-close>إغلاق</button>
        </div>
        <div class="cuh-body">
          <div class="cuh-note">
            <strong>سحابة المنصة</strong> هي الحفظ الأساسي الآمن المرتبط بالمدرسة والمستخدم والقسم الحالي. ويمكن استخدام OneDrive المؤسسي كخيار إضافي؛ الربط الكامل مع المنصة يتطلب تكامل Microsoft Graph، أما الزر الحالي فيفتح حساب OneDrive للمستخدم.
          </div>
          <div class="cuh-providers">
            <button type="button" class="cuh-provider active" data-provider="platform">
              <strong>☁️ سحابة المنصة — Supabase</strong>
              <span>حفظ داخل نطاق المدرسة الحالية مع عزل المستخدم والقسم.</span>
            </button>
            <button type="button" class="cuh-provider" data-provider="onedrive">
              <strong>🔷 OneDrive المؤسسي</strong>
              <span>فتح حساب Microsoft المرتبط بالمستخدم وإدارة ملفاته على OneDrive.</span>
            </button>
          </div>
          <div class="cuh-grid" data-platform-area>
            <div class="cuh-field">
              <label for="cuhFolder">المجلد المستهدف</label>
              <select id="cuhFolder"><option value="">الرئيسية</option></select>
            </div>
            <div class="cuh-field">
              <label for="cuhNewFolder">إنشاء مجلد جديد عند الحاجة</label>
              <div style="display:flex;gap:8px"><input id="cuhNewFolder" type="text" placeholder="اسم المجلد"><button type="button" class="cuh-btn" data-create-folder>إنشاء</button></div>
            </div>
            <div class="cuh-field full">
              <label>الملفات المختارة</label>
              <input id="cuhFiles" type="file" multiple hidden data-cloud-skip="true">
              <div class="cuh-actions" style="margin-top:0">
                <button type="button" class="cuh-btn blue" data-pick-files>اختيار ملفات</button>
                <button type="button" class="cuh-btn primary" data-upload-files disabled>رفع إلى سحابة المنصة</button>
                <button type="button" class="cuh-btn" data-open-center>إدارة ملفاتي السحابية</button>
              </div>
              <div class="cuh-files" data-file-list></div>
            </div>
          </div>
          <div class="cuh-actions" data-onedrive-area style="display:none">
            <button type="button" class="cuh-btn blue" data-open-onedrive>فتح OneDrive وتسجيل الدخول</button>
            <button type="button" class="cuh-btn" data-open-center>العودة إلى مركز ملفات المنصة</button>
          </div>
          <div class="cuh-status" data-status></div>
        </div>
      </div>`;
    document.body.appendChild(hub);
    wire(hub);
    return hub;
  }

  function status(hub,message,type){
    const el=hub.querySelector('[data-status]');
    el.textContent=message||'';
    el.className='cuh-status show '+(type||'info');
    clearTimeout(el._timer);
    if(type==='ok')el._timer=setTimeout(()=>el.classList.remove('show'),5000);
  }

  async function loadFolders(hub){
    const select=hub.querySelector('#cuhFolder');
    select.innerHTML='<option value="">الرئيسية</option>';
    if(!window.CloudFileEngine)return;
    try{
      const c=ctx();
      const result=await CloudFileEngine.listFolders({moduleKey:c.moduleKey,ownershipScope:c.ownershipScope||'user',all:true});
      (result.folders||[]).forEach(function(folder){
        const option=document.createElement('option');
        option.value=folder.id;
        option.textContent=folder.folder_name;
        select.appendChild(option);
      });
    }catch(error){status(hub,error.message||'تعذر تحميل المجلدات','bad');}
  }

  function renderSelected(hub){
    const input=hub.querySelector('#cuhFiles');
    const list=hub.querySelector('[data-file-list]');
    const upload=hub.querySelector('[data-upload-files]');
    const files=[...(input.files||[])];
    upload.disabled=!files.length;
    list.innerHTML=files.map(function(file){
      return '<div class="cuh-file"><span class="cuh-file-name">'+esc(file.name)+'</span><span style="font-size:11px;color:#74868b">'+Math.ceil(file.size/1024)+' KB</span></div>';
    }).join('');
  }

  function wire(hub){
    let provider='platform';
    const close=()=>{hub.classList.remove('is-open');hub.setAttribute('aria-hidden','true');};
    hub.querySelector('[data-cuh-close]').onclick=close;
    hub.addEventListener('click',function(event){if(event.target===hub)close();});
    document.addEventListener('keydown',function(event){if(event.key==='Escape'&&hub.classList.contains('is-open'))close();});

    hub.querySelectorAll('[data-provider]').forEach(function(button){
      button.onclick=function(){
        provider=button.dataset.provider;
        hub.querySelectorAll('[data-provider]').forEach(x=>x.classList.toggle('active',x===button));
        hub.querySelector('[data-platform-area]').style.display=provider==='platform'?'grid':'none';
        hub.querySelector('[data-onedrive-area]').style.display=provider==='onedrive'?'flex':'none';
        status(hub,provider==='platform'?'سيتم الحفظ داخل سحابة المنصة المرتبطة بالمدرسة الحالية.':'OneDrive خيار خارجي؛ افتح الحساب لإدارة ملفاتك المؤسسية.','info');
      };
    });

    hub.querySelector('[data-pick-files]').onclick=()=>hub.querySelector('#cuhFiles').click();
    hub.querySelector('#cuhFiles').onchange=()=>renderSelected(hub);

    hub.querySelector('[data-create-folder]').onclick=async function(){
      const input=hub.querySelector('#cuhNewFolder');
      const name=input.value.trim();
      if(!name)return status(hub,'اكتب اسم المجلد أولًا.','bad');
      try{
        if(!window.CloudFileEngine)throw new Error('محرك الملفات السحابية غير متاح في هذه الصفحة.');
        const c=ctx();
        const result=await CloudFileEngine.createFolder({moduleKey:c.moduleKey,ownershipScope:c.ownershipScope||'user',parentFolderId:null,folderName:name});
        input.value='';
        await loadFolders(hub);
        if(result.folder&&result.folder.id)hub.querySelector('#cuhFolder').value=result.folder.id;
        status(hub,'تم إنشاء المجلد السحابي.','ok');
      }catch(error){status(hub,error.message||'تعذر إنشاء المجلد.','bad');}
    };

    hub.querySelector('[data-upload-files]').onclick=async function(){
      const input=hub.querySelector('#cuhFiles');
      const files=[...(input.files||[])];
      if(!files.length)return;
      const button=this;
      try{
        if(!window.CloudFileEngine)throw new Error('محرك الملفات السحابية غير متاح في هذه الصفحة.');
        button.disabled=true;
        const c=ctx();
        const folderId=hub.querySelector('#cuhFolder').value||null;
        status(hub,'جارٍ رفع الملفات إلى سحابة المنصة...','info');
        const result=await CloudFileEngine.uploadMany({
          files,
          moduleKey:c.moduleKey,
          ownershipScope:c.ownershipScope||'user',
          folderId,
          recordType:c.recordType||'attachment',
          recordId:'cloud-hub',
          relationType:'attachment',
          metadata:{source:'unified_cloud_hub',page:location.pathname},
          continueOnError:true,
          onProgress:function(progress){status(hub,'جارٍ رفع '+progress.index+' من '+progress.total+'...','info');}
        });
        if(result.errors.length){
          status(hub,'تم حفظ '+result.results.length+' ملف، وتعذر حفظ '+result.errors.length+' ملف.','bad');
        }else{
          status(hub,'تم حفظ '+result.results.length+' ملف سحابيًا بنجاح.','ok');
          input.value='';
          renderSelected(hub);
        }
      }catch(error){status(hub,error.message||'تعذر رفع الملفات.','bad');}
      finally{button.disabled=false;}
    };

    hub.querySelectorAll('[data-open-center]').forEach(function(button){
      button.onclick=()=>window.open(rootPrefix()+'cloud_files_center.html','_blank','noopener');
    });
    hub.querySelector('[data-open-onedrive]').onclick=()=>window.open('https://onedrive.live.com/login','_blank','noopener,noreferrer');
  }

  async function open(){
    const hub=build();
    hub.classList.add('is-open');
    hub.setAttribute('aria-hidden','false');
    hub.querySelector('#cuhFiles').value='';
    renderSelected(hub);
    await loadFolders(hub);
  }

  window.CloudUploadHub={open};
  // إعادة استخدام أيقونة السحابة الأصلية في المنصة بدل إنشاء زر عائم جديد.
  window.showCloud=open;
})();
