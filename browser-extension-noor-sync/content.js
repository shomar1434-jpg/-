(() => {
  if (window.__SMART_SCHOOL_NOOR_CONTENT_V1__) return;
  window.__SMART_SCHOOL_NOOR_CONTENT_V1__ = true;
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const definitions = {
    name:['اسم الطالب','الطالب','الاسم'], nationalId:['السجل المدني','رقم الهوية','الهوية','رقم السجل'],
    stage:['المرحلة','المرحلة الدراسية'], grade:['الصف','الصف الدراسي'], section:['الشعبة','الفصل','رقم الشعبة'],
    day:['اليوم','يوم الغياب'], absenceDate:['تاريخ الغياب','التاريخ'], notes:['ملاحظات','السبب','بيان']
  };
  function mapping(headers) {
    const map = {};
    for (const [key, words] of Object.entries(definitions)) {
      const index = headers.findIndex(h => words.some(w => clean(h).includes(w)));
      if (index >= 0) map[key] = index;
    }
    return map.name !== undefined && (map.nationalId !== undefined || map.absenceDate !== undefined) ? map : null;
  }
  function schoolName() {
    const selectors=['#ctl00_lblSchoolName','[id*="SchoolName"]','.school-name','[data-school-name]'];
    for (const selector of selectors) {const e=document.querySelector(selector),v=clean(e?.textContent||e?.getAttribute?.('data-school-name'));if(v)return v}
    return '';
  }
  function extract() {
    let table=null, map=null, headerRow=null;
    for (const candidate of document.querySelectorAll('table')) {
      for (const row of [...candidate.querySelectorAll('tr')].slice(0,10)) {
        const headers=[...row.querySelectorAll(':scope > th, :scope > td')].map(x=>clean(x.textContent));
        const found=mapping(headers); if(found){table=candidate;map=found;headerRow=row;break}
      }
      if(table)break;
    }
    if(!table)throw new Error('لم يتم العثور على جدول الغياب. افتح كشف الغياب اليومي الذي يحتوي اسم الطالب والسجل المدني أو التاريخ.');
    const result=[];
    for(const row of table.querySelectorAll('tr')){
      if(row===headerRow||row.querySelector('th'))continue;
      const cells=[...row.querySelectorAll(':scope > td')].map(x=>clean(x.textContent));if(!cells.length)continue;
      const item={schoolName:schoolName()};for(const [key,index] of Object.entries(map))item[key]=cells[index]||'';
      if(clean(item.name))result.push(item);
    }
    return result;
  }
  chrome.runtime.onMessage.addListener((request,_sender,sendResponse)=>{
    if(request?.action!=='extractData'||request?.type!=='absence')return false;
    try{sendResponse({success:true,data:extract()})}catch(error){sendResponse({success:false,error:String(error?.message||error)})}
    return false;
  });
})();
