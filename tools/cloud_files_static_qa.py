from pathlib import Path
import re, json, sys
root=Path(__file__).resolve().parents[1]
targets=['manager_library_records.html','wakil-records.html','teacher_section_library.html','administrative_employee_library.html','activity_leader_records.html','student_advisor_records.html','manager_records.html','self_evaluation_records.html','external_evaluation_archive.html','meeting_minutes_template.html','school_health_unified_registry.html','teacher_comprehensive_record.html','administrative_employee_portal.html','external_team_smart_card.html']
errors=[]; rows=[]
for name in targets:
 p=root/name
 if not p.exists(): errors.append(f'MISSING:{name}'); continue
 s=p.read_text('utf-8',errors='ignore')
 counts={x:len(re.findall(rf'<script\s+src=["\']{re.escape(x)}["\']',s,re.I)) for x in ['platform-cloud-session.js','cloud-file-engine.js','cloud-file-bootstrap.js','cloud-file-panel.js']}
 if any(v!=1 for v in counts.values()): errors.append(f'SCRIPT_COUNT:{name}:{counts}')
 rows.append({'file':name,**counts})
required=['cloud-file-engine.js','cloud-file-panel.js','cloud-file-bootstrap.js','platform-cloud-session.js','SUPABASE_PLATFORM_FILES_FINAL_SETUP.sql','supabase/functions/platform-files/index.ts','supabase/functions/platform-session/index.ts']
for x in required:
 if not (root/x).exists(): errors.append(f'MISSING_REQUIRED:{x}')
report={'ok':not errors,'errors':errors,'integrated_pages':rows,'required_files':required}
(root/'CLOUD_FILES_STATIC_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
