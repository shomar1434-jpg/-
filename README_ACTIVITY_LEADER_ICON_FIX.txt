تم تصحيح أيقونة رائد النشاط:
السبب كان أن زر ssActivityLeaders كان يظهر في الشريط العلوي، لكن لم يكن مربوطًا بحدث click داخل دالة attach().
تم ربطه الآن بـ showUsers('activity_leader') لعرض رواد النشاط المفعلين.
كما تم تأكيد أن الدخول للمتابعة يفتح activity_leader.html وليس teacher.html.
