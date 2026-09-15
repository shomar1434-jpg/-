/**
 * مساعد الربط المدرسي الموحد - Popup Logic (نسخة الأتمتة الميكرو واللوحة المنقسمة)
 */

let activeTabId = null;
let currentSite = ''; // 'noor' or 'hudoori'
let automationRunning = false;

let collectedStudents = null;
let collectedAbsence = null;
let collectedStaff = null;

let currentData = [];
let currentType = ''; // 'students', 'absence', 'staff'

// تهيئة وفحص حالة المتصفح عند فتح الإضافة
document.addEventListener('DOMContentLoaded', async () => {
  const tab = await getActiveTab();
  const siteBadge = document.getElementById('siteBadge');
  const btnStart = document.getElementById('btnStartImport');
  
  initDates();

  if (!tab || !tab.url) {
    siteBadge.textContent = 'تعذر التعرف';
    siteBadge.className = 'badge error';
    return;
  }

  activeTabId = tab.id;
  const url = tab.url;

  if (url.includes('noor.moe.gov.sa') || url.includes('moe.gov.sa')) {
    currentSite = 'noor';
    siteBadge.textContent = 'نظام نور التعليمي 📚';
    siteBadge.className = 'badge active';
    btnStart.disabled = false;
    writeLog('تم التعرف على نظام نور. جاهز لبدء الاستيراد التلقائي.');
  } 
  else if (url.includes('hudoori.gov.sa') || url.includes('hudoori.moe.gov.sa')) {
    currentSite = 'hudoori';
    siteBadge.textContent = 'منصة حضوري ✅';
    siteBadge.className = 'badge active';
    btnStart.disabled = false;
    writeLog('تم التعرف على منصة حضوري. جاهز لبدء الاستيراد التلقائي.');
  } 
  else {
    siteBadge.textContent = 'موقع غير مدعوم ❌';
    siteBadge.className = 'badge error';
    btnStart.disabled = true;
    writeLog('يرجى الانتقال لموقع نور أو منصة حضوري للبدء.');
  }
});

// تفعيل الجدولة اليومية
window.toggleSchedule = function() {
  const btn = document.getElementById('btnSchedule');
  chrome.storage.local.get(['scheduled'], (res) => {
    const nextState = !res.scheduled;
    chrome.storage.local.set({ scheduled: nextState }, () => {
      if (nextState) {
        btn.textContent = '⏰ المزامنة اليومية نشطة (الساعة 7:30 صباحاً)';
        btn.className = 'btn-schedule active';
        writeLog('تم تفعيل الجدولة التلقائية اليومية بنجاح.');
      } else {
        btn.textContent = '⏰ تفعيل المزامنة التلقائية اليومية';
        btn.className = 'btn-schedule';
        writeLog('تم إيقاف الجدولة اليومية.');
      }
    });
  });
};

function initDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('dateFrom').value = today;
  document.getElementById('dateTo').value = today;
  
  chrome.storage.local.get(['scheduled'], (res) => {
    const btn = document.getElementById('btnSchedule');
    if (res.scheduled) {
      btn.textContent = '⏰ المزامنة اليومية نشطة (الساعة 7:30 صباحاً)';
      btn.className = 'btn-schedule active';
    }
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function writeLog(message) {
  const logBox = document.getElementById('logBox');
  const time = new Date().toLocaleTimeString('ar-SA');
  logBox.innerHTML = `[${time}] ${message}\n` + logBox.innerHTML;
}

function setStep(stepNum, status) {
  const stepEl = document.getElementById(`step${stepNum}`);
  if (status === 'active') {
    stepEl.className = 'step-item active';
  } else if (status === 'done') {
    stepEl.className = 'step-item done';
    stepEl.querySelector('.step-dot').textContent = '✓';
  } else {
    stepEl.className = 'step-item';
    stepEl.querySelector('.step-dot').textContent = stepNum;
  }
}

// دالة بدء الاستيراد التلقائي والأتمتة
window.startAutoImport = async function() {
  if (automationRunning) return;
  automationRunning = true;
  document.getElementById('btnStartImport').disabled = true;
  document.getElementById('progressCard').style.display = 'block';
  document.getElementById('btnDownload').disabled = true;

  // إعادة ضبط الخطوات
  for (let i = 1; i <= 4; i++) setStep(i, 'pending');

  try {
    setStep(1, 'active');
    writeLog('🔍 جاري التحقق من الصفحة النشطة وتوجيه الأتمتة...');
    
    if (currentSite === 'noor') {
      await runNoorAutomation();
    } else if (currentSite === 'hudoori') {
      await runHudooriAutomation();
    }
  } catch (error) {
    writeLog(`❌ فشل أثناء الأتمتة: ${error.message}`);
    alert(`حدث خطأ أثناء سحب البيانات تلقائياً: ${error.message}`);
  } finally {
    automationRunning = false;
    document.getElementById('btnStartImport').disabled = false;
  }
};

// أتمتة نظام نور (التنقل الذاتي والسحب)
async function runNoorAutomation() {
  const baseUrl = 'https://noor.moe.gov.sa/Noor';

  // 1. الانتقال وسحب بيانات الطلاب
  setStep(1, 'done');
  setStep(2, 'active');
  writeLog('🚀 جاري توجيه المتصفح لصفحة الطلاب...');
  
  await navigateTabAndWait(`${baseUrl}/Schools/Students/StudentsList.aspx`);
  writeLog('📋 تم تحميل صفحة الطلاب. جاري استخراج البيانات...');
  
  collectedStudents = await extractFromContent('students');
  writeLog(`✅ تم سحب ${collectedStudents.length} طالب بنجاح.`);

  // تحديث المعاينة كخيار أولي
  currentData = collectedStudents;
  currentType = 'students';
  renderPreviewTable();

  // 2. الانتقال وسحب غياب الطلاب اليومي
  setStep(2, 'done');
  setStep(3, 'active');
  writeLog('🚀 جاري الانتقال لصفحة كشف الغياب اليومي...');
  
  await navigateTabAndWait(`${baseUrl}/Schools/Reports/StudentsAbsenceDaily.aspx`);
  writeLog('📕 تم تحميل صفحة الغياب. جاري استخراج البيانات...');
  
  collectedAbsence = await extractFromContent('absence');
  collectedAbsence = enrichAbsenceWithStudentIdentity(collectedAbsence, collectedStudents);
  writeLog(`✅ تم سحب غياب الطلاب بنجاح.`);

  // 3. بناء وتنزيل الملفات
  setStep(3, 'done');
  setStep(4, 'active');
  writeLog('📊 جاري بناء ملفات Excel المنسقة وتنزيلها...');
  
  downloadNoorExcelFiles();
  setStep(4, 'done');
  writeLog('🎉 اكتملت عملية الاستيراد بنجاح تام وتم تحميل الملفات!');
  
  // تفعيل زر التنزيل ليعيد التنزيل عند الحاجة
  document.getElementById('btnDownload').disabled = false;
}

// أتمتة تطبيق حضوري
async function runHudooriAutomation() {
  // 1. استخراج بيانات حضور الموظفين
  setStep(1, 'done');
  setStep(2, 'active');
  writeLog('🚀 جاري توجيه المتصفح لصفحة سجل المعلمين والمنسوبين...');
  
  const tab = await getActiveTab();
  if (!tab.url.includes('Reports') && !tab.url.includes('Attendance')) {
    await navigateTabAndWait(tab.url.split('/Home')[0] + '/Attendance/StaffAttendanceReport');
  }
  
  writeLog('📋 تم تحميل صفحة الحضور. جاري استخراج البيانات...');
  setStep(2, 'done');
  setStep(3, 'active');
  
  collectedStaff = await extractFromContent('staff');
  writeLog(`✅ تم سحب سجلات حضور المعلمين بنجاح.`);

  // تحديث المعاينة
  currentData = collectedStaff;
  currentType = 'staff';
  renderPreviewTable();

  // 2. بناء وتنزيل الملفات
  setStep(3, 'done');
  setStep(4, 'active');
  writeLog('📊 جاري بناء ملف Excel الموحد وتنزيله...');
  
  downloadHudooriExcelFile();
  setStep(4, 'done');
  writeLog('🎉 اكتملت عملية الاستيراد بنجاح تام وتم تحميل الملف!');
  
  document.getElementById('btnDownload').disabled = false;
}

// دالة مساعدة لتغيير رابط التبويب والانتظار حتى انتهاء التحميل
function navigateTabAndWait(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(activeTabId, { url: url }, (tab) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      
      function listener(tabId, changeInfo) {
        if (tabId === activeTabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 1500);
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

// دالة إرسال أمر استخراج البيانات لـ Content Script
function extractFromContent(type) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(activeTabId, { action: "extractData", type: type }, (response) => {
      if (chrome.runtime.lastError) {
        setTimeout(() => {
          chrome.tabs.sendMessage(activeTabId, { action: "extractData", type: type }, (retryResponse) => {
            if (chrome.runtime.lastError) {
              reject(new Error("لم نتمكن من الاتصال بصفحة المتصفح. تأكد من تحديث الصفحة."));
            } else if (retryResponse && retryResponse.success) {
              resolve(retryResponse.data);
            } else {
              reject(new Error(retryResponse ? retryResponse.error : "خطأ في السحب"));
            }
          });
        }, 1500);
      } else if (response && response.success) {
        resolve(response.data);
      } else {
        reject(new Error(response ? response.error : "فشل استخراج البيانات"));
      }
    });
  });
}

// بناء جدول المعاينة وعرضه على الجهة اليسرى
function renderPreviewTable(filteredData = null) {
  const data = filteredData || currentData;
  const tableHeaders = document.getElementById('tblHeaders');
  const tableBody = document.getElementById('tblBody');
  const countEl = document.getElementById('previewCount');

  if (!data || data.length === 0) {
    tableHeaders.innerHTML = '<th>م</th><th style="color: var(--muted); font-weight: normal; text-align: center;">لا توجد بيانات متاحة حالياً</th>';
    tableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--muted); padding: 40px 0;">تظهر البيانات هنا تلقائياً بمجرد بدء الاستيراد</td></tr>';
    countEl.textContent = '0 سجل';
    return;
  }

  const columns = {
    'students': [
      { key: 'rowNum', label: 'م' },
      { key: 'name', label: 'اسم الطالب' },
      { key: 'nationalId', label: 'السجل المدني' },
      { key: 'stage', label: 'المرحلة' },
      { key: 'grade', label: 'الصف' },
      { key: 'section', label: 'الشعبة' },
      { key: 'semester', label: 'الفصل الدراسي' },
      { key: 'noorCode', label: 'رقم نور' },
      { key: 'pullDate', label: 'تاريخ السحب' }
    ],
    'absence': [
      { key: 'rowNum', label: 'م' },
      { key: 'schoolName', label: 'اسم المدرسة' },
      { key: 'stage', label: 'المرحلة' },
      { key: 'name', label: 'اسم الطالب' },
      { key: 'nationalId', label: 'السجل المدني' },
      { key: 'grade', label: 'الصف' },
      { key: 'section', label: 'الشعبة' },
      { key: 'day', label: 'اليوم' },
      { key: 'absenceDate', label: 'تاريخ الغياب' },
      { key: 'absenceType', label: 'نوع الغياب' },
      { key: 'notes', label: 'ملاحظات' },
      { key: 'pullDate', label: 'تاريخ السحب' }
    ],
    'staff': [
      { key: 'rowNum', label: 'م' },
      { key: 'employeeName', label: 'اسم الموظف' },
      { key: 'date', label: 'التاريخ' },
      { key: 'status', label: 'الحالة' },
      { key: 'lateMinutes', label: 'دقائق التأخر' },
      { key: 'leaveType', label: 'نوع الإجازة' },
      { key: 'notes', label: 'ملاحظات' },
      { key: 'pullDate', label: 'تاريخ السحب' }
    ]
  };

  const cols = columns[currentType] || Object.keys(data[0]).map(k => ({ key: k, label: k }));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // تعبئة العناوين
  tableHeaders.innerHTML = cols.map(c => `<th>${esc(c.label)}</th>`).join('');

  // تعبئة الصفوف
  tableBody.innerHTML = data.map((row, idx) => `
    <tr>
      ${cols.map(c => {
        let val = row[c.key];
        if (c.key === 'rowNum') val = idx + 1;
        return `<td>${esc(val)}</td>`;
      }).join('')}
    </tr>
  `).join('');

  countEl.textContent = `${data.length} سجل`;
}

// تصفية المعاينة بالبحث السريع
window.filterPreviewTable = function() {
  const query = document.getElementById('txtSearch').value.toLowerCase().trim();
  if (!query) {
    renderPreviewTable();
    return;
  }

  const filtered = currentData.filter(row => {
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(query)
    );
  });

  renderPreviewTable(filtered);
};

// تنزيل إكسل نور
function downloadNoorExcelFiles() {
  const dateStr = new Date().toISOString().slice(0, 10);

  if (collectedStudents && collectedStudents.length > 0) {
    const headers = ['م', 'اسم الطالب', 'السجل المدني', 'المرحلة', 'الصف', 'الشعبة', 'الفصل الدراسي', 'رقم نور', 'تاريخ السحب'];
    const keys = ['rowNum', 'name', 'nationalId', 'stage', 'grade', 'section', 'semester', 'noorCode', 'pullDate'];
    const wsData = [headers, ...collectedStudents.map((row, idx) => keys.map(key => key === 'rowNum' ? idx + 1 : (row[key] ?? '')))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!dir'] = 'rtl';
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف الطلاب الموحد');
    XLSX.writeFile(wb, `كشف_الطلاب_نور_الموحد_${dateStr}.xlsx`);
  }

  if (collectedAbsence && collectedAbsence.length > 0) {
    const headers = ['م', 'اسم المدرسة', 'المرحلة', 'الصف', 'الفصل أو الشعبة', 'اسم الطالب', 'رقم السجل المدني', 'اليوم', 'التاريخ', 'نوع الغياب', 'ملاحظات', 'تاريخ السحب'];
    const keys = ['rowNum', 'schoolName', 'stage', 'grade', 'section', 'name', 'nationalId', 'day', 'absenceDate', 'absenceType', 'notes', 'pullDate'];
    const wsData = [headers, ...collectedAbsence.map((row, idx) => keys.map(key => key === 'rowNum' ? idx + 1 : (row[key] ?? '')))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!dir'] = 'rtl';
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'غياب الطلاب اليومي');
    XLSX.writeFile(wb, `سجل_غياب_الطلاب_نور_${dateStr}.xlsx`);
  }
}

function normalizeMatchText(value) {
  return String(value || '').normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u065F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function enrichAbsenceWithStudentIdentity(absenceRows, studentRows) {
  const students = Array.isArray(studentRows) ? studentRows : [];
  return (Array.isArray(absenceRows) ? absenceRows : []).map(row => {
    const name = normalizeMatchText(row.name);
    const grade = normalizeMatchText(row.grade);
    const section = normalizeMatchText(row.section);
    const match = students.find(student => normalizeMatchText(student.name) === name && (!grade || normalizeMatchText(student.grade) === grade) && (!section || normalizeMatchText(student.section) === section));
    let weekday = row.day || '';
    if (!weekday && row.absenceDate) {
      const parsedDate = new Date(row.absenceDate);
      if (!Number.isNaN(parsedDate.getTime())) weekday = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(parsedDate);
    }
    return {
      ...row,
      nationalId: row.nationalId || match?.nationalId || '',
      stage: row.stage || match?.stage || '',
      grade: row.grade || match?.grade || '',
      section: row.section || match?.section || '',
      day: weekday
    };
  });
}

// تنزيل إكسل حضوري
function downloadHudooriExcelFile() {
  if (!collectedStaff || collectedStaff.length === 0) return;

  const dateStr = new Date().toISOString().slice(0, 10);
  const headers = ['م', 'اسم الموظف', 'التاريخ', 'الحالة', 'دقائق التأخر', 'نوع الإجازة', 'ملاحظات', 'تاريخ السحب'];
  const keys = ['rowNum', 'employeeName', 'date', 'status', 'lateMinutes', 'leaveType', 'notes', 'pullDate'];
  const wsData = [headers, ...collectedStaff.map((row, idx) => keys.map(key => key === 'rowNum' ? idx + 1 : (row[key] ?? '')))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!dir'] = 'rtl';
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'سجل حضور المعلمين الموحد');
  XLSX.writeFile(wb, `سجل_انضباط_المعلمين_حضوري_${dateStr}.xlsx`);
}

// دالة تحميل إكسل المربوطة بزر التنزيل في اللوحة اليسرى
window.downloadExcel = function() {
  if (currentSite === 'noor') {
    downloadNoorExcelFiles();
  } else if (currentSite === 'hudoori') {
    downloadHudooriExcelFile();
  }
};
