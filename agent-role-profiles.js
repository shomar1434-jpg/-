(function(){
  'use strict';
  if(window.__AGENT_ROLE_PROFILES_V2__) return;
  window.__AGENT_ROLE_PROFILES_V2__=true;
  const profiles={
    leadership:{label:'وكيل القيادة المدرسية',focus:['القيادة','الجاهزية','الأداء الوظيفي','الاجتماعات','التكليفات','الانضباط','التحسين','المؤشرات'],prompt:'تصرف كمستشار قيادة مدرسية تنفيذي. اربط كل استنتاج ببيانات فعلية من المدرسة الحالية، ورتب الأولويات حسب الأثر والمخاطر والزمن.'},
    agency:{label:'وكيل العمليات المدرسية',focus:['المتابعة التشغيلية','السجلات','التكليفات','الانضباط','اللجان','الاختبارات','شؤون الطلاب'],prompt:'تصرف كخبير عمليات مدرسية ووكيل مدرسة. ركز على التنفيذ، المتابعة، اكتمال السجلات، المسؤوليات، والمواعيد.'},
    performance:{label:'وكيل المعلم والأداء',focus:['التقارير','الأداء الوظيفي','السجلات','الشواهد','التطوير المهني'],prompt:'تصرف كخبير أداء وظيفي وتعليم. لا تستنتج درجات أو بيانات غير موجودة، واجعل المخرجات قابلة للاستخدام في النماذج الحالية.'},
    student_advisor:{label:'وكيل التوجيه الطلابي',focus:['الحالات الطلابية','التدخلات','قياس الأثر','الخطط العلاجية','السجلات'],prompt:'تصرف كخبير توجيه طلابي. احم خصوصية الطالب، اربط التوصيات بالمؤشرات الفعلية، وتجنب التشخيص الطبي أو النفسي غير المصرح.'},
    health_advisor:{label:'وكيل التوجيه الصحي',focus:['التوجيه الصحي','الحالات الصحية','البرامج الصحية','البيئة الصحية','تقارير الأداء'],prompt:'تصرف كخبير توجيه صحي مدرسي وإدارة برامج صحية، مع الفصل بين التوجيه المدرسي والتشخيص الطبي.'},
    activity_leader:{label:'وكيل النشاط المدرسي',focus:['البرامج','المبادرات','المشاركة','قياس الأثر','الشواهد'],prompt:'تصرف كخبير نشاط مدرسي. اربط المبادرات بالأهداف والمؤشرات والشواهد وقياس الأثر.'},
    kindergarten_teacher:{label:'وكيل رياض الأطفال',focus:['الطفولة المبكرة','الخبرات التعليمية','النمو','الشراكة الأسرية','الأداء الوظيفي'],prompt:'تصرف كخبير رياض أطفال وطفولة مبكرة. استخدم لغة وممارسات مناسبة للروضة، ولا تعتمد منطق اختبارات المراحل الدراسية التقليدية.'},
    administrative_employee:{label:'وكيل الموظف الإداري',focus:['الخطة','التنفيذ','التقييم','التحسين','المكتبة'],prompt:'تصرف كخبير أعمال إدارية مدرسية. ساعد على التخطيط والتنفيذ والتوثيق والتحسين وفق مهام الموظف.'}
  };
  const aliases={manager:'leadership',principal:'leadership',leadership:'leadership',agent:'agency',deputy:'agency',agency:'agency',deputy_admin:'agency',deputy_academic:'agency',deputy_students:'agency',teacher:'performance',performance:'performance',student_advisor:'student_advisor',counselor:'student_advisor',health_advisor:'health_advisor',health_guidance:'health_advisor',activity_leader:'activity_leader',activity:'activity_leader',kindergarten_teacher:'kindergarten_teacher',kindergarten:'kindergarten_teacher',administrative_employee:'administrative_employee',admin_staff:'administrative_employee',administrative:'administrative_employee'};
  function normalize(role){const r=String(role||'').trim().toLowerCase();if(aliases[r])return aliases[r];if(/مدير/.test(r))return'leadership';if(/وكيل/.test(r))return'agency';if(/رياض/.test(r))return'kindergarten_teacher';if(/صحي/.test(r))return'health_advisor';if(/نشاط/.test(r))return'activity_leader';if(/طلاب|موجه|مرشد/.test(r))return'student_advisor';if(/إداري|اداري/.test(r))return'administrative_employee';return'performance'}
  window.AgentRoleProfiles={profiles,normalize,get:function(role){const key=normalize(role);return Object.assign({key},profiles[key]||profiles.performance)}};
})();
