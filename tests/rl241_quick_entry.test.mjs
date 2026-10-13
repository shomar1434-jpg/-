import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
for(const name of ['teacher_comprehensive_record.html','kindergarten_teacher_comprehensive_record.html']){
 const html=fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);const source=scripts.find(s=>s.includes('function followUpApp()'));
 const ctx=vm.createContext({console,setTimeout,clearTimeout,document:{addEventListener(){}},window:{}});vm.runInContext(source,ctx);const app=vm.runInContext('followUpApp()',ctx);
 app.classes=[{id:'target',students:[{id:'s1',records:{1:{0:{attendance:true,booksTools:false}}}},{id:'s2',records:{2:{1:{behavior:false}}}}]},{id:'other',students:[{id:'outside',records:{}}]}];app.currentClassId='target';app.selectedWeek=1;app.selectedDay=0;app.showNotification=()=>{};
 app.markAllOnSelectedDay('booksTools',true);app.markAllOnSelectedDay('behavior',true);
 assert.ok(app.classes[0].students.every(s=>s.records[1][0].booksTools&&s.records[1][0].behavior));assert.equal(app.classes[0].students[0].records[1][0].attendance,true);assert.equal(app.classes[0].students[1].records[2][1].behavior,false);assert.equal(Object.keys(app.classes[1].students[0].records).length,0);
 app.toggleRecordValue('s2',1,0,'behavior');assert.equal(app.classes[0].students[1].records[1][0].behavior,false);assert.equal(app.classes[0].students[0].records[1][0].behavior,true);
 assert.match(html,/@click="markAllOnSelectedDay\('booksTools', true\)"/);assert.match(html,/@click="markAllOnSelectedDay\('behavior', true\)"/);assert.ok(html.includes("meta.color + ' hover:brightness-95'"));
}
console.log('RL241 quick entry: both variants mark books/tools and behavior independently; other classes/weeks and individual exceptions preserved.');
