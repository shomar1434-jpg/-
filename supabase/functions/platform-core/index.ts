import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-platform-session, x-client-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
  .map((x) => x.toString(16).padStart(2, '0')).join('');
const safeKey = (v: unknown, fallback = 'general') => String(v || fallback).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || fallback;
const ownerRoles = new Set(['manager','owner','school_manager','principal','agent','deputy','deputy_admin','deputy_academic','deputy_students','مدير','مديرة','وكيل']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'إعدادات Platform Core غير مكتملة', code: 'CORE_ENV_MISSING' }, 500);

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = crypto.randomUUID();
  try {
    const raw = req.headers.get('x-platform-session') || '';
    if (!raw) return json({ error: 'جلسة المنصة مفقودة', code: 'SESSION_MISSING' }, 401);
    const now = new Date().toISOString();
    const hash = await sha256(raw);
    const { data: session, error: sessionError } = await sb.from('platform_sessions')
      .select('*').eq('session_token_hash', hash).eq('status', 'active').gt('expires_at', now).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return json({ error: 'انتهت جلسة المنصة', code: 'SESSION_EXPIRED' }, 401);
    await sb.from('platform_sessions').update({ last_seen_at: now }).eq('id', session.id);

    const role = String(session.role || '').toLowerCase();
    const isOwner = ownerRoles.has(role) || ownerRoles.has(String(session.role || ''));
    const action = new URL(req.url).searchParams.get('action') || 'bootstrap';
    const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}));

    const readTask = async (taskId: string) => {
      const { data, error } = await sb.from('central_tasks').select('*').eq('id', taskId).eq('school_id', session.school_id).is('deleted_at', null).maybeSingle();
      if (error) throw error;
      return data;
    };
    const canAccessTask = (task: any) => isOwner || String(task?.created_by || '') === String(session.user_id) || String(task?.assigned_to || '') === String(session.user_id) || (task?.assignee_email && String(task.assignee_email).toLowerCase() === String(session.user_email || '').toLowerCase());
    const visibleAssignment = (task: any) => !task?.metadata?.legacy_archived && !task?.metadata?.hidden_from_assignee;
    const executionStatuses = new Set(['active','in_progress','transferred','returned']);
    const stageByEvent: Record<string, number> = { record_opened: 20, record_created: 60, record_updated: 60, record_completed: 80 };
    const grantMatchesRecord = (g:any,moduleKey:string,recordType:string,recordId:any) => {
      if (!g || g.status !== 'active' || !g.can_view) return false;
      const ts=Date.now(),start=g.starts_at?Date.parse(g.starts_at):0,end=g.expires_at?Date.parse(g.expires_at):Infinity;
      if (Number.isFinite(start) && start>ts) return false; if (Number.isFinite(end) && end<ts) return false;
      if (String(g.module_key||'')!==String(moduleKey||'')) return false;
      if (String(g.record_type||'')!==String(recordType||'')) return false;
      if (String(g.record_id||'')!==String(recordId||'')) return false;
      return true;
    };
    const currentAssignee = (task:any) => String(task?.assigned_to||'')===String(session.user_id||'') || (!!task?.assignee_email && String(task.assignee_email).toLowerCase()===String(session.user_email||'').toLowerCase());

    // Canonical delegated records are derived from the task metadata created by the owner.
    // Existing links are accepted only when they still resolve to an active registry entry.
    const canonicalTaskRecords = async (task:any, existingLinks:any[] = []) => {
      const metadataRows = Array.isArray(task?.metadata?.delegatedRecords)
        ? task.metadata.delegatedRecords.filter((r:any)=>r?.moduleKey && r?.recordType).map((r:any)=>({
            task_id: task.id,
            module_key: safeKey(r.moduleKey),
            record_type: String(r.recordType),
            record_id: r.recordId || null,
            relation_type: 'delegated_record',
            label: r.label || null,
            route_url: r.routeUrl || null,
            canonical_source: 'metadata'
          }))
        : [];

      let candidates:any[] = metadataRows.length ? metadataRows : [];
      // Repair older group assignments that stored only a generic `record` link.
      if (!candidates.length && String(task?.metadata?.delegationScope||'') === 'record_group' && task?.metadata?.recordGroupKey) {
        let q = sb.from('platform_record_types').select('module_key,record_type,display_name,route_url,record_group_key,owner_section,is_active')
          .eq('record_group_key', String(task.metadata.recordGroupKey)).eq('is_active', true);
        if (task?.metadata?.ownerSection) q = q.eq('owner_section', String(task.metadata.ownerSection));
        const { data: groupRows, error: groupErr } = await q;
        if (groupErr) throw groupErr;
        candidates = (groupRows || []).map((r:any)=>({task_id:task.id,module_key:r.module_key,record_type:r.record_type,record_id:null,relation_type:'delegated_record',label:r.display_name,route_url:r.route_url,canonical_source:'registry_group'}));
      }
      if (!candidates.length) candidates = (existingLinks || []).filter((r:any)=>r?.module_key && r?.record_type && String(r.record_type)!=='record');
      if (!candidates.length && task?.module_key && task?.record_type && String(task.record_type)!=='record') candidates.push({
        task_id: task.id,
        module_key: safeKey(task.module_key),
        record_type: String(task.record_type),
        record_id: task.record_id || null,
        relation_type: 'execution_source',
        label: task.record_key || task.title || null,
        route_url: task?.metadata?.routeUrl || null,
        canonical_source: 'task'
      });

      const unique = new Map<string,any>();
      for (const r of candidates) {
        const k=[safeKey(r.module_key),String(r.record_type||''),String(r.record_id||'')].join('|');
        if(!unique.has(k)) unique.set(k,{...r,module_key:safeKey(r.module_key),record_type:String(r.record_type)});
      }
      const out:any[]=[];
      for(const r of unique.values()){
        const {data:reg,error:regErr}=await sb.from('platform_record_types')
          .select('module_key,record_type,display_name,route_url,is_active')
          .eq('module_key',r.module_key).eq('record_type',r.record_type).eq('is_active',true).maybeSingle();
        if(regErr) throw regErr;
        if(!reg) continue;
        out.push({...r,label:r.label||reg.display_name||r.record_type,route_url:r.route_url||reg.route_url||null});
      }
      return out;
    };

    const ensureExactTaskAccess = async (task:any, canonicalRecords:any[], existingLinks:any[] = [], existingGrants:any[] = []) => {
      if (!executionStatuses.has(String(task?.status||'')) || (!task?.assigned_to && !task?.assignee_email)) return {links:existingLinks||[],grants:existingGrants||[]};
      const links=[...(existingLinks||[])], grants=[...(existingGrants||[])];
      for(const r of canonicalRecords||[]){
        const exactLink=links.find((l:any)=>String(l.module_key||'')===String(r.module_key||'')&&String(l.record_type||'')===String(r.record_type||'')&&String(l.record_id||'')===String(r.record_id||''));
        if(!exactLink){
          const row={school_id:task.school_id,task_id:task.id,module_key:r.module_key,record_type:r.record_type,record_id:r.record_id||null,relation_type:r.relation_type||'delegated_record',created_by:task.created_by};
          const {data:created,error}=await sb.from('task_record_links').insert(row).select('*').single();
          if(error) throw error; if(created) links.push(created);
        }
        const exactGrant=grants.find((g:any)=>String(g.status||'')==='active'&&((task.assigned_to&&String(g.user_id||'')===String(task.assigned_to||''))||(!task.assigned_to&&task.assignee_email&&String(g.user_email||'').toLowerCase()===String(task.assignee_email||'').toLowerCase()))&&String(g.module_key||'')===String(r.module_key||'')&&String(g.record_type||'')===String(r.record_type||'')&&String(g.record_id||'')===String(r.record_id||''));
        if(!exactGrant){
          const grow={school_id:task.school_id,task_id:task.id,user_id:task.assigned_to,user_email:task.assignee_email||null,module_key:r.module_key,record_type:r.record_type,record_id:r.record_id||null,permission_scope:'record',can_view:true,can_create:true,can_update:true,can_upload:true,can_submit:true,can_approve:false,can_delete:false,starts_at:task.start_date||task.created_at||now,expires_at:null,status:'active',granted_by:task.created_by};
          const {data:created,error}=await sb.from('task_access_grants').insert(grow).select('*').single();
          if(error) throw error; if(created) grants.push(created);
        }
      }
      return {links,grants};
    };

    if (action === 'health') return json({ ok: true, service: 'platform-core', version:'2.3.0-registry-group-repair', requestId, schoolId: session.school_id, userId: session.user_id });

    if (action === 'bootstrap') {
      const [modules, records, assignments, dashboard, notifications] = await Promise.all([
        sb.from('platform_modules').select('*').eq('is_active', true).order('display_name'),
        sb.from('platform_record_types').select('*').eq('is_active', true).order('display_name'),
        sb.from('central_tasks').select('id,title,description,module_key,record_type,record_id,assignment_type,status,priority,progress_percent,start_date,due_date,assignee_role,created_at,updated_at')
          .eq('school_id', session.school_id).or(`assigned_to.eq.${session.user_id},assignee_email.eq.${String(session.user_email || '').toLowerCase()}`).is('deleted_at', null)
          .in('status', ['active','in_progress','transferred','pending_approval','returned']).order('updated_at', { ascending: false }),
        sb.from('vw_platform_core_dashboard').select('*').eq('school_id', session.school_id).maybeSingle(),
        sb.from('central_task_notifications').select('*').eq('school_id', session.school_id).or(`recipient_user_id.eq.${session.user_id},recipient_email.eq.${String(session.user_email || '').toLowerCase()}`).is('read_at', null).order('created_at', { ascending: false }).limit(20)
      ]);
      for (const result of [modules, records, assignments, dashboard, notifications]) if (result.error) throw result.error;
      return json({ modules: modules.data || [], recordTypes: records.data || [], assignments: (assignments.data || []).filter(visibleAssignment), dashboard: dashboard.data || {}, notifications: notifications.data || [] });
    }

    if (action === 'registry') {
      const moduleKey = safeKey(body.moduleKey);
      const recordType = safeKey(body.recordType, 'record');
      const { data, error } = await sb.from('platform_record_types').select('*,platform_modules(*)').eq('module_key', moduleKey).eq('record_type', recordType).eq('is_active', true).maybeSingle();
      if (error) throw error;
      return json({ recordType: data });
    }

    if (action === 'my-assignments') {
      const { data, error } = await sb.from('central_tasks').select('*,task_access_grants(*),task_record_links(*)')
        .eq('school_id', session.school_id)
        .or(`assigned_to.eq.${session.user_id},assignee_email.eq.${String(session.user_email || '').toLowerCase()}`)
        .is('deleted_at', null).in('status', ['active','in_progress','transferred','pending_approval','returned'])
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return json({ assignments: (data || []).filter(visibleAssignment) });
    }

    if (action === 'workspace') {
      const task = await readTask(String(body.taskId || ''));
      if (!task) return json({ error: 'التكليف غير موجود' }, 404);
      if (!canAccessTask(task)) return json({ error: 'لا توجد صلاحية لفتح مساحة التكليف' }, 403);
      const [grants, records, updates, evidence, events, reviews] = await Promise.all([
        sb.from('task_access_grants').select('*').eq('task_id', task.id).eq('status', 'active'),
        sb.from('task_record_links').select('*').eq('task_id', task.id),
        sb.from('central_task_updates').select('*').eq('task_id', task.id).order('created_at', { ascending: false }),
        sb.from('central_task_evidence').select('*,platform_files(*)').eq('task_id', task.id).eq('status', 'active').order('created_at', { ascending: false }),
        sb.from('central_task_events').select('*').eq('task_id', task.id).order('created_at', { ascending: false }),
        sb.from('central_task_reviews').select('*').eq('task_id', task.id).order('reviewed_at', { ascending: false })
      ]);
      for (const result of [grants, records, updates, evidence, events, reviews]) if (result.error) throw result.error;

      // Always resolve the workspace against the canonical registry. Metadata delegatedRecords takes precedence
      // over stale/generic legacy links so a deputy assignment can never fall back to manager/shared records.
      const resolvedRecords = await canonicalTaskRecords(task, records.data || []);
      if(!resolvedRecords.length) return json({ error:'لا توجد سجلات صحيحة مرتبطة بهذا التكليف في القاموس الموحد', code:'TASK_RECORDS_UNRESOLVED' },409);
      const healed = await ensureExactTaskAccess(task,resolvedRecords,records.data||[],grants.data||[]);
      const exactGrants=(healed.grants||[]).filter((g:any)=>resolvedRecords.some((r:any)=>String(g.module_key||'')===String(r.module_key||'')&&String(g.record_type||'')===String(r.record_type||'')&&String(g.record_id||'')===String(r.record_id||'')));
      return json({ task, grants: exactGrants, records: resolvedRecords, updates: updates.data || [], evidence: evidence.data || [], events: events.data || [], reviews: reviews.data || [] });
    }

    if (action === 'record-event') {
      const moduleKey = safeKey(body.moduleKey);
      const recordType = safeKey(body.recordType, 'record');
      const eventType = safeKey(body.eventType, 'record_updated');
      const taskId = body.taskId || null;
      let executionTask:any = null;
      if (taskId) {
        executionTask = await readTask(String(taskId));
        if (!executionTask || !canAccessTask(executionTask)) return json({ error: 'لا توجد صلاحية على التكليف المرتبط' }, 403);
        if (!currentAssignee(executionTask)) return json({ error: 'التكليف غير مسند إلى المستخدم الحالي' }, 403);
        if (!executionStatuses.has(String(executionTask.status||''))) return json({ error: 'التكليف غير متاح للتنفيذ حالياً' }, 409);
        const [{data:taskGrants},{data:taskLinks}] = await Promise.all([
          sb.from('task_access_grants').select('*').eq('task_id',executionTask.id).eq('status','active'),
          sb.from('task_record_links').select('module_key,record_type,record_id').eq('task_id',executionTask.id)
        ]);
        const linked=(taskLinks||[]).some((l:any)=>String(l.module_key||'')===String(moduleKey)&&String(l.record_type||'')===String(recordType)&&String(l.record_id||'')===String(body.recordId||''));
        const granted=(taskGrants||[]).some((g:any)=>grantMatchesRecord(g,moduleKey,recordType,body.recordId));
        if (!linked || !granted) return json({ error: 'السجل غير داخل نطاق التفويض الفعّال' }, 403);
      }
      const { data: event, error: eventError } = await sb.from('platform_record_events').insert({
        school_id: session.school_id,
        module_key: moduleKey,
        record_type: recordType,
        record_id: body.recordId || null,
        task_id: taskId,
        actor_id: session.user_id,
        execution_role: body.executionRole || session.role || null,
        event_type: eventType,
        event_data: { ...(body.data || {}), execution_source: taskId ? 'delegated_task' : String(body.data?.execution_source || 'direct_role') }
      }).select('*').single();
      if (eventError) throw eventError;

      // التنفيذ داخل السجل هو شاهد داخلي. النسبة تُحسب من جميع السجلات المرتبطة بالتكليف، لا من آخر حدث فقط.
      if (taskId) {
        const targetProgress = stageByEvent[eventType];
        if (targetProgress != null) {
          const [{ data: links }, { data: taskEvents }] = await Promise.all([
            sb.from('task_record_links').select('module_key,record_type,record_id').eq('task_id', taskId),
            sb.from('platform_record_events').select('module_key,record_type,record_id,event_type').eq('task_id', taskId)
          ]);
          const uniqueLinks:any[]=[]; const seen=new Set<string>();
          for(const l of links||[]){const k=[l.module_key,l.record_type,l.record_id||''].join('|');if(!seen.has(k)){seen.add(k);uniqueLinks.push(l)}}
          let computed=targetProgress;
          if(uniqueLinks.length){
            let total=0;
            for(const l of uniqueLinks){
              let stage=0;
              for(const ev of taskEvents||[]){
                const matches=String(ev.module_key||'')===String(l.module_key||'')&&String(ev.record_type||'')===String(l.record_type||'')&&String(ev.record_id||'')===String(l.record_id||'');
                if(matches)stage=Math.max(stage,stageByEvent[String(ev.event_type||'')]||0);
              }
              total+=stage;
            }
            computed=Math.round(total/uniqueLinks.length);
          }
          const task = executionTask || await readTask(String(taskId));
          const nextProgress = Math.max(Number(task?.progress_percent || 0), computed);
          const nextStatus = ['active','transferred','returned'].includes(String(task?.status || '')) ? 'in_progress' : task?.status;
          await sb.from('central_tasks').update({ progress_percent: nextProgress, status: nextStatus, updated_at: new Date().toISOString() }).eq('id', taskId).eq('school_id', session.school_id);
          await sb.from('central_task_updates').insert({ school_id: session.school_id, task_id: taskId, user_id: session.user_id, update_type: 'execution', title: body.data?.title || 'تنفيذ داخل السجل', notes: body.data?.notes || 'تم توثيق نشاط تنفيذي داخل السجل المرتبط بالتكليف.', progress_percent: nextProgress, status: 'draft', metadata: { module_key: moduleKey, record_type: recordType, record_id: body.recordId || null, record_event_id: event.id, internal_evidence: true } });
          await sb.from('central_task_events').insert({ school_id: session.school_id, task_id: taskId, event_type: 'record_execution_evidence', actor_id: session.user_id, event_note: `${moduleKey}/${recordType}: ${eventType}`, old_values: null, new_values: { record_event_id: event.id, record_id: body.recordId || null, internal_evidence: true, progress_percent: nextProgress, execution_role: session.role } });
        }
      }

      const { data: rules, error: rulesError } = await sb.from('platform_indicator_rules').select('*')
        .eq('source_module_key', moduleKey).eq('source_event_type', eventType).eq('is_active', true)
        .or(`source_record_type.is.null,source_record_type.eq.${recordType}`).order('priority');
      if (rulesError) throw rulesError;
      const actions: any[] = [];
      for (const rule of rules || []) {
        const config = rule.action_config || {};
        try {
          if (rule.action_type === 'indicator') {
            const path = String(config.value_path || 'value').split('.');
            let value: any = body.data || {};
            for (const part of path) value = value?.[part];
            const indicatorKey = String(config.indicator_key || '');
            if (!indicatorKey) continue;
            const row: any = {
              school_id: session.school_id,
              indicator_key: indicatorKey,
              module_key: String(config.target_module_key || moduleKey),
              record_type: recordType,
              record_id: body.recordId || null,
              task_id: taskId,
              source_event_id: event.id,
              created_by: session.user_id,
              metadata: { rule_key: rule.rule_key }
            };
            if (typeof value === 'number') row.numeric_value = value;
            else if (typeof value === 'string') row.text_value = value;
            else if (value != null) row.json_value = value;
            const { data: indicator, error } = await sb.from('platform_indicator_values').insert(row).select('*').single();
            if (error) throw error;
            actions.push({ type: 'indicator', data: indicator });
          } else if (rule.action_type === 'notification') {
            const recipient = config.recipient_user_id || null;
            const recipientEmail = config.recipient_email || null;
            const { data: notification, error } = await sb.from('central_task_notifications').insert({
              school_id: session.school_id,
              task_id: taskId,
              recipient_user_id: recipient,
              recipient_email: recipientEmail,
              notification_type: config.notification_type || 'core_event',
              title: config.title || rule.display_name,
              message: config.message || `حدث جديد في ${moduleKey}`
            }).select('*').single();
            if (error) throw error;
            actions.push({ type: 'notification', data: notification });
          }
          await sb.from('platform_decision_actions').insert({ school_id: session.school_id, source_event_id: event.id, rule_id: rule.id, action_type: rule.action_type, target_module_key: config.target_module_key || null, task_id: taskId, status: 'executed', payload: config, executed_at: new Date().toISOString() });
        } catch (error) {
          await sb.from('platform_decision_actions').insert({ school_id: session.school_id, source_event_id: event.id, rule_id: rule.id, action_type: rule.action_type, target_module_key: config.target_module_key || null, task_id: taskId, status: 'failed', payload: config, error_message: error instanceof Error ? error.message : String(error) });
        }
      }
      await sb.from('platform_record_events').update({ processed_at: new Date().toISOString(), processing_result: { matchedRules: (rules || []).length, actions: actions.length } }).eq('id', event.id);
      return json({ event, matchedRules: (rules || []).length, actions }, 201);
    }


    // ===== Semester plans: role-isolated weekly plans + manager approval =====
    const semesterPlanRoleMap:Record<string,string> = {
      student_advisor:'التوجيه الطلابي', activity_leader:'النشاط الطلابي',
      kindergarten_teacher:'رياض الأطفال', health_advisor:'التوجيه الصحي'
    };
    const normalizedSessionRole=String(session.role||'').toLowerCase();
    const semesterPlanTypeForRole=semesterPlanRoleMap[normalizedSessionRole]||'';
    const isSemesterPlanManager=/manager|principal|school_manager|مدير|مديرة/.test(normalizedSessionRole)||isOwner;

    if (action === 'semester-plan-list') {
      let q=sb.from('semester_plan_weeks').select('*').eq('school_id',session.school_id)
        .eq('academic_year',String(body.academicYear||'1448 هـ')).eq('semester',String(body.semester||'الفصل الدراسي الأول'))
        .order('plan_type').order('week_order');
      if(!isSemesterPlanManager){ if(!semesterPlanTypeForRole)return json({error:'الدور الحالي غير مخول بالخطة الفصلية'},403); q=q.eq('plan_type',semesterPlanTypeForRole).eq('owner_user_id',session.user_id); }
      else if(body.planType) q=q.eq('plan_type',String(body.planType));
      const {data,error}=await q;if(error)throw error;return json({rows:data||[],planType:semesterPlanTypeForRole,isManager:isSemesterPlanManager});
    }

    if (action === 'semester-plan-save-week') {
      if(!semesterPlanTypeForRole)return json({error:'لا يمكن تعديل هذه الخطة من الدور الحالي'},403);
      const w:any=body.week||{}; const weekKey=String(w.weekKey||w.id||'').trim(); if(!weekKey)return json({error:'معرف الأسبوع مفقود'},400);
      const academicYear=String(body.academicYear||'1448 هـ'), semester=String(body.semester||'الفصل الدراسي الأول');
      const existing=await sb.from('semester_plan_weeks').select('id,plan_status').eq('school_id',session.school_id).eq('plan_type',semesterPlanTypeForRole).eq('academic_year',academicYear).eq('semester',semester).eq('week_key',weekKey).maybeSingle();
      if(existing.error)throw existing.error; if(existing.data && !['draft','returned'].includes(String(existing.data.plan_status||'')))return json({error:'لا يمكن تعديل أسبوع بعد إرساله أو اعتماده إلا إذا أعاده المدير للتعديل'},409);
      const row:any={school_id:session.school_id,owner_user_id:session.user_id,owner_role:normalizedSessionRole,plan_type:semesterPlanTypeForRole,academic_year:academicYear,semester,week_key:weekKey,week_order:Number(w.weekOrder||0),title:String(w.title||''),dates:String(w.dates||''),behavior:String(w.behavior||''),event_name:w.event||null,is_vacation:!!w.isVacation,programs:Array.isArray(w.programs)?w.programs:[],notes:String(w.notes||''),plan_status:existing.data?.plan_status||'draft',updated_at:now};
      const {data,error}=await sb.from('semester_plan_weeks').upsert(row,{onConflict:'school_id,plan_type,academic_year,semester,week_key'}).select('*').single();if(error)throw error;return json({row});
    }

    if (action === 'semester-plan-submit-week') {
      if(!semesterPlanTypeForRole)return json({error:'الدور الحالي غير مخول'},403);
      const id=String(body.id||''); const {data,error}=await sb.from('semester_plan_weeks').update({plan_status:'pending_manager',plan_submitted_at:now,manager_note:null,updated_at:now}).eq('id',id).eq('school_id',session.school_id).eq('owner_user_id',session.user_id).eq('plan_type',semesterPlanTypeForRole).in('plan_status',['draft','returned']).select('*').maybeSingle();if(error)throw error;if(!data)return json({error:'تعذر إرسال الأسبوع للاعتماد'},409);return json({row:data});
    }

    if (action === 'semester-plan-manager-decision') {
      if(!isSemesterPlanManager)return json({error:'الاعتماد متاح لمدير المدرسة فقط'},403);
      const id=String(body.id||''), decision=String(body.decision||''), note=String(body.note||'');
      const patch:any= decision==='approve'?{plan_status:'approved',plan_approved_at:now,plan_approved_by:session.user_id,execution_status:'awaiting_evidence',manager_note:note,updated_at:now}:{plan_status:'returned',manager_note:note,plan_approved_at:null,plan_approved_by:null,updated_at:now};
      const {data,error}=await sb.from('semester_plan_weeks').update(patch).eq('id',id).eq('school_id',session.school_id).in('plan_status',['pending_manager','approved']).select('*').maybeSingle();if(error)throw error;if(!data)return json({error:'تعذر تحديث قرار الاعتماد'},409);return json({row:data});
    }

    if (action === 'semester-plan-submit-evidence') {
      if(!semesterPlanTypeForRole)return json({error:'الدور الحالي غير مخول'},403);
      const id=String(body.id||''), fileId=String(body.fileId||''); if(!fileId)return json({error:'ملف الشاهد مفقود'},400);
      const {data,error}=await sb.from('semester_plan_weeks').update({evidence_file_id:fileId,evidence_name:String(body.fileName||''),evidence_submitted_at:now,execution_status:'pending_manager',updated_at:now}).eq('id',id).eq('school_id',session.school_id).eq('owner_user_id',session.user_id).eq('plan_status','approved').select('*').maybeSingle();if(error)throw error;if(!data)return json({error:'يجب اعتماد خطة الأسبوع قبل رفع شاهد التنفيذ'},409);return json({row:data});
    }

    if (action === 'semester-plan-execution-decision') {
      if(!isSemesterPlanManager)return json({error:'اعتماد التنفيذ متاح للمدير فقط'},403);
      const id=String(body.id||''), decision=String(body.decision||''), note=String(body.note||'');
      const patch:any=decision==='approve'?{execution_status:'approved',execution_approved_at:now,execution_approved_by:session.user_id,manager_note:note,updated_at:now}:{execution_status:'awaiting_evidence',manager_note:note,updated_at:now};
      const {data,error}=await sb.from('semester_plan_weeks').update(patch).eq('id',id).eq('school_id',session.school_id).eq('plan_status','approved').select('*').maybeSingle();if(error)throw error;if(!data)return json({error:'تعذر اعتماد التنفيذ'},409);return json({row:data});
    }

    if (action === 'dashboard') {
      const filters:any = body.filters || {};
      const period = String(filters.period || 'month');
      const periodDays:any = { day:1, week:7, month:31, term:130, year:370 };
      const windowDays = Number(periodDays[period] || 31);
      const since = new Date(Date.now() - windowDays*24*60*60*1000).toISOString();
      const normalizeDashboardRole=(r:any)=>{const x=String(r||'').toLowerCase();if(/teacher|معلم|معلمة/.test(x))return 'teacher';if(/admin_employee|administrative|إداري|اداري|موظف|محضر|مصادر|سكرتير|كاتب|مدخل/.test(x))return 'admin';if(/agent|deputy|vice|wakil|وكيل|وكيلة/.test(x))return 'agent';if(/advisor|counsel|موجه|مرشد|إرشاد|ارشاد/.test(x))return 'advisor';if(/activity|رائد|نشاط/.test(x))return 'activity';if(/manager|owner|principal|مدير|مديرة/.test(x))return 'manager';if(/student|طالب|طالبة/.test(x))return 'student';return 'other'};
      const scopeRoles:any={all:['teacher','admin','agent','advisor','activity','manager','student','other'],teachers:['teacher'],admin:['admin'],students:['student','advisor']};
      const selectedRoles=scopeRoles[String(filters.scope||'all')]||scopeRoles.all;
      const focus=String(filters.focus||'all');
      const matchesFocus=(ev:any)=>{const mk=String(ev.module_key||'').toLowerCase();const rt=String(ev.record_type||'').toLowerCase();if(focus==='all')return true;if(focus==='tasks')return !!ev.task_id;if(focus==='followup')return /followup|deputy|wakil|teacher_followup/.test(mk+' '+rt);if(focus==='advising')return /advisor|counsel|student_followup|guidance/.test(mk+' '+rt);if(focus==='evaluation')return /evaluation|self_evaluation|external_evaluation|improvement|performance/.test(mk+' '+rt);return true};
      const [{ data: core, error: coreError }, { data: indicators, error: indicatorsError }, { data: activityEvents, error: activityError }] = await Promise.all([
        sb.from('vw_platform_core_dashboard').select('*').eq('school_id', session.school_id).maybeSingle(),
        sb.from('platform_indicator_values').select('*').eq('school_id', session.school_id).gte('measured_at', since).order('measured_at', { ascending: false }).limit(500),
        sb.from('platform_record_events').select('id,module_key,record_type,record_id,task_id,actor_id,execution_role,event_type,event_data,occurred_at').eq('school_id', session.school_id).gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(5000)
      ]);
      if (coreError) throw coreError; if (indicatorsError) throw indicatorsError; if (activityError) throw activityError;
      const visibleBase = isOwner ? (indicators || []) : (indicators || []).filter((x: any) => x.module_key === role || x.created_by === session.user_id);
      const visible = visibleBase.filter((x:any)=>focus==='all'||(focus==='evaluation'?/evaluation|improvement|performance/.test(String(x.module_key||'').toLowerCase()):true));
      const events = (activityEvents || []).filter((ev:any)=>selectedRoles.includes(normalizeDashboardRole(ev.execution_role)) && matchesFocus(ev));
      const stage:any = {record_opened:10,record_created:50,record_updated:60,record_saved:60,record_submitted:80,record_completed:100,performance_plan_saved:40,performance_plan_submitted:80,performance_execution_updated:60,performance_evaluation_saved:100};
      const byRecord = new Map<string, any>(); const actors = new Set<string>(); let direct=0,delegated=0,meaningful=0;
      for (const ev of events) {
        actors.add(String(ev.actor_id||'')); if (ev.task_id) delegated++; else direct++;
        if (String(ev.event_type||'') !== 'record_opened') meaningful++;
        const key=[ev.module_key,ev.record_type,ev.record_id||''].join('|');
        const data:any=ev.event_data||{}; const explicit=Number(data.progress);
        const score=Number.isFinite(explicit)?Math.max(0,Math.min(100,explicit)):(stage[String(ev.event_type||'')]||0);
        const prev=byRecord.get(key)||{score:0,module_key:ev.module_key,record_type:ev.record_type,record_id:ev.record_id,last_at:ev.occurred_at};
        if(score>prev.score)prev.score=score; if(String(ev.occurred_at||'')>String(prev.last_at||''))prev.last_at=ev.occurred_at; byRecord.set(key,prev);
      }
      const records=[...byRecord.values()];
      const operational = records.length ? Math.round(records.reduce((a:any,r:any)=>a+Number(r.score||0),0)/records.length) : 0;
      const moduleMap:any={}; for(const r of records){const k=String(r.module_key||'general');const x=moduleMap[k]||(moduleMap[k]={module_key:k,records:0,progress_total:0});x.records++;x.progress_total+=Number(r.score||0)}
      const modules=Object.values(moduleMap).map((x:any)=>({module_key:x.module_key,records:x.records,average_progress:x.records?Math.round(x.progress_total/x.records):0})).sort((a:any,b:any)=>b.records-a.records);
      const activity={window_days:windowDays,period,scope:String(filters.scope||'all'),focus,total_events:events.length,meaningful_events:meaningful,direct_events:direct,delegated_events:delegated,active_users:actors.size,unique_records:records.length,operational_execution_progress:operational,last_activity_at:events[0]?.occurred_at||null,modules};
      return json({ summary: core || {}, activity, indicators: visible, filters:{period,scope:String(filters.scope||'all'),focus,viewmode:String(filters.viewmode||'exec'),sensitivity:String(filters.sensitivity||'normal')} });
    }

    if (action === 'mark-notification-read') {
      const id = String(body.id || '');
      const { error } = await sb.from('central_task_notifications').update({ read_at: new Date().toISOString() })
        .eq('id', id).eq('school_id', session.school_id)
        .or(`recipient_user_id.eq.${session.user_id},recipient_email.eq.${String(session.user_email || '').toLowerCase()}`);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'عملية غير مدعومة', code: 'CORE_ACTION_UNSUPPORTED' }, 400);
  } catch (error) {
    console.error('[platform-core]', requestId, error);
    return json({ error: error instanceof Error ? error.message : String(error), code: 'CORE_FATAL_ERROR', requestId }, 500);
  }
});
