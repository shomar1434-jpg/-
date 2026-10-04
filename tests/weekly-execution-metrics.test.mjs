import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import '../weekly-execution-metrics.js';
const M=globalThis.WeeklyExecutionMetrics;
const tasks=['weeklyPlan','madrasati','weeklyStrategy','followupRecord'].map(key=>({key,status:'مطلوب',type:'weekly',title:key}));
const sent=(status='مكتمل',review='')=>({submitted_at:'2026-10-01',items:Object.fromEntries(tasks.map(t=>[t.key,{title:t.title,type:'weekly',status,review_status:review}]))});
test('approved legacy items count executed and never remain required',()=>{
 const m=M.calculate(tasks,sent('مطلوب','approved'));
 assert.equal(m.executiveScore,100);assert.equal(m.approvedScore,100);assert.equal(m.remaining,0);assert.equal(m.submittedScore,100);
});
test('execution, submission and approval are separate',()=>{
 const s=sent();const m=M.calculate(tasks,s);
 assert.equal(m.executiveScore,100);assert.equal(m.submittedScore,100);assert.equal(m.approvedScore,0);
 const d={items:{weeklyPlan:{cloud_file_ids:['file-1']}}};
 const draft=M.calculate(tasks,null,d);assert.equal(draft.executiveScore,25);assert.equal(draft.remaining,3);assert.equal(draft.submittedScore,0);
});
test('empty week is zero, attendance and obsolete tasks do not inflate execution',()=>{
 assert.equal(M.calculate([],null).executiveScore,0);
 const s=sent();s.items.old={status:'مطلوب'};s.items.att_sunday={status:'حاضر',type:'daily'};
 assert.equal(M.calculate(tasks,s).total,4);assert.equal(M.calculate(tasks,s).executiveScore,100);
});
test('new replacement draft preserves approved decision and uses item timestamps',()=>{
 const s=sent('مطلوب','approved');s.items.weeklyPlan.updated_at='2026-10-02';
 const d={items:{weeklyPlan:{review_status:'',cloud_file_ids:['new'],updated_at:'2026-10-03'}}};
 assert.equal(M.calculate(tasks,s,d).approvedScore,100);
 s.items.weeklyPlan={status:'غير منفذ',review_status:'returned',updated_at:'2026-10-02'};
 assert.equal(M.calculate(tasks,s,{items:{weeklyPlan:{cloud_file_ids:['new'],updated_at:'2026-10-03'}}}).executiveScore,100);
 assert.equal(M.calculate(tasks,s,{items:{weeklyPlan:{cloud_file_ids:['old'],updated_at:'2026-10-01'}}}).executiveScore,75);
});
test('stable extra IDs, legacy indices and filtered variable indices count once',()=>{
 const t=[...tasks,{key:'extra_task-A',legacyKey:'extra_0',title:'extra',type:'extra',status:'مطلوب'},{key:'var_7',title:'variable',type:'variable',status:'مطلوب'}];
 const s=sent();s.items.extra_0={title:'extra',type:'extra',status:'مكتمل'};s.items.extra_taskA={title:'extra',type:'extra',status:'مكتمل',migrated_from_key:'extra_0'};s.items.var_0={title:'variable',type:'variable',status:'مكتمل'};
 const m=M.calculate(t,s);assert.equal(m.total,6);assert.equal(m.remaining,0);
});
test('legacy user identity uses unique email, never name or ambiguous emails',()=>{
 const sub={teacher_id:'old',teacher_email:'Teacher@example.com',items:{}};
 assert.equal(M.resolve({old:sub},{user_id:'new',email:'teacher@example.com'}),sub);
 assert.equal(M.resolve({old:sub},{user_id:'new',name:'same'}),null);
 assert.equal(M.resolve({a:sub,b:{...sub}},{user_id:'new',email:'teacher@example.com'}),null);
});
const html=fs.readFileSync(new URL('../deputy_weekly_teacher_followup.html',import.meta.url),'utf8');
function fn(name){const pattern=new RegExp('^ +(?:async )?function '+name+'\\(','m');const start=html.search(pattern);assert.ok(start>=0,name);const rest=html.slice(start);const end=rest.slice(1).search(/\n +(?:async )?function /);return end<0?rest:rest.slice(0,end+1);}
test('actual reviewer functions retain cloud submissions through analytics and cache compaction',()=>{
 const w={id:'w1',teacherStatuses:{},teacherSubmissions:{t:sent('مطلوب','approved')}};
 const ctx={WeeklyExecutionMetrics:M,week:w,t:{user_id:'t'},MANDATORY_WEEKLY_TASKS:tasks.map(t=>({key:t.key,title:t.title})),blankTeacherStatus:()=>({}),ensureWeekTeacherStatuses:()=>{},localStorage:{getItem:()=>JSON.stringify([{id:'w1'}])}};
 vm.createContext(ctx);vm.runInContext(['periodTestApplies','mandatoryItemsForTeacher','executiveItems','teacherExecutionMetrics','executiveScore','syncC1LiveData','c1MissingExec'].map(fn).join('\n'),ctx);
 assert.equal(vm.runInContext('executiveScore(week,t)',ctx),100);
 vm.runInContext('syncC1LiveData()',ctx);
 assert.equal(vm.runInContext('executiveScore(week,t)',ctx),100);assert.equal(vm.runInContext('c1MissingExec(week,t)',ctx),0);
});
test('actual cloud merge rejects other schools/reviewers and older response',()=>{
 const w={id:'w1',teacherSubmissions:{}};
 const ctx={weeks:[w],weekIdAliases:{oldWeek:'w1'},schoolId:()=> 'school-a',currentReviewerIdentity:()=>({id:'reviewer-a'}),weekCanonicalKey:()=> 'week1'};
 vm.createContext(ctx);vm.runInContext(fn('submissionBelongsToCurrentReviewer')+'\n'+fn('mergeCloudSubmissionPayload'),ctx);
 const p={school_id:'school-a',week_id:'oldWeek',teacher_id:'t',reviewer_id:'reviewer-a',updated_at:'2026-10-03',...sent('مطلوب','approved')};ctx.p=p;
 assert.equal(vm.runInContext('mergeCloudSubmissionPayload(p)',ctx),true);assert.equal(w.teacherSubmissions.t.items.weeklyPlan.review_status,'approved');
 ctx.p={...p,school_id:'school-b'};assert.equal(vm.runInContext('mergeCloudSubmissionPayload(p)',ctx),false);
 ctx.p={...p,reviewer_id:'reviewer-b'};assert.equal(vm.runInContext('mergeCloudSubmissionPayload(p)',ctx),false);
 ctx.p={...p,updated_at:'2026-10-01',items:{weeklyPlan:{status:'مطلوب'}}};vm.runInContext('mergeCloudSubmissionPayload(p)',ctx);
 assert.equal(w.teacherSubmissions.t.items.weeklyPlan.review_status,'approved');
});
test('historical archive projection corrects counts without changing saved snapshot',()=>{
 const a={week_id:'w1',teachers:[{user_id:'t',score:0,discipline:100,missing_execution:4,classification:'يحتاج متابعة'}],metrics:{executiveAvg:0},teacherSubmissions:{t:sent('مطلوب','approved')}};
 const before=JSON.stringify(a),ctx={WeeklyExecutionMetrics:M,weeks:[],weekIdAliases:{},avg:v=>Math.round(v.reduce((a,b)=>a+b,0)/(v.length||1))};
 vm.createContext(ctx);vm.runInContext(fn('c1TeacherState')+'\n'+fn('c4ArchiveProjection'),ctx);ctx.a=a;
 const p=vm.runInContext('c4ArchiveProjection(a)',ctx);
 assert.equal(p.metrics.executiveAvg,100);assert.equal(p.teachers[0].missing_execution,0);assert.equal(p.teachers[0].classification,'ممتاز');assert.equal(JSON.stringify(a),before);
});

test('submitted extra assignments survive a compacted plan without task definitions',()=>{
 const s=sent();s.items.extra_known={status:'مكتمل',review_status:'approved',type:'extra'};s.items.extra_pending={status:'مطلوب',type:'extra'};
 const m=M.calculate(tasks,s);assert.equal(m.total,6);assert.equal(m.executed,5);assert.equal(m.remaining,1);
});
