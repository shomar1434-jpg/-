
(function(){
  'use strict';
  window.WeeklyAnalyticsEngine = {
    NS:'smartSchoolUnifiedOpsV2',
    read:function(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d));}catch(e){return d;}},
    activeSchool:function(){
      function r(k){return localStorage.getItem(k)||''}
      var st={}; try{st=JSON.parse(localStorage.getItem('smartSchool.currentSchool')||'{}')}catch(e){}
      return {
        id:r('active_school_id')||r('current_school_id')||r('school_id')||st.schoolId||st.id||'',
        name:r('active_school_name')||r('current_school_name')||r('school_name')||st.schoolName||st.school_name||'المدرسة الحالية'
      };
    },
    sameSchool:function(item,sid){
      if(!sid || !item || typeof item!=='object') return true;
      var v=item.schoolId||item.school_id||item.activeSchoolId||item.targetSchoolId||item.sourceSchoolId||'';
      return !v || String(v)===String(sid);
    },
    weekKey:function(dateValue){
      var d=dateValue?new Date(dateValue):new Date();
      if(isNaN(d.getTime())) d=new Date();
      var onejan=new Date(d.getFullYear(),0,1);
      var week=Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7);
      return d.getFullYear()+'-W'+String(week).padStart(2,'0');
    },
    fmtWeek:function(k){return String(k||'').replace('-W',' / الأسبوع ');},
    collect:function(){
      var s=this.activeSchool(), sid=s.id;
      var users=[].concat(this.read('offline_users_backup',[]),this.read(this.NS+'_users',[]),this.read('smart_school_users',[]));
      var seen={}; users=users.filter(function(u){var key=(u.id||u.email||u.name||Math.random()); if(seen[key]) return false; seen[key]=1; return true;})
        .filter((u)=>this.sameSchool(u,sid));
      var reports=[].concat(this.read('reports_archive',[]),this.read('enhancedReportsArchive',[]),this.read('manager_records_archive',[])).filter((r)=>this.sameSchool(r,sid));
      var roles=['manager','agent','teacher','student_advisor','activity_leader'];
      var notifications=[];
      roles.forEach((role)=>{notifications=notifications.concat(this.read(this.NS+'_notifications_'+role,[]).map(function(n){n._role=role;return n;}));});
      notifications=notifications.filter((n)=>this.sameSchool(n,sid));
      var plans=notifications.filter(function(n){return n.type==='improvement_plan' || /خطة تحسين/.test(n.title||n.message||'');});
      return {school:s,users:users,reports:reports,notifications:notifications,plans:plans};
    },
    roleName:function(r){
      r=String(r||'');
      if(/leadership|manager/.test(r)) return 'المدير';
      if(/agency|agent/.test(r)) return 'الوكيل';
      if(/student_advisor/.test(r)) return 'الموجه/الموجهة الطلابية';
      if(/activity_leader/.test(r)) return 'رائد النشاط';
      if(/teacher|performance/.test(r)) return 'المعلم';
      return r||'غير محدد';
    },
    weekly:function(){
      var d=this.collect(), map={};
      function add(week,type,owner){
        if(!map[week]) map[week]={week:week,reports:0,notifications:0,plans:0,users:{}};
        map[week][type]=(map[week][type]||0)+1;
        if(owner){map[week].users[owner]=(map[week].users[owner]||0)+1;}
      }
      d.reports.forEach((r)=>add(this.weekKey(r.createdAt||r.created_at||r.saveTimestamp||r.date||r.timestamp),'reports',r.userEmail||r.email||r.createdBy||r.owner||''));
      d.notifications.forEach((n)=>add(this.weekKey(n.createdAt||n.created_at||n.timestamp),'notifications',n.targetEmails&&n.targetEmails[0]||n.targetName||''));
      d.plans.forEach((p)=>add(this.weekKey(p.createdAt||p.created_at||p.timestamp),'plans',p.targetEmails&&p.targetEmails[0]||p.targetName||''));
      var arr=Object.values(map).sort((a,b)=>String(b.week).localeCompare(String(a.week)));
      return {data:d,weeks:arr};
    },
    staff:function(){
      var d=this.collect(), staff={};
      d.users.forEach((u)=>{
        var key=(u.email||u.id||u.name||'unknown');
        staff[key]={name:u.name||u.full_name||u.username||u.email||'بدون اسم',email:u.email||'',role:this.roleName(u.role||u.dbRole),reports:0,notifications:0,plans:0,score:0};
      });
      d.reports.forEach((r)=>{
        var key=r.userEmail||r.email||r.createdBy||r.owner||'';
        if(!staff[key]) staff[key]={name:r.userName||r.name||key||'غير محدد',email:key,role:'غير محدد',reports:0,notifications:0,plans:0,score:0};
        staff[key].reports++;
      });
      d.notifications.forEach((n)=>{
        var arr=n.targetEmails||[n.targetName||''];
        arr.forEach(function(key){ if(key){ if(!staff[key]) staff[key]={name:n.targetName||key, email:key,role:'غير محدد',reports:0,notifications:0,plans:0,score:0}; staff[key].notifications++; }});
      });
      d.plans.forEach((p)=>{
        var key=(p.targetEmails&&p.targetEmails[0])||p.targetName||'';
        if(key){ if(!staff[key]) staff[key]={name:p.targetName||key,email:key,role:'غير محدد',reports:0,notifications:0,plans:0,score:0}; staff[key].plans++; }
      });
      Object.values(staff).forEach(function(x){
        x.score=Math.min(100, Math.round((x.reports*12)+(x.notifications*3)+(x.plans*10)));
      });
      return {data:d,staff:Object.values(staff).sort((a,b)=>b.score-a.score)};
    },
    snapshot:function(){
      var w=this.weekly(), d=w.data, current=w.weeks[0]||{reports:0,notifications:0,plans:0};
      var activeUsers=this.staff().staff.filter(x=>x.score>0).length;
      var totalUsers=Math.max(1,d.users.length);
      var completion=Math.min(100,Math.round(((current.reports*10)+(current.notifications*2)+(current.plans*8)+(activeUsers/totalUsers*30))));
      return {school:d.school,totalUsers:d.users.length,totalReports:d.reports.length,totalNotifications:d.notifications.length,totalPlans:d.plans.length,currentWeek:current,activeUsers:activeUsers,completion:completion,weeks:w.weeks};
    }
  };
})();


(function(){
  if(!window.WeeklyAnalyticsEngine || window.WeeklyAnalyticsEngine.__executiveVisualsReady) return;
  var E = window.WeeklyAnalyticsEngine;
  E.__executiveVisualsReady = true;

  E.sectionScores = function(){
    var st = this.staff().staff;
    var groups = {};
    st.forEach(function(x){
      var role = x.role || 'غير محدد';
      if(!groups[role]) groups[role] = {section:role,total:0,count:0,reports:0,plans:0,notifications:0};
      groups[role].total += x.score || 0;
      groups[role].count += 1;
      groups[role].reports += x.reports || 0;
      groups[role].plans += x.plans || 0;
      groups[role].notifications += x.notifications || 0;
    });
    return Object.values(groups).map(function(g){
      g.score = g.count ? Math.round(g.total / g.count) : 0;
      return g;
    }).sort(function(a,b){return b.score-a.score;});
  };

  E.performanceIndex = function(){
    var snap = this.snapshot();
    var staff = this.staff().staff;
    var sections = this.sectionScores();
    var weeks = snap.weeks || [];
    var current = weeks[0] || {reports:0,notifications:0,plans:0};
    var previous = weeks[1] || {reports:0,notifications:0,plans:0};

    var activeRate = snap.totalUsers ? (snap.activeUsers / snap.totalUsers) * 100 : 0;
    var activityScore = Math.min(100, (current.reports * 12) + (current.notifications * 2) + (current.plans * 8));
    var improvementScore = Math.min(100, (snap.totalPlans * 12) + (current.plans * 10));
    var staffScore = staff.length ? staff.reduce(function(a,b){return a+(b.score||0);},0) / staff.length : 0;
    var balanceScore = sections.length ? Math.max(0, 100 - (Math.max.apply(null, sections.map(function(s){return s.score;})) - Math.min.apply(null, sections.map(function(s){return s.score;})))) : 70;

    var sspi = Math.round(
      (activityScore * .30) +
      (activeRate * .20) +
      (staffScore * .20) +
      (improvementScore * .15) +
      (balanceScore * .15)
    );
    sspi = Math.max(0, Math.min(100, sspi));

    var currentRaw = (current.reports*10)+(current.notifications*2)+(current.plans*8);
    var previousRaw = (previous.reports*10)+(previous.notifications*2)+(previous.plans*8);
    var trend = currentRaw > previousRaw ? 'صاعد' : (currentRaw < previousRaw ? 'منخفض' : 'مستقر');
    var grade = sspi >= 90 ? 'ممتاز' : sspi >= 75 ? 'جيد جدًا' : sspi >= 60 ? 'جيد' : sspi >= 40 ? 'بحاجة متابعة' : 'منخفض';

    return {
      school:snap.school,
      sspi:sspi,
      grade:grade,
      trend:trend,
      activeRate:Math.round(activeRate),
      activityScore:Math.round(activityScore),
      staffScore:Math.round(staffScore),
      improvementScore:Math.round(improvementScore),
      balanceScore:Math.round(balanceScore),
      currentWeek: current,
      previousWeek: previous,
      weeks: weeks,
      sections: sections,
      staff: staff,
      snapshot: snap
    };
  };

  E.executiveChartData = function(){
    var p = this.performanceIndex();
    var weeks = (p.weeks || []).slice(0,8).reverse().map(function(w){
      var score = Math.min(100, (w.reports*10)+(w.notifications*2)+(w.plans*8));
      return {label:E.fmtWeek(w.week), score:score, reports:w.reports||0, notifications:w.notifications||0, plans:w.plans||0};
    });
    var sections = p.sections.map(function(s){return {label:s.section, score:s.score, reports:s.reports, plans:s.plans, notifications:s.notifications};});
    var mix = [
      {label:'السجلات', value:p.snapshot.totalReports||0},
      {label:'التنبيهات', value:p.snapshot.totalNotifications||0},
      {label:'خطط التحسين', value:p.snapshot.totalPlans||0}
    ];
    return {performance:p,weeks:weeks,sections:sections,mix:mix};
  };

  E.generateManagerSmartAlerts = function(){
    var p = this.performanceIndex();
    var schoolId = p.school.id || 'default';
    var week = this.weekKey();
    var key = this.NS + '_notifications_manager';
    var arr = this.read(key, []);
    var alerts = [];

    function add(level,title,message){
      alerts.push({
        title:title,
        message:message,
        source:'analytics',
        color:level === 'danger' ? 'red' : (level === 'warning' ? 'blue' : 'green'),
        type:'analytics_alert',
        schoolId:schoolId,
        schoolName:p.school.name,
        analyticsWeek:week,
        createdAt:new Date().toISOString(),
        read:false
      });
    }

    if(p.sspi < 60) add('danger','تنبيه أداء عام منخفض','مؤشر الأداء العام للمدرسة أقل من 60% ويحتاج متابعة تنفيذية هذا الأسبوع.');
    else if(p.sspi < 75) add('warning','تنبيه متابعة الأداء','مؤشر الأداء العام متوسط ويحتاج تحسينًا في إنجاز السجلات والتفاعل.');
    if(p.trend === 'منخفض') add('warning','انخفاض في اتجاه الأداء','الأداء الأسبوعي الحالي أقل من الأسبوع السابق.');
    if(p.activeRate < 50) add('warning','انخفاض نشاط العاملين','نسبة العاملين النشطين أقل من نصف العاملين المسجلين.');
    p.sections.filter(function(s){return s.score < 50;}).slice(0,4).forEach(function(s){
      add('warning','قسم يحتاج متابعة: '+s.section,'مؤشر القسم '+s.score+'% ويحتاج متابعة أسبوعية.');
    });
    p.staff.filter(function(x){return (x.score||0) === 0;}).slice(0,6).forEach(function(x){
      add('warning','مستخدم غير نشط: '+x.name,'لا يظهر نشاط أسبوعي واضح لهذا المستخدم.');
    });

    alerts.forEach(function(a){
      var exists = arr.some(function(n){
        return n.type === 'analytics_alert' && n.title === a.title && n.schoolId === a.schoolId && n.analyticsWeek === a.analyticsWeek;
      });
      if(!exists) arr.unshift(a);
    });
    localStorage.setItem(key, JSON.stringify(arr));
    return alerts;
  };
})();


(function(){
  if(!window.WeeklyAnalyticsEngine || window.WeeklyAnalyticsEngine.__snapshotArchiveReady) return;
  var E = window.WeeklyAnalyticsEngine;
  E.__snapshotArchiveReady = true;

  E.snapshotArchiveKey = function(){
    var school = this.activeSchool();
    return 'weekly_analytics_snapshots_' + (school.id || 'default');
  };

  E.createWeeklySnapshot = function(force){
    var perf = this.performanceIndex ? this.performanceIndex() : this.snapshot();
    var week = this.weekKey();
    var key = this.snapshotArchiveKey();
    var archive = this.read(key, []);

    var exists = archive.some(function(x){
      return x.week === week;
    });

    if(exists && !force) return archive;

    var snapshot = {
      id: 'SNAP-' + Date.now(),
      week: week,
      schoolId: perf.school.id || '',
      schoolName: perf.school.name || '',
      createdAt: new Date().toISOString(),
      sspi: perf.sspi || perf.completion || 0,
      grade: perf.grade || '',
      trend: perf.trend || '',
      activeRate: perf.activeRate || 0,
      activityScore: perf.activityScore || 0,
      staffScore: perf.staffScore || 0,
      improvementScore: perf.improvementScore || 0,
      balanceScore: perf.balanceScore || 0,
      totalUsers: perf.snapshot ? perf.snapshot.totalUsers : 0,
      totalReports: perf.snapshot ? perf.snapshot.totalReports : 0,
      totalNotifications: perf.snapshot ? perf.snapshot.totalNotifications : 0,
      totalPlans: perf.snapshot ? perf.snapshot.totalPlans : 0,
      sections: perf.sections || [],
      topStaff: (perf.staff || []).slice(0,10)
    };

    archive.unshift(snapshot);
    archive = archive.slice(0, 52);

    localStorage.setItem(key, JSON.stringify(archive));
    return archive;
  };

  E.getWeeklySnapshots = function(){
    return this.read(this.snapshotArchiveKey(), []);
  };

  E.exportSnapshotReportHtml = function(snapshot){
    return `
      <html dir="rtl" lang="ar">
      <head>
      <meta charset="utf-8">
      <title>التقرير التحليلي الأسبوعي</title>
      <style>
      body{font-family:Cairo,Tahoma,Arial;background:#f8fafc;color:#0f172a;padding:24px}
      .card{background:#fff;border-radius:22px;padding:18px;margin-bottom:14px;border:1px solid #e2e8f0}
      .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
      h1{color:#0f766e}
      .kpi{font-size:32px;font-weight:900;color:#0f766e}
      table{width:100%;border-collapse:collapse}
      td,th{padding:10px;border-bottom:1px solid #e2e8f0;text-align:right}
      th{background:#ecfdf5;color:#065f46}
      </style>
      </head>
      <body>
      <h1>التقرير التحليلي الأسبوعي</h1>
      <div class="card">
        <b>المدرسة:</b> ${snapshot.schoolName}<br>
        <b>الأسبوع:</b> ${snapshot.week}<br>
        <b>تاريخ الإنشاء:</b> ${snapshot.createdAt}
      </div>

      <div class="grid">
        <div class="card"><div>مؤشر الأداء SSPI</div><div class="kpi">${snapshot.sspi}%</div></div>
        <div class="card"><div>معدل النشاط</div><div class="kpi">${snapshot.activeRate}%</div></div>
        <div class="card"><div>السجلات</div><div class="kpi">${snapshot.totalReports}</div></div>
        <div class="card"><div>خطط التحسين</div><div class="kpi">${snapshot.totalPlans}</div></div>
      </div>

      <div class="card">
        <h3>أفضل العاملين</h3>
        <table>
        <thead><tr><th>الاسم</th><th>الدور</th><th>المؤشر</th></tr></thead>
        <tbody>
        ${(snapshot.topStaff||[]).map(s=>`<tr><td>${s.name||''}</td><td>${s.role||''}</td><td>${s.score||0}%</td></tr>`).join('')}
        </tbody>
        </table>
      </div>
      </body></html>
    `;
  };

  setTimeout(function(){
    try{ E.createWeeklySnapshot(false); }catch(e){}
  }, 1200);
})();


(function(){
  if(!window.WeeklyAnalyticsEngine || window.WeeklyAnalyticsEngine.__clusterAnalyticsReady) return;
  var E = window.WeeklyAnalyticsEngine;
  E.__clusterAnalyticsReady = true;

  E.getManagedSchools = function(){
    var schools = [];
    try{
      schools = JSON.parse(localStorage.getItem('smart_school_schools') || '[]');
    }catch(e){ schools = []; }

    var current = this.activeSchool();
    var user = {};
    try{
      user = JSON.parse(localStorage.getItem('currentSchoolUser') || localStorage.getItem('currentUser') || '{}');
    }catch(e){}

    var managedIds = (user.schoolIds || []).map(String);

    var out = schools.filter(function(s){
      var sid = String(s.id || s.schoolId || '');
      return sid && (
        managedIds.includes(sid) ||
        String(s.managerEmail || s.manager_email || '').toLowerCase() === String(user.email || '').toLowerCase()
      );
    });

    if(current.id && !out.some(function(s){ return String(s.id || s.schoolId) === String(current.id); })){
      out.push({
        id: current.id,
        schoolId: current.id,
        schoolName: current.name
      });
    }

    var seen = {};
    return out.filter(function(s){
      var sid = String(s.id || s.schoolId || '');
      if(!sid || seen[sid]) return false;
      seen[sid] = true;
      return true;
    });
  };

  E.clusterAnalytics = function(){
    var current = this.activeSchool();
    var schools = this.getManagedSchools();
    var originalId = current.id;
    var results = [];

    schools.forEach((school)=>{
      try{
        localStorage.setItem('active_school_id', school.id || school.schoolId || '');
        localStorage.setItem('active_school_name', school.schoolName || school.school_name || '');

        var perf = this.performanceIndex();
        results.push({
          schoolId: school.id || school.schoolId || '',
          schoolName: school.schoolName || school.school_name || '',
          sspi: perf.sspi || 0,
          grade: perf.grade || '',
          trend: perf.trend || '',
          activeRate: perf.activeRate || 0,
          activityScore: perf.activityScore || 0,
          totalUsers: perf.snapshot ? perf.snapshot.totalUsers : 0,
          totalReports: perf.snapshot ? perf.snapshot.totalReports : 0,
          totalPlans: perf.snapshot ? perf.snapshot.totalPlans : 0,
          sections: perf.sections || []
        });
      }catch(e){}
    });

    localStorage.setItem('active_school_id', originalId || '');
    localStorage.setItem('active_school_name', current.name || '');

    var totalSSPI = results.reduce((a,b)=>a+(b.sspi||0),0);
    var avgSSPI = results.length ? Math.round(totalSSPI / results.length) : 0;

    var top = results.slice().sort((a,b)=>b.sspi-a.sspi)[0] || null;
    var low = results.slice().sort((a,b)=>a.sspi-b.sspi)[0] || null;

    return {
      schools: results,
      averageSSPI: avgSSPI,
      topSchool: top,
      lowSchool: low,
      schoolCount: results.length
    };
  };
})();
