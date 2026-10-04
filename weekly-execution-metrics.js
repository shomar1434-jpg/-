/* One accounting rule for teacher, reviewer, reports and weekly analytics. */
(function(root){
  'use strict';
  const completed=new Set(['تم التنفيذ','مكتمل','مكلف وتم التنفيذ','منجز','تم']);
  const stamp=row=>Date.parse(row?.updated_at||row?.cloud_synced_at||'')||0;
  const evidence=row=>!!(row&&(Array.isArray(row.cloud_file_ids)&&row.cloud_file_ids.some(Boolean)||String(row.evidence_value||'').trim()));
  function calculate(tasks,submission,draft){
    const sent=submission?.items||{},saved=draft?.items||{},seen=new Set();
    const replaced=new Set(Object.values(sent).map(r=>r?.migrated_from_key).filter(Boolean));
    const rows=(tasks||[]).filter(t=>t&&t.type!=='daily').map(task=>{
      let key=String(task.key),row=sent[key];
      // Old variable indices were scoped differently in teacher and reviewer pages.
      if(row&&task.type==='variable'&&row.title&&task.title&&row.title!==task.title)row=null;
      if(!row&&task.legacyKey) {row=sent[task.legacyKey];if(row)key=task.legacyKey;}
      if(!row&&task.title&&['variable','extra'].includes(task.type)){
        const matches=Object.entries(sent).filter(([k,v])=>!seen.has(k)&&v?.title===task.title&&v?.type===task.type);
        if(matches.length===1){key=matches[0][0];row=matches[0][1];}
      }
      seen.add(key);if(task.legacyKey)seen.add(task.legacyKey);
      const dr=saved[key]||saved[task.key];
      if(dr&&row?.review_status!=='approved'&&(!row||stamp(dr)>stamp(row)))row={...row,...dr};
      return {...task,...row,_submitted:!!(submission?.submitted_at&&sent[key])};
    });
    // Historical recovered weeks may have only the authoritative submission.
    for(const [key,row] of Object.entries(sent)){
      if((tasks||[]).length&&!/^(var_|extra_)/.test(key)&&key!=='periodTest')continue;
      if(replaced.has(key)||seen.has(key)||row?.type==='daily'||/^(att_|lin_)/.test(key))continue;
      if(row?.migrated_from_key&&seen.has(row.migrated_from_key))continue;
      rows.push({...row,_submitted:!!submission?.submitted_at});seen.add(key);
    }
    const executed=rows.filter(r=>r?.review_status==='approved'||evidence(r)||completed.has(String(r?.status||'').trim())).length;
    const approved=rows.filter(r=>r?.review_status==='approved').length;
    const submitted=rows.filter(r=>r._submitted).length;
    const total=rows.length,pct=n=>total?Math.round(n*100/total):0;
    return {rows,total,executed,remaining:Math.max(0,total-executed),approved,submitted,executiveScore:pct(executed),approvedScore:pct(approved),submittedScore:pct(submitted)};
  }
  function resolve(records,teacher){
    const id=String(teacher?.user_id||''),direct=records?.[id];if(direct)return direct;
    const rows=Object.values(records||{}),byId=rows.filter(r=>String(r?.teacher_id||'')===id);
    if(byId.length===1)return byId[0];
    const email=String(teacher?.email||'').trim().toLowerCase();
    const matches=email?rows.filter(r=>String(r?.teacher_email||'').trim().toLowerCase()===email):[];
    return matches.length===1?matches[0]:null; // Never match by display name.
  }
  root.WeeklyExecutionMetrics={calculate,resolve};
})(typeof window==='undefined'?globalThis:window);
