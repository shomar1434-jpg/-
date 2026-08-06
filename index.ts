import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    if (action === 'health') return json({ ok: true, service: 'platform-core', requestId, schoolId: session.school_id, userId: session.user_id });

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
      return json({ modules: modules.data || [], recordTypes: records.data || [], assignments: assignments.data || [], dashboard: dashboard.data || {}, notifications: notifications.data || [] });
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
      return json({ assignments: data || [] });
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
      let resolvedRecords: any[] = records.data || [];
      if (!resolvedRecords.length && Array.isArray(task?.metadata?.delegatedRecords)) {
        resolvedRecords = task.metadata.delegatedRecords.filter((r: any) => r?.moduleKey && r?.recordType).map((r: any) => ({
          task_id: task.id, module_key: r.moduleKey, record_type: r.recordType, record_id: null,
          relation_type: 'delegated_record', label: r.label || null, route_url: r.routeUrl || null, synthesized: true
        }));
      }
      if (!resolvedRecords.length && task?.module_key) {
        resolvedRecords = [{ task_id: task.id, module_key: task.module_key, record_type: task.record_type || null,
          record_id: task.record_id || null, relation_type: 'execution_source', label: task.record_key || task.title,
          route_url: task?.metadata?.routeUrl || null, synthesized: true }];
      }
      return json({ task, grants: grants.data || [], records: resolvedRecords, updates: updates.data || [], evidence: evidence.data || [], events: events.data || [], reviews: reviews.data || [] });
    }

    if (action === 'record-event') {
      const moduleKey = safeKey(body.moduleKey);
      const recordType = safeKey(body.recordType, 'record');
      const eventType = safeKey(body.eventType, 'record_updated');
      const taskId = body.taskId || null;
      if (taskId) {
        const task = await readTask(String(taskId));
        if (!task || !canAccessTask(task)) return json({ error: 'لا توجد صلاحية على التكليف المرتبط' }, 403);
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
        event_data: body.data || {}
      }).select('*').single();
      if (eventError) throw eventError;

      // التنفيذ داخل السجل هو شاهد داخلي ويحدّث حالة التكليف ونسبة الإنجاز تلقائيًا.
      if (taskId) {
        const progressByEvent: Record<string, number> = { record_opened: 20, record_created: 60, record_updated: 60, record_completed: 80 };
        const targetProgress = progressByEvent[eventType];
        if (targetProgress != null) {
          const task = await readTask(String(taskId));
          const nextProgress = Math.max(Number(task?.progress_percent || 0), targetProgress);
          const nextStatus = ['active','transferred','returned'].includes(String(task?.status || '')) ? 'in_progress' : task?.status;
          await sb.from('central_tasks').update({ progress_percent: nextProgress, status: nextStatus, updated_at: new Date().toISOString() }).eq('id', taskId).eq('school_id', session.school_id);
          await sb.from('central_task_updates').insert({ school_id: session.school_id, task_id: taskId, user_id: session.user_id, update_type: 'execution', title: body.data?.title || 'تنفيذ داخل السجل', notes: body.data?.notes || 'تم توثيق نشاط تنفيذي داخل السجل المرتبط بالتكليف.', progress_percent: nextProgress, status: 'draft' });
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

    if (action === 'dashboard') {
      const { data: core, error: coreError } = await sb.from('vw_platform_core_dashboard').select('*').eq('school_id', session.school_id).maybeSingle();
      if (coreError) throw coreError;
      const { data: indicators, error: indicatorsError } = await sb.from('platform_indicator_values').select('*').eq('school_id', session.school_id).order('measured_at', { ascending: false }).limit(200);
      if (indicatorsError) throw indicatorsError;
      const visible = isOwner ? (indicators || []) : (indicators || []).filter((x: any) => x.module_key === role || x.created_by === session.user_id);
      return json({ summary: core || {}, indicators: visible });
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
