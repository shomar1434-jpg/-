/**
 * مساعد الربط المدرسي الموحد - Content Script
 * يعمل هذا السكربت داخل صفحات نظام نور ومنصة حضوري لقراءة الجداول تلقائياً.
 */

// الاستماع للرسائل القادمة من الواجهة المنبثقة (popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractData") {
    try {
      const result = performExtraction(request.type);
      sendResponse({ success: true, data: result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // إبقاء القناة مفتوحة للرد غير المتزامن
});

// الدالة الرئيسية للاستخراج
function performExtraction(type) {
  const tables = Array.from(document.querySelectorAll('table'));
  if (tables.length === 0) {
    throw new Error("لم يتم العثور على أي جداول بيانات في هذه الصفحة. تأكد من فتح الصفحة الصحيحة التي تحوي الكشوفات.");
  }

  // البحث عن الجدول الأنسب بناءً على الكلمات المفتاحية في ترويسته
  let targetTable = null;
  let columnsMapping = null;

  for (const table of tables) {
    const candidateRows = Array.from(table.querySelectorAll('tr')).slice(0, 8);
    for (const headerRow of candidateRows) {
      const headers = Array.from(headerRow.querySelectorAll(':scope > th, :scope > td')).map(el => el.textContent.trim());
      const candidateMapping = detectColumns(headers, type);
      if (candidateMapping) {
        columnsMapping = candidateMapping;
        targetTable = table;
        break;
      }
    }
    if (targetTable) break;
  }

  if (!targetTable) {
    throw new Error("تعذر التعرف على جدول البيانات المطلوب في الصفحة. تأكد من أنك تفتح جدولاً يحتوي على البيانات الصحيحة.");
  }

  // استخراج البيانات من الصفوف
  const rows = Array.from(targetTable.querySelectorAll('tbody tr, tr')).filter(row => {
    // تصفية صفوف الترويسة أو الصفوف الفارغة
    return row.querySelector('td') && !row.querySelector('th');
  });

  const extractedData = [];
  const today = new Date().toLocaleDateString('ar-SA');

  rows.forEach((row, index) => {
    const cells = Array.from(row.querySelectorAll('td')).map(el => el.textContent.trim());
    const highestRequiredIndex = Math.max(...Object.values(columnsMapping).map(mapping => mapping.index));
    if (cells.length <= highestRequiredIndex) return; // تخطي الصفوف غير المكتملة

    const item = { rowNum: index + 1 };
    let hasData = false;

    for (const [key, mapping] of Object.entries(columnsMapping)) {
      const cellValue = cells[mapping.index];
      item[key] = cellValue !== undefined ? cellValue : '';
      if (cellValue) hasData = true;
    }

    if (hasData) {
      // إضافات تلقائية بناءً على نوع الجدول
      if (type === 'students') {
        item.pullDate = today;
      } else if (type === 'absence') {
        item.schoolName = item.schoolName || detectSchoolName();
        item.pullDate = today;
      } else if (type === 'staff') {
        item.pullDate = today;
      }
      extractedData.push(item);
    }
  });

  return extractedData;
}

// دالة ذكية لتحديد أعمدة الجدول ومواقعها بالاعتماد على الكلمات المفتاحية
function detectColumns(headers, type) {
  const mapping = {};
  
  if (type === 'students') {
    const definitions = {
      name: ['اسم الطالب', 'الطالب', 'الاسم'],
      nationalId: ['السجل المدني', 'رقم الهوية', 'الهوية', 'رقم السجل'],
      stage: ['المرحلة', 'المرحلة الدراسية'],
      grade: ['الصف', 'الصف الدراسي'],
      section: ['الشعبة', 'الفصل', 'رقم الشعبة'], // في نور الفصل يمثل الشعبة
      semester: ['الفصل الدراسي', 'الترم'],
      noorCode: ['رقم نور', 'رقم الطالب', 'الرمز الأكاديمي']
    };

    return matchDefinitions(headers, definitions);
  } 
  
  else if (type === 'absence') {
    const definitions = {
      schoolName: ['اسم المدرسة', 'المدرسة'],
      name: ['اسم الطالب', 'الطالب', 'الاسم'],
      nationalId: ['السجل المدني', 'رقم الهوية', 'الهوية', 'رقم السجل'],
      stage: ['المرحلة', 'المرحلة الدراسية'],
      grade: ['الصف', 'الصف الدراسي'],
      section: ['الشعبة', 'الفصل', 'رقم الشعبة'],
      day: ['اليوم', 'يوم الغياب'],
      absenceDate: ['تاريخ الغياب', 'التاريخ', 'يوم الغياب'],
      absenceType: ['نوع الغياب', 'الحالة', 'عذر الغياب'],
      notes: ['ملاحظات', 'السبب', 'بيان']
    };

    return matchDefinitions(headers, definitions);
  } 
  
  else if (type === 'staff') {
    const definitions = {
      employeeName: ['اسم الموظف', 'الموظف', 'الاسم', 'المعلم'],
      date: ['التاريخ', 'اليوم', 'تاريخ الحركة'],
      status: ['الحالة', 'الحركة', 'نوع الحركة'],
      lateMinutes: ['دقائق التأخر', 'التأخير', 'مدة التأخير', 'التأخر'],
      leaveType: ['نوع الإجازة', 'الإجازة', 'عذر الإجازة'],
      notes: ['ملاحظات', 'البيان', 'تفاصيل']
    };

    return matchDefinitions(headers, definitions);
  }

  return null;
}

function detectSchoolName() {
  const selectors = ['#ctl00_lblSchoolName', '[id*="SchoolName"]', '.school-name', '[data-school-name]'];
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.textContent?.trim() || document.querySelector(selector)?.getAttribute?.('data-school-name');
    if (value) return value;
  }
  return '';
}

// مطابقة التعريفات بالترويسات الفعلية للجدول
function matchDefinitions(headers, definitions) {
  const mapping = {};
  let matchesCount = 0;

  for (const [key, keywords] of Object.entries(definitions)) {
    let foundIndex = -1;
    
    // البحث عن تطابق كامل أو جزئي في ترويسات الجدول
    for (let i = 0; i < headers.length; i++) {
      const headerText = headers[i].toLowerCase();
      if (keywords.some(kw => headerText.includes(kw.toLowerCase()))) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== -1) {
      mapping[key] = { index: foundIndex };
      matchesCount++;
    }
  }

  // نعتبر أن الجدول متطابق إذا تم العثور على عمودين رئيسيين على الأقل
  // مثلاً (الاسم والهوية للطلاب) أو (الموظف والتاريخ للمعلمين)
  if (matchesCount >= 2) {
    return mapping;
  }
  
  return null;
}
