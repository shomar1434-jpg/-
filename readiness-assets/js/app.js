/**
 * محرك منصة جاهزية المدرسة — الإصدار 3.0
 * ═══════════════════════════════════════════
 * ١. السجل الزمني + عداد SLA
 * ٢. المتابعة الذكية (7 أنواع تنبيه)
 * ٣. التقارير الورقية الاحترافية (7 تقارير)
 * ═══════════════════════════════════════════
 */
(function (W, D) {
    'use strict';

    /* ─────────────────────────────────────────────────────────────
       ثوابت
    ───────────────────────────────────────────────────────────── */
    const HISTORY_KEY = 'school_readiness_history_v1';
    const SLA = { critical: 7, normal: 14 };

    /* ═══════════════════════════════════════════════════════════
       ١. السجل الزمني (Timeline / Snapshot Engine)
    ═══════════════════════════════════════════════════════════ */

    function takeSnapshotIfNeeded() {
        const today = new Date().toISOString().slice(0, 10);
        const hist = getProgressHistory();
        if (hist.length && hist[hist.length - 1].date === today) return;
        hist.push(_buildSnapshot(today));
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(-90))); } catch (_) {}
    }

    function _buildSnapshot(date) {
        if (!W.SECTIONS || !W.state) return { date, overall: 0 };
        let done = 0, notDone = 0, blocked = 0, total = 0;
        const bySection = {};
        W.SECTIONS.forEach(s => {
            let sd = 0, st = 0;
            s.tasks.forEach((_, i) => {
                const d = W.state.tasks[s.id]?.[i];
                if (!d || d.status === 'na') return;
                st++; total++;
                const ok = d.execution?.result === 'done';
                if (ok) { done++; sd++; }
                else if (d.execution?.result === 'not_done') notDone++;
                if (d.status === 'blocked') blocked++;
            });
            bySection[s.id] = st > 0 ? Math.round(sd / st * 100) : 0;
        });
        return { date, overall: total > 0 ? Math.round(done / total * 100) : 0, bySection, done, notDone, blocked };
    }

    function getProgressHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) { return []; }
    }

    function computeSLAStatus(d, priority) {
        if (!d) return null;
        if (['done'].includes(d.execution?.result) || ['verified', 'approved', 'na'].includes(d.status)) return null;
        const ref = d.start || d.execution?.date;
        if (!ref) return null;
        const days = Math.floor((Date.now() - new Date(ref)) / 86400000);
        if (days <= 0) return null;
        const limit = SLA[priority] || SLA.normal;
        return { days, limit, exceeded: days > limit, critical: days > limit * 1.5 };
    }

    /* ═══════════════════════════════════════════════════════════
       ٢. محرك المتابعة الذكية (Smart Alerts)
    ═══════════════════════════════════════════════════════════ */

    function smartAlerts() {
        if (!W.SECTIONS || !W.state) return [];
        const alerts = [];
        const today = new Date().toISOString().slice(0, 10);
        const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
        const hist = getProgressHistory();
        const lastSnap = hist.length >= 2 ? hist[hist.length - 2] : null;

        W.SECTIONS.forEach(s => {
            s.tasks.forEach((title, i) => {
                const d = W.state.tasks[s.id]?.[i];
                if (!d || d.status === 'na') return;
                const isDone = d.execution?.result === 'done';

                /* 🔴 بند حرج متأخر */
                if (d.priority === 'critical' && !isDone && d.due && d.due <= today) {
                    const late = Math.ceil((new Date(today) - new Date(d.due)) / 86400000);
                    alerts.push({ level: 'critical', icon: '🔴', type: 'بند حرج متأخر', task: title, section: s.title, sectionId: s.id, taskIndex: i, responsible: d.responsible || 'غير مسند', detail: `الموعد كان ${d.due} — تأخر ${late} يوم` });
                }

                /* 🟡 SLA متجاوز */
                const sla = computeSLAStatus(d, d.priority);
                if (sla?.exceeded) alerts.push({ level: 'warning', icon: '🟡', type: `مهمة مفتوحة منذ ${sla.days} يوم`, task: title, section: s.title, sectionId: s.id, taskIndex: i, responsible: d.responsible || 'غير مسند', detail: `تجاوزت الحد (${sla.limit} يوم للمهام ${d.priority === 'critical' ? 'الحرجة' : 'العادية'})` });

                /* 🟡 استحقاق قريب بلا مسؤول */
                if (!isDone && d.due && d.due >= today && d.due <= in3 && !d.responsible)
                    alerts.push({ level: 'warning', icon: '🟡', type: 'استحقاق قريب بلا مسؤول', task: title, section: s.title, sectionId: s.id, taskIndex: i, responsible: 'غير مسند', detail: `الموعد ${d.due} — لا يوجد مسؤول تنفيذ` });
            });

            /* 🟡 مجال تراجع */
            if (lastSnap) {
                const cur = typeof W.sectionScore === 'function' ? W.sectionScore(s) : 0;
                const prev = lastSnap.bySection?.[s.id] ?? cur;
                if (prev - cur >= 5) alerts.push({ level: 'warning', icon: '🟡', type: 'مجال تراجع في الإنجاز', task: s.title, section: s.title, sectionId: s.id, taskIndex: null, responsible: '—', detail: `تراجع من ${prev}% إلى ${cur}% (انخفاض ${prev - cur}%)` });
            }

            /* 🔵 مجال يقترب من الاكتمال */
            const score = typeof W.sectionScore === 'function' ? W.sectionScore(s) : 0;
            if (score >= 85 && score < 100) alerts.push({ level: 'info', icon: '🔵', type: 'مجال يقترب من الاكتمال', task: s.title, section: s.title, sectionId: s.id, taskIndex: null, responsible: '—', detail: `${score}% — يحتاج إغلاق ${Math.round((100 - score) / 100 * s.tasks.length)} مهمة للوصول لـ 100%` });
        });

        /* 🔵 مراحل العودة 80%+ */
        if (typeof W.stageExecutionSummary === 'function' && W.PHASES) {
            W.PHASES.forEach((phase, i) => {
                const st = W.stageExecutionSummary(i);
                if (st.percent >= 80 && st.percent < 100) alerts.push({ level: 'info', icon: '🔵', type: 'مرحلة عودة تقترب من الاكتمال', task: phase, section: phase, sectionId: null, taskIndex: null, responsible: '—', detail: `${st.percent}% — ${st.total - st.done} مهمة متبقية` });
            });
        }

        const order = { critical: 0, warning: 1, info: 2 };
        return alerts.sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));
    }

    /* ─── عرض لوحة المتابعة الذكية ─── */

    function renderMonitoring() {
        const host = D.getElementById('monitoringContent');
        if (!host) return;
        const alerts = smartAlerts();
        const critical = alerts.filter(a => a.level === 'critical');
        const warnings  = alerts.filter(a => a.level === 'warning');
        const infos     = alerts.filter(a => a.level === 'info');
        let open7 = 0, open14 = 0, unassigned = 0;
        if (W.SECTIONS && W.state) {
            W.SECTIONS.forEach(s => s.tasks.forEach((_, i) => {
                const d = W.state.tasks[s.id]?.[i];
                if (!d || d.status === 'na') return;
                const ok = d.execution?.result === 'done';
                if (!ok) {
                    const sla = computeSLAStatus(d, d.priority);
                    if (sla?.days >= 14) open14++; else if (sla?.days >= 7) open7++;
                    if (!d.responsible) unassigned++;
                }
            }));
        }
        host.innerHTML = `
        <div class="mon-header">
            <div class="mon-stat mon-stat-red"><div class="mon-num">${critical.length}</div><div class="mon-lbl">🔴 حرجة</div></div>
            <div class="mon-stat mon-stat-yel"><div class="mon-num">${warnings.length}</div><div class="mon-lbl">🟡 تحذيرات</div></div>
            <div class="mon-stat mon-stat-blu"><div class="mon-num">${infos.length}</div><div class="mon-lbl">🔵 إشعارات</div></div>
            <div class="mon-stat mon-stat-gray"><div class="mon-num">${open7 + open14}</div><div class="mon-lbl">⏱ مفتوحة +7 أيام</div></div>
        </div>
        <div class="mon-body">
            <div class="mon-alerts">
                ${alerts.length === 0
                    ? '<div class="empty" style="padding:50px;font-size:18px">✅ لا توجد تنبيهات نشطة حالياً</div>'
                    : alerts.map(a => `<div class="mon-card mon-card-${a.level}">
                        <div class="mon-card-top">
                            <span class="mon-badge mon-badge-${a.level}">${a.icon} ${a.type}</span>
                            <span class="mon-section-tag">${a.section}</span>
                        </div>
                        <div class="mon-task-title">${a.task}</div>
                        <div class="mon-detail">${a.detail}</div>
                        <div class="mon-footer">
                            <span>👤 ${a.responsible}</span>
                            ${a.taskIndex !== null && a.sectionId
                                ? `<button class="btn mon-goto" data-sec="${a.sectionId}" data-idx="${a.taskIndex}">فتح المهمة ←</button>`
                                : a.sectionId
                                    ? `<button class="btn mon-goto" data-sec="${a.sectionId}">فتح المجال ←</button>`
                                    : ''}
                        </div>
                    </div>`).join('')}
            </div>
            <div class="mon-side">
                <div class="card">
                    <h4>إحصاء الأعمال المفتوحة</h4>
                    <div class="mon-sla-list">
                        <div class="mon-sla-row ${open14 > 0 ? 'mon-sla-danger' : ''}"><span>+14 يوم (حرجة)</span><strong>${open14}</strong></div>
                        <div class="mon-sla-row ${open7 > 0 ? 'mon-sla-warn' : ''}"><span>7-14 يوم</span><strong>${open7}</strong></div>
                        <div class="mon-sla-row ${unassigned > 0 ? 'mon-sla-warn' : ''}"><span>غير مسندة</span><strong>${unassigned}</strong></div>
                    </div>
                </div>
                ${_historyBarsHtml()}
            </div>
        </div>`;
        host.querySelectorAll('.mon-goto').forEach(btn => {
            btn.onclick = () => {
                if (typeof W.showPage === 'function') W.showPage(btn.dataset.sec);
                if (btn.dataset.idx !== undefined) {
                    setTimeout(() => {
                        const card = D.querySelector(`#tasks-${btn.dataset.sec} .task[data-i="${btn.dataset.idx}"]`);
                        if (card) { card.classList.add('open'); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                    }, 250);
                }
            };
        });
        _updateMonBadge(critical.length);
    }

    function _historyBarsHtml() {
        const hist = getProgressHistory();
        if (hist.length < 2) return `<div class="card"><h4>السجل الزمني</h4><div class="empty" style="padding:20px">تُبنى البيانات يومياً — ستظهر غداً</div></div>`;
        const last = hist.slice(-10);
        const maxV = Math.max(...last.map(h => h.overall), 1);
        return `<div class="card"><h4>التقدم الزمني</h4>
        <div class="hist-bars">
            ${last.map((h, i) => {
                const prev = i > 0 ? last[i - 1].overall : h.overall;
                const delta = h.overall - prev;
                const dStr = i > 0 ? (delta >= 0 ? `<small style="color:#0aa293">+${delta}%</small>` : `<small style="color:#c85a5a">${delta}%</small>`) : '';
                return `<div class="hist-bar-item">
                    <div class="hist-bar-wrap"><div class="hist-bar-fill" style="height:${Math.max(4, Math.round(h.overall / maxV * 72))}px;background:${delta < 0 && i > 0 ? '#c85a5a' : '#0aa293'}"></div></div>
                    <div class="hist-val">${h.overall}%</div>
                    <div>${dStr}</div>
                    <div class="hist-date">${h.date.slice(5)}</div>
                </div>`;
            }).join('')}
        </div></div>`;
    }

    function _updateMonBadge(count) {
        const b = D.getElementById('monNavBadge');
        if (b) { b.textContent = count || ''; b.style.display = count > 0 ? 'inline-flex' : 'none'; }
    }

    /* ─── حقن SLA badges في بطاقات المهام ─── */
    function injectSLABadges() {
        if (!W.SECTIONS || !W.state) return;
        W.SECTIONS.forEach(s => s.tasks.forEach((_, i) => {
            const d = W.state.tasks[s.id]?.[i];
            const card = D.querySelector(`#tasks-${s.id} .task[data-i="${i}"]`);
            if (!card || !d) return;
            card.querySelector('.sla-badge')?.remove();
            const sla = computeSLAStatus(d, d.priority);
            if (!sla) return;
            const meta = card.querySelector('.task-meta');
            if (!meta) return;
            const sp = D.createElement('span');
            sp.className = `sla-badge mini ${sla.critical ? 'sla-crit' : sla.exceeded ? 'sla-warn' : 'sla-ok'}`;
            sp.textContent = `⏱ ${sla.days} يوم`;
            sp.title = `مفتوحة منذ ${sla.days} يوم — الحد: ${sla.limit} يوم`;
            meta.appendChild(sp);
        }));
    }

    /* ═══════════════════════════════════════════════════════════
       ٣. التقارير الاحترافية (Professional Reports Engine)
    ═══════════════════════════════════════════════════════════ */

    /* ── بناء الترويسة الرسمية بتصميم وزارة التعليم ── */
    W.onRptDayChange = function(selectEl) {
        const dayName = selectEl.value;
        const hDays  = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
        const targetIdx = hDays.indexOf(dayName);
        if (targetIdx === -1) return;
        
        const now = new Date();
        const currentIdx = now.getDay();
        const diff = targetIdx - currentIdx;
        const targetDate = new Date(now.getTime() + diff * 86400000);
        
        const dayStr = String(targetDate.getDate()).padStart(2, '0');
        const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
        const yearStr = targetDate.getFullYear();
        const dateFormatted = `${dayStr} / ${monthStr} / ${yearStr}`;
        
        const valEl = D.getElementById('rptHeaderDateVal');
        if (valEl) valEl.textContent = dateFormatted;
        
        const dayPrintEl = D.getElementById('rptHeaderDayPrintVal');
        if (dayPrintEl) dayPrintEl.textContent = dayName;

        if (W.state && W.state.settings) {
            W.state.settings.selectedDay = dayName;
            W.state.settings.selectedDate = dateFormatted;
            if (typeof W.save === 'function') W.save();
        }
    };

    function _rptHeader(docTitle, sub) {
        const s  = W.state?.settings || {};
        const now = new Date();
        const hDays  = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
        const todayName = hDays[now.getDay()];
        const dayStr = String(now.getDate()).padStart(2, '0');
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        const yearStr = now.getFullYear();
        const defaultDate = `${dayStr} / ${monthStr} / ${yearStr}`;

        const selectedDay = s.selectedDay || todayName;
        const selectedDate = s.selectedDate || defaultDate;
        const yearOptions = ['1446-1447 هـ','1447-1448 هـ','1448-1449 هـ','1449-1450 هـ'];
        const semOptions  = ['الأول','الثاني','الثالث'];
        const currentYear = s.year || yearOptions[0];
        const currentSem  = s.semester || 'الأول';

        return `<div class="rpt-hdr">
  <div class="rpt-hdr-box">

    <!-- ▶ العمود الأيمن: المملكة / الوزارة / إدارة / مدرسة -->
    <div class="rpt-col-right">
      <div class="rpt-kingdom">المملكة العربية السعودية</div>
      <div class="rpt-ministry-name">وزارة التعليم</div>
      <div class="rpt-field-row">
        <span class="rpt-field-lbl">إدارة تعليم</span>
        <span class="rpt-dots">${s.education || ''}</span>
      </div>
      <div class="rpt-field-row">
        <span class="rpt-field-lbl">المدرسة</span>
        <span class="rpt-dots">${s.school || ''}</span>
      </div>
    </div>

    <!-- ▶ العمود الأوسط: الشعار الرسمي فقط -->
    <div class="rpt-col-center">
      <img src="https://salogos.b-cdn.net/logos/svg/1774895141785-5zgexuf8.svg"
           class="rpt-logo-img" alt="وزارة التعليم">
    </div>

    <!-- ▶ العمود الأيسر: العام / الفصل / اليوم / التاريخ -->
    <div class="rpt-col-left">
      <div class="rpt-meta-row">
        <span class="rpt-meta-lbl">العام الدراسي</span>
        <span class="rpt-slash">/</span>
        <select class="rpt-select no-print"
          onchange="if(window.state&&window.state.settings){window.state.settings.year=this.value;window.save&&window.save()}"
        >${yearOptions.map(y=>`<option value="${y}"${y===currentYear?' selected':''}>${y}</option>`).join('')}</select>
        <span class="rpt-meta-print-val print-only">${currentYear}</span>
      </div>
      <div class="rpt-meta-row">
        <span class="rpt-meta-lbl">الفصل الدراسي</span>
        <span class="rpt-slash">/</span>
        <select class="rpt-select no-print"
          onchange="if(window.state&&window.state.settings){window.state.settings.semester=this.value;window.save&&window.save()}"
        >${semOptions.map(sm=>`<option value="${sm}"${sm===currentSem?' selected':''}>${sm}</option>`).join('')}</select>
        <span class="rpt-meta-print-val print-only">${currentSem}</span>
      </div>
      <div class="rpt-meta-row">
        <span class="rpt-meta-lbl">اليوم</span>
        <span class="rpt-slash">/</span>
        <select class="rpt-select no-print" onchange="window.onRptDayChange(this)">
          ${hDays.map(d=>`<option value="${d}"${d===selectedDay?' selected':''}>${d}</option>`).join('')}
        </select>
        <span id="rptHeaderDayPrintVal" class="rpt-meta-print-val print-only">${selectedDay}</span>
      </div>
      <div class="rpt-meta-row">
        <span class="rpt-meta-lbl">التاريخ</span>
        <span class="rpt-slash">/</span>
        <span id="rptHeaderDateVal" class="rpt-meta-val">${selectedDate}</span>
      </div>
    </div>

  </div>
  <div class="rpt-doc-title">${docTitle}</div>
</div>`;
    }


    function _rptSigs(labels) {
        const s = W.state?.settings || {};
        return `<div class="rpt-sigs">
            ${labels.map(l => `<div class="rpt-sig">
                <div class="rpt-sig-lbl">${l}</div>
                <div class="rpt-sig-name">${l.includes('مدير') ? (s.manager || '') : l.includes('وكيل') ? (s.deputy || '') : ''}</div>
                ${(l.includes('مدير') && s.signature) ? `<div style="height:48px;display:flex;align-items:center;justify-content:center"><img src="${s.signature}" alt="توقيع المدير" style="max-height:44px;max-width:130px;object-fit:contain"></div>` : ''}
                ${(l.includes('ختم') && s.stamp) ? `<div style="height:60px;display:flex;align-items:center;justify-content:center"><img src="${s.stamp}" alt="ختم المدرسة" style="max-height:56px;max-width:120px;object-fit:contain"></div>` : ''}
                <div class="rpt-sig-line"></div>
                <div class="rpt-sig-stamp">${l.includes('ختم') ? 'الختم الرسمي' : 'التوقيع'}</div>
            </div>`).join('')}
        </div>`;
    }

    function _execBadge(d) {
        const isDone = d.execution?.result === 'done' || ['completed', 'verified', 'approved'].includes(d.status);
        const isNo = d.execution?.result === 'not_done' || d.status === 'blocked';
        if (isDone) return '<span class="rpt-ok">✓ نُفذ</span>';
        if (isNo) return '<span class="rpt-no">✕ لم يُنفذ</span>';
        return '<span class="rpt-pend">○ معلق</span>';
    }

    /* تقرير ١: محضر التنفيذ الشامل */
    function _rpt_execution() {
        let allDone = 0, allNo = 0, allPend = 0, allTotal = 0, withEv = 0, noEv = 0;
        W.SECTIONS.forEach(s => s.tasks.forEach((_, i) => {
            const d = W.state.tasks[s.id]?.[i]; if (!d || d.status === 'na') return;
            allTotal++;
            const done = d.execution?.result === 'done' || ['completed', 'verified', 'approved'].includes(d.status);
            const notDone = d.execution?.result === 'not_done' || d.status === 'blocked';
            if (done) {
                allDone++;
            } else if (notDone) {
                allNo++;
            } else {
                allPend++;
            }
        }));
        return _rptHeader('محضر التنفيذ الشامل', `إجمالي البنود: ${allTotal} — مُنفَّذ: ${allDone} — لم يُنفَّذ: ${allNo} — معلق: ${allPend}`) +
        `<div class="rpt-strip">
            <div class="rpt-strip-item"><div class="rpt-big-num" style="color:#0aa293">${allDone}</div><div>إجمالي البنود المنفذة</div></div>
            <div class="rpt-strip-item"><div class="rpt-big-num" style="color:#168b78">${withEv}</div><div>شواهد مرفوعة</div></div>
            <div class="rpt-strip-item"><div class="rpt-big-num" style="color:#c85a5a">${allNo}</div><div>لم يُنفذ</div></div>
            <div class="rpt-strip-item"><div class="rpt-big-num" style="color:#357fc1">${allTotal}</div><div>إجمالي البنود</div></div>
        </div>` +
        W.SECTIONS.map(s => {
            const sc = typeof W.sectionScore === 'function' ? W.sectionScore(s) : 0;
            return `<div class="rpt-section-blk">
                <div class="rpt-sec-head"><span>${s.title}</span><span class="rpt-sec-score">${sc}%</span></div>
                <table class="rpt-tbl">
                    <thead><tr>
                        <th style="width:36px">م</th>
                        <th>البند / الإجراء</th>
                        <th style="width:110px">مسؤول التنفيذ</th>
                        <th style="width:52px;text-align:center">☐<br>نُفذ</th>
                        <th style="width:60px;text-align:center">☐<br>لم يُنفذ</th>
                        <th>ملاحظات</th>
                    </tr></thead>
                    <tbody>${s.tasks.map((t, i) => {
                        const d = W.state.tasks[s.id]?.[i]; if (!d) return '';
                        const done = d.execution?.result === 'done' || ['completed', 'verified', 'approved'].includes(d.status);
                        const notDone = d.execution?.result === 'not_done' || d.status === 'blocked';
                        const statusNote = done ? 'نُفذ' : '';
                        const noteText = statusNote + (d.notes ? (statusNote ? ' - ' : '') + d.notes : '') + (notDone && d.execution?.reason ? d.execution.reason : '');
                        return `<tr class="${d.priority === 'critical' && !done ? 'rpt-row-crit' : ''}">
                            <td class="rpt-c">${i + 1}</td>
                            <td>${t}</td>
                            <td>${d.responsible || '<span style="color:#aaa">—</span>'}</td>
                            <td class="rpt-c" style="font-size:16px">${done ? '☑' : '☐'}</td>
                            <td class="rpt-c" style="font-size:16px">${notDone ? '☑' : '☐'}</td>
                            <td>${noteText}</td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
            </div>`;
        }).join('') +
        _rptSigs(['مدير المدرسة', 'رئيس لجنة الاستعداد', 'الختم الرسمي']);
    }

    /* تقرير ٢: المتابعة الميدانية */
    function _rpt_field() {
        const open = [];
        W.SECTIONS.forEach(s => s.tasks.forEach((t, i) => {
            const d = W.state.tasks[s.id]?.[i]; if (!d || d.status === 'na') return;
            const done = d.execution?.result === 'done' || ['completed', 'verified', 'approved'].includes(d.status);
            if (!done) open.push({ section: s.title, t, d });
        }));
        open.sort((a, b) => (a.d.priority === 'critical' ? -1 : 1) || (a.d.due || '').localeCompare(b.d.due || ''));
        const today = new Date().toISOString().slice(0, 10);
        return _rptHeader('تقرير المتابعة الميدانية', `المهام المفتوحة: ${open.length}`) +
        `<table class="rpt-tbl">
            <thead><tr><th>م</th><th>المجال</th><th>البند</th><th>الأولوية</th><th>المسؤول</th><th>الحالة</th><th>الموعد</th><th>مُفتوحة منذ</th><th>الإجراء التصحيحي</th><th>ملاحظة المتابع</th></tr></thead>
            <tbody>${open.map((r, idx) => {
                const sla = computeSLAStatus(r.d, r.d.priority);
                const late = r.d.due && r.d.due < today;
                return `<tr class="${r.d.priority === 'critical' ? 'rpt-row-crit' : ''}">
                    <td class="rpt-c">${idx + 1}</td><td>${r.section}</td><td>${r.t}</td>
                    <td class="rpt-c">${r.d.priority === 'critical' ? '<span class="rpt-badge-crit">حرج</span>' : 'عادي'}</td>
                    <td>${r.d.responsible || '<span style="color:#c85a5a">غير مسند</span>'}</td>
                    <td class="rpt-c">${W.STATUS?.[r.d.status] || r.d.status}</td>
                    <td class="rpt-c ${late ? 'rpt-cell-red' : ''}">${r.d.due || '—'}</td>
                    <td class="rpt-c">${sla ? `${sla.days} يوم` : '—'}</td>
                    <td>${r.d.action || ''}</td>
                    <td class="rpt-input"></td>
                </tr>`;
            }).join('')}</tbody>
        </table>` + _rptSigs(['مدير المدرسة', 'المتابع الميداني', 'التاريخ']);
    }

    /* تقرير ٣: البنود المتعثرة */
    function _rpt_blocked() {
        const blk = [];
        W.SECTIONS.forEach(s => s.tasks.forEach((t, i) => {
            const d = W.state.tasks[s.id]?.[i]; if (!d) return;
            if (d.execution?.result === 'not_done' || d.status === 'blocked') blk.push({ section: s.title, t, d });
        }));
        return _rptHeader('تقرير البنود المتعثرة وخطط المعالجة', `عدد البنود المتعثرة: ${blk.length}`) +
        (blk.length === 0
            ? '<div style="text-align:center;padding:40px;font-size:18px;color:#0aa293">✅ لا توجد بنود متعثرة — أداء ممتاز</div>'
            : `<table class="rpt-tbl">
                <thead><tr><th>م</th><th>المجال</th><th>البند</th><th>المسؤول</th><th>سبب عدم التنفيذ</th><th>الإجراء التصحيحي</th><th>الموعد الجديد</th><th>جهة المعالجة</th></tr></thead>
                <tbody>${blk.map((r, idx) => `<tr class="rpt-row-crit">
                    <td class="rpt-c">${idx + 1}</td><td>${r.section}</td><td>${r.t}</td>
                    <td>${r.d.responsible || '—'}</td>
                    <td>${r.d.execution?.reason || r.d.notes || '—'}</td>
                    <td>${r.d.action || '<span class="rpt-input-ph">يُكتب يدوياً</span>'}</td>
                    <td class="rpt-c">${r.d.followupDate || r.d.due || '—'}</td>
                    <td class="rpt-input"></td>
                </tr>`).join('')}</tbody>
            </table>`) +
        _rptSigs(['مدير المدرسة', 'المسؤول عن المعالجة', 'المشرف']);
    }

    /* تقرير ٤: التحقق والاعتماد */
    function _rpt_verify() {
        const done = [];
        W.SECTIONS.forEach(s => s.tasks.forEach((t, i) => {
            const d = W.state.tasks[s.id]?.[i]; if (!d) return;
            const isDone = d.execution?.result === 'done' || ['completed', 'verified', 'approved'].includes(d.status);
            if (isDone) done.push({ section: s.title, t, d });
        }));
        return _rptHeader('محضر التحقق والاعتماد', `المهام المنفذة: ${done.length}`) +
        `<table class="rpt-tbl">
            <thead><tr><th>م</th><th>المجال</th><th>البند</th><th>المسؤول</th><th>تاريخ الإنجاز</th><th>حالة المراجعة</th><th>المراجع</th><th>تأكيد المراجع</th></tr></thead>
            <tbody>${done.map((r, idx) => {
                const rv = r.d.review?.status === 'accepted' ? '<span class="rpt-ok">✓ مقبول</span>' : r.d.review?.status === 'rejected' ? '<span class="rpt-no">✕ مرفوض</span>' : '<span class="rpt-pend">○ قيد المراجعة</span>';
                return `<tr>
                    <td class="rpt-c">${idx + 1}</td><td>${r.section}</td><td>${r.t}</td>
                    <td>${r.d.responsible || '—'}</td>
                    
                    <td class="rpt-c">${r.d.execution?.date?.slice(0, 10) || r.d.done || '—'}</td>
                    <td class="rpt-c">${rv}</td>
                    <td>${r.d.reviewer || '—'}</td>
                    <td class="rpt-c rpt-input">____________</td>
                </tr>`;
            }).join('')}</tbody>
        </table>` + _rptSigs(['مدير المدرسة', 'رئيس لجنة التحقق', 'الختم']);
    }

    /* تقرير ٥: مرحلة العودة */
    function _rpt_phase(idx) {
        const pName = W.PHASES?.[idx] || `المرحلة ${idx + 1}`;
        const tasks = typeof W.tasksForStage === 'function' ? W.tasksForStage(idx) : [];
        const stat = typeof W.stageExecutionSummary === 'function' ? W.stageExecutionSummary(idx) : {};
        return _rptHeader(`تقرير ${pName}`, `الإنجاز: ${stat.percent || 0}% — مُنفذ: ${stat.done || 0}/${stat.total || 0}`) +
        `<table class="rpt-tbl">
            <thead><tr><th>م</th><th>المجال</th><th>البند</th><th>الأولوية</th><th>المسؤول</th><th>نتيجة التنفيذ</th><th>الموعد</th><th>ملاحظات</th></tr></thead>
            <tbody>${tasks.map((r, i) => {
                const ok = r.data.execution?.result === 'done';
                return `<tr class="${r.data.priority === 'critical' && !ok ? 'rpt-row-crit' : ''}">
                    <td class="rpt-c">${i + 1}</td><td>${r.section.title}</td><td>${r.task}</td>
                    <td class="rpt-c">${r.data.priority === 'critical' ? '<span class="rpt-badge-crit">حرج</span>' : 'عادي'}</td>
                    <td>${r.data.responsible || '—'}</td>
                    <td class="rpt-c">${_execBadge(r.data)}</td>
                    
                    <td class="rpt-c">${r.data.due || '—'}</td>
                    <td>${r.data.notes || ''}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>` + _rptSigs(['مدير المدرسة', 'مسؤول المرحلة', 'الختم']);
    }

    /* تقرير ٦: التقرير القيادي المختصر */
    function _rpt_leadership() {
        const ov = typeof W.overall === 'function' ? W.overall() : 0;
        const rk = typeof W.risks === 'function' ? W.risks().length : 0;
        const kpi = W.KPIEngine?.compute() || {};
        const sRows = (W.SECTIONS || []).map(s => {
            const sc = typeof W.sectionScore === 'function' ? W.sectionScore(s) : 0;
            const tot = s.tasks.filter((_, i) => W.state?.tasks?.[s.id]?.[i]?.status !== 'na').length;
            const dn = s.tasks.filter((_, i) => { const d = W.state?.tasks?.[s.id]?.[i]; return d?.execution?.result === 'done'; }).length;
            return { title: s.title, sc, tot, dn };
        });
        return _rptHeader('التقرير القيادي المختصر', 'ملخص تنفيذي لمستوى الجاهزية المدرسية') +
        `<div class="rpt-strip">
            <div class="rpt-strip-item"><div class="rpt-big-num" style="color:#0aa293">${ov}%</div><div>الجاهزية العامة</div></div>
            <div class="rpt-strip-item"><div class="rpt-big-num" style="color:#357fc1">${kpi.kpis?.execution || 0}%</div><div>التنفيذ الموثق</div></div>
            
            <div class="rpt-strip-item"><div class="rpt-big-num" style="color:${rk > 5 ? '#c85a5a' : '#27805f'}">${rk}</div><div>مخاطر نشطة</div></div>
            <div class="rpt-strip-item"><div class="rpt-big-num">${kpi.grade || '—'}</div><div>درجة الإنجاز</div></div>
        </div>
        <h3 style="margin:16px 0 8px;font-size:16px">الجاهزية حسب المجال</h3>
        <table class="rpt-tbl">
            <thead><tr><th>المجال</th><th>النسبة</th><th>مُنجز / إجمالي</th><th>مستوى الجاهزية</th></tr></thead>
            <tbody>${sRows.map(r => `<tr>
                <td>${r.title}</td>
                <td class="rpt-c"><strong>${r.sc}%</strong></td>
                <td class="rpt-c">${r.dn} / ${r.tot}</td>
                <td><div style="background:#e5edef;border-radius:4px;height:13px;overflow:hidden"><div style="width:${r.sc}%;height:100%;background:${r.sc >= 80 ? '#0aa293' : r.sc >= 50 ? '#b47922' : '#c85a5a'}"></div></div></td>
            </tr>`).join('')}</tbody>
        </table>` +
        _rptSigs(['مدير المدرسة', 'وكيل المدرسة', 'الختم الرسمي']);
    }

    /* تقرير ٧: مؤشرات الأداء KPI */
    function _rpt_kpi() {
        const kpi = W.KPIEngine?.compute() || { oai: 0, kpis: {}, grade: '—', status: '—' };
        const hist = getProgressHistory().slice(-7);
        const labels = { execution: ['التنفيذ', '75%'], timing: ['الالتزام الزمني', '10%'], assignment: ['إسناد البنود الحرجة', '15%'] };
        return _rptHeader('تقرير مؤشرات الأداء الإجمالي — KPI', `الدرجة الكلية: ${kpi.grade} — ${kpi.status}`) +
        `<div class="rpt-strip" style="grid-template-columns:repeat(3,1fr)">
            <div class="rpt-strip-item"><div class="rpt-big-num" style="font-size:52px;color:#0aa293">${kpi.oai}%</div><div>المؤشر العام المركّب</div></div>
            <div class="rpt-strip-item"><div class="rpt-big-num" style="font-size:52px">${kpi.grade}</div><div>درجة الإنجاز</div></div>
            <div class="rpt-strip-item"><div class="rpt-big-num" style="font-size:22px">${kpi.status}</div><div>وصف الحالة</div></div>
        </div>
        <h3 style="margin:16px 0 8px;font-size:16px">تفصيل المؤشرات الفرعية</h3>
        <table class="rpt-tbl">
            <thead><tr><th>المؤشر</th><th>الوزن</th><th>القيمة</th><th>شريط التقدم</th><th>التقييم</th></tr></thead>
            <tbody>${Object.entries(kpi.kpis || {}).map(([k, v]) => {
                const [lbl, wt] = labels[k] || [k, '—'];
                const gr = v >= 80 ? 'ممتاز' : v >= 60 ? 'جيد' : v >= 40 ? 'مقبول' : 'يحتاج تحسين';
                return `<tr><td>${lbl}</td><td class="rpt-c">${wt}</td><td class="rpt-c"><strong>${v}%</strong></td>
                    <td><div style="background:#e5edef;border-radius:4px;height:13px;overflow:hidden"><div style="width:${v}%;height:100%;background:${v >= 80 ? '#0aa293' : v >= 60 ? '#b47922' : '#c85a5a'}"></div></div></td>
                    <td class="rpt-c">${gr}</td></tr>`;
            }).join('')}</tbody>
        </table>
        ${hist.length >= 2 ? `
        <h3 style="margin:16px 0 8px;font-size:16px">سجل التقدم (آخر ${hist.length} أيام)</h3>
        <table class="rpt-tbl">
            <thead><tr><th>التاريخ</th><th>الجاهزية</th><th>مُنجز</th><th>لم يُنفذ</th><th>متعثرة</th></tr></thead>
            <tbody>${hist.map(h => `<tr><td class="rpt-c">${h.date}</td><td class="rpt-c"><strong>${h.overall}%</strong></td><td class="rpt-c">${h.done || 0}</td><td class="rpt-c">${h.notDone || 0}</td><td class="rpt-c">${h.blocked || 0}</td></tr>`).join('')}</tbody>
        </table>` : ''}` +
        _rptSigs(['مدير المدرسة', 'رئيس لجنة الجاهزية', 'الختم']);
    }

    /* ─── تفعيل التقارير الاحترافية ─── */
    function enhanceReports() {
        const tabsEl = D.getElementById('reportTabs');
        const contEl = D.getElementById('reportContent');
        if (!tabsEl || !contEl) return;
        const tabs = [
            ['exec',    'محضر التنفيذ الشامل'],
            ['field',   'المتابعة الميدانية'],
            ['blocked', 'البنود المتعثرة'],
            ['verify',  'التحقق والاعتماد'],
            ...(W.PHASES || []).map((p, i) => [`ph-${i}`, p]),
            ['lead',    'التقرير القيادي'],
            ['kpi',     'مؤشرات الأداء KPI'],
        ];
        tabsEl.innerHTML = tabs.map(([k, l], i) => `<button class="btn report-tab ${i === 0 ? 'active' : ''}" data-k="${k}">${l}</button>`).join('');
        const show = k => {
            let html = '';
            if (k === 'exec')    html = _rpt_execution();
            else if (k === 'field')   html = _rpt_field();
            else if (k === 'blocked') html = _rpt_blocked();
            else if (k === 'verify')  html = _rpt_verify();
            else if (k === 'lead')    html = _rpt_leadership();
            else if (k === 'kpi')     html = _rpt_kpi();
            else if (k.startsWith('ph-')) html = _rpt_phase(+k.split('-')[1]);
            contEl.innerHTML = html;
            tabsEl.querySelectorAll('.report-tab').forEach(b => b.classList.toggle('active', b.dataset.k === k));
        };
        tabsEl.querySelectorAll('.report-tab').forEach(b => b.onclick = () => show(b.dataset.k));
        show('exec');
    }

    /* ═══════════════════════════════════════════════════════════
       ٤. محرك مؤشرات الأداء (KPI Engine) — من الإصدار السابق
    ═══════════════════════════════════════════════════════════ */
    function _allRows() {
        if (!W.SECTIONS || !W.state) return [];
        const rows = [];
        W.SECTIONS.forEach(s => s.tasks.forEach((t, i) => { const d = W.state.tasks[s.id]?.[i]; if (d) rows.push({ section: s, title: t, index: i, data: d }); }));
        return rows;
    }
    function _kpiExec(rows)    { const a = rows.filter(r => r.data.status !== 'na'); return a.length ? a.filter(r => r.data.execution?.result === 'done' || ['completed','verified','approved'].includes(r.data.status)).length / a.length : 0; }
    function _kpiEvid(rows)    { return _kpiExec(rows); }
    function _kpiQual(rows)    { const rv = rows.filter(r => r.data.review?.status && r.data.review.status !== 'pending'); return rv.length ? rv.filter(r => r.data.review.status === 'accepted').length / rv.length : 0.5; }
    function _kpiTime(rows)    { const w = rows.filter(r => r.data.due && r.data.status !== 'na'); if (!w.length) return 1; const t = new Date().toISOString().slice(0, 10); return w.filter(r => r.data.due >= t || ['completed', 'verified', 'approved'].includes(r.data.status)).length / w.length; }
    function _kpiAssign(rows)  { const c = rows.filter(r => r.data.priority === 'critical' && r.data.status !== 'na'); return c.length ? c.filter(r => r.data.responsible).length / c.length : 1; }

    function computeOAI() {
        const rows = _allRows();
        if (!rows.length) return { oai: 0, kpis: {}, grade: 'N/A', status: 'لا توجد بيانات', failing: [] };
        const W_ = W.state?.weights || {};
        const wt = { execution: .75, timing: .10, assignment: .15 };
        const kv = { execution: _kpiExec(rows), timing: _kpiTime(rows), assignment: _kpiAssign(rows) };
        const tw = Object.values(wt).reduce((a, b) => a + b, 0);
        const oai = Math.max(0, Math.min(1, Object.keys(wt).reduce((s, k) => s + kv[k] * wt[k], 0) / tw));
        const pct = Math.round(oai * 100);
        const g = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
        const st = pct >= 85 ? 'جاهزية مرتفعة' : pct >= 60 ? 'تقدم مستقر' : pct >= 30 ? 'قيد التنفيذ' : 'مرحلة التهيئة';
        return { oai: pct, kpis: Object.fromEntries(Object.entries(kv).map(([k, v]) => [k, Math.round(v * 100)])), grade: g, status: st, failing: Object.entries(kv).filter(([, v]) => v < 0.5).map(([k]) => k) };
    }

    /* ─── تحديث لوحة القيادة ─── */
    function refreshDashboardMetrics() {
        const res = computeOAI();
        const rows = _allRows();
        const ring = D.querySelector('.orbit-ring');
        const valEl = D.getElementById('premiumOverallValue');
        if (ring) ring.style.setProperty('--p', res.oai);
        if (valEl) valEl.textContent = res.oai + '%';
        _st('premiumOperationalState', res.status);
        _st('premiumCriticalCount', rows.filter(r => r.data.priority === 'critical' && !['completed', 'verified', 'approved', 'na'].includes(r.data.status)).length);
        _st('premiumLateCount', rows.filter(r => { if (!r.data.due || r.data.status === 'na') return false; return r.data.due < new Date().toISOString().slice(0, 10) && !['completed', 'verified', 'approved'].includes(r.data.status); }).length);
        _st('premiumExecutedCount', rows.filter(r => r.data.execution?.result === 'done').length);
        const mbox = D.getElementById('dashboardMetrics');
        if (mbox) {
            const tot = rows.filter(r => r.data.status !== 'na').length;
            const dn  = rows.filter(r => r.data.execution?.result === 'done' || ['completed', 'verified', 'approved'].includes(r.data.status)).length;
            const blk = rows.filter(r => r.data.status === 'blocked' || r.data.execution?.result === 'not_done').length;
            const appr= rows.filter(r => ['verified', 'approved'].includes(r.data.status)).length;
            const ev  = rows.filter(r => r.data.execution?.result === 'done').length;
            const gc  = pct => pct >= 80 ? '#0aa293' : pct >= 60 ? '#b47922' : '#c85a5a';
            mbox.innerHTML =
                _mCard('الجاهزية الكلية',    res.oai + '%',  res.oai, gc(res.oai)) +
                _mCard('إجمالي المهام',       tot,            null,    '#357fc1') +
                _mCard('المهام المنفذة',       dn,             Math.round(dn / Math.max(1, tot) * 100), '#0aa293') +
                _mCard('متعثرة / لم تُنفذ',  blk,            null,    '#c85a5a') +
                _mCard('المهام المنفذة',     ev,             null,    '#b47922');
        }
        _updateKPIBreakdown(res);
    }

    function _mCard(lbl, val, prog, col) {
        return `<div class="metric" style="border-top:4px solid ${col}"><span>${lbl}</span><strong style="color:${col}">${val}</strong>${prog !== null ? `<div class="progress" style="margin-top:8px"><i style="width:${prog}%;background:${col}"></i></div>` : ''}</div>`;
    }

    function _updateKPIBreakdown(res) {
        const kBox = D.getElementById('kpiBreakdownPanel');
        if (kBox) {
            const map = { execution: ['التنفيذ', '#0aa293'], timing: ['الالتزام الزمني', '#27805f'], assignment: ['إسناد البنود الحرجة', '#7c3e8a'] };
            kBox.innerHTML = Object.entries(res.kpis).map(([k, v]) => {
                const [lbl, col] = map[k] || [k, '#888'];
                return `<div class="score-line"><span>${lbl}</span><div class="progress"><i style="width:${v}%;background:${col}"></i></div><strong style="color:${col}">${v}%</strong></div>`;
            }).join('') + `<div style="margin-top:10px;padding:10px;border-radius:10px;background:#f5f9fa;border:1px solid var(--border)"><strong>درجة الإنجاز: ${res.grade}</strong> — ${res.status}${res.failing?.length ? `<br><small style="color:#c85a5a">مؤشرات تحت 50%: ${res.failing.join('، ')}</small>` : ''}</div>`;
        }
        const oaiScore = D.getElementById('oaiScore');
        const oaiLabel = D.getElementById('oaiGradeLabel');
        const oaiBar   = D.getElementById('oaiProgressBar');
        if (oaiScore) oaiScore.textContent = res.oai + '%';
        if (oaiLabel) oaiLabel.textContent = `الدرجة: ${res.grade} — ${res.status}`;
        if (oaiBar)   oaiBar.style.width = res.oai + '%';
    }

    function _st(id, v) { const el = D.getElementById(id); if (el) el.textContent = v; }

    /* ─── تحديث حالة DB ─── */
    function updateDBStatusUI(ok) {
        const b = D.getElementById('dbStatusBadge'); if (!b) return;
        const cloud = D.getElementById('cloudSaveStatus');
        const txt = cloud ? cloud.textContent : (ok ? 'الحفظ السحابي مفعّل' : 'جاري التحقق من الاتصال السحابي');
        b.innerHTML = `<span class="db-status-dot"></span> <span>${txt}</span>`;
        b.className = 'db-status-badge';
    }

    /* ─── ربط أزرار التصدير / الاستيراد ─── */
    function bindUIEvents() { /* إدارة النسخ الاحتياطية تتم عبر محرك المنصة السحابي الحالي */ }
    function _dl(c, n, t) { const a = D.createElement('a'); a.href = URL.createObjectURL(new Blob([c], { type: t })); a.download = n; a.click(); URL.revokeObjectURL(a.href); }
    function _ts() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; }

    /* ─── التفاف حول save() ─── */
    function _wrapSave() {
        if (!W.save || W.__saveWrapped) return;
        W.__saveWrapped = true;
        const orig = W.save;
        W.save = function () {
            orig.apply(this, arguments);
            takeSnapshotIfNeeded();
            setTimeout(() => {
                refreshDashboardMetrics();
                renderMonitoring();
                injectSLABadges();
                if (D.getElementById('page-reports')?.classList.contains('active')) enhanceReports();
            }, 120);
        };
    }

    /* ═══════════════════════════════════════════════════════════
       ٥. التهيئة الرئيسية
    ═══════════════════════════════════════════════════════════ */
    W.appState = { ready: false };

    async function initApp() {
        console.log('🚀 منصة جاهزية المدرسة v3.0 — بدء التشغيل...');
        try {
            if (W.readinessBootstrapPromise) await W.readinessBootstrapPromise;
            if (W.readinessDB) await W.readinessDB.init();
            bindUIEvents();
            if (typeof W.initNav === 'function') W.initNav();
            if (typeof W.renderAll === 'function') W.renderAll();
            if (typeof W.renderOperationalStages === 'function') W.renderOperationalStages();
            if (typeof W.renderManagerDashboard === 'function') W.renderManagerDashboard();
            takeSnapshotIfNeeded();
            refreshDashboardMetrics();
            renderMonitoring();
            setTimeout(injectSLABadges, 900);
            _wrapSave();
            setInterval(() => { refreshDashboardMetrics(); renderMonitoring(); injectSLABadges(); }, 60000);
            updateDBStatusUI(true);
            W.appState.ready = true;
            console.log('✅ جاهز. OAI =', computeOAI().oai + '%');
        } catch (err) { console.error('❌ خطأ:', err); updateDBStatusUI(false); }
    }

    /* ─── تصدير للنافذة ─── */
    W.KPIEngine       = { compute: computeOAI, refresh: refreshDashboardMetrics };
    W.renderMonitoring = renderMonitoring;
    W.enhanceReports   = enhanceReports;
    W.smartAlerts      = smartAlerts;
    W.getProgressHistory = getProgressHistory;

    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', initApp);
    else initApp();

})(window, document);
