import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const guardian=read('./supabase/functions/student-affairs-guardian/index.ts');
const absence=read('./supabase/functions/platform-absence-excuses/index.ts');
const procedures=read('./student_affairs_procedures.html');
const excuses=read('./student_absence_excuses.html');
const workflow=read('./.github/workflows/deploy-supabase-functions.yml');
const checks=[
  ['التحقق بآخر 4 أرقام فقط',/if\(last4\.length!==4\)/.test(guardian)&&!/if\(!guardianName\|\|last4\.length!==4\)/.test(guardian)],
  ['الخدمة تعيد اسم الطالب وتاريخ الإرسال',guardian.includes('studentName:tx.student_name')&&guardian.includes('sentAt:tx.created_at')],
  ['البوابة تعرض اسم الطالب والتاريخ',procedures.includes("set('guardianPortalStudent',publicInfo.studentName")&&procedures.includes("set('guardianPortalDate',publicInfo.sentAt")],
  ['رسالة واتساب لا تضيف هوية دخول الوكيل',!procedures.slice(procedures.indexOf('async function openWhatsApp()'),procedures.indexOf("$('#sendWhatsApp')")).includes('${getAgentName()}')],
  ['مسمى وكيل شؤون الطلاب الأول مدعوم',guardian.includes("x.includes('شؤون الطلاب')")&&absence.includes("x.includes('شؤون الطلاب')")],
  ['إنشاء رابط العذر يستعيد الجلسة',excuses.includes('r.status===401&&PlatformCloudSession?.recover')],
  ['Workflow يراقب كل وظائف Supabase',workflow.includes('"supabase/functions/**"')&&workflow.includes('supabase functions deploy')]
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++}
if(failed)process.exit(1);
console.log(`PASS: ${checks.length}/${checks.length}`);
