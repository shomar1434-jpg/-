RL114 — Administrative employee execution evidence visibility
Changed only:
1) administrative_employee_execution.html
2) administrative_employee_evaluation.html

Fix:
- Files are uploaded to platform-files instead of being embedded as base64 in execution state.
- Execution keeps only small cloud file references (fileId + metadata), preserving legacy data-url evidence.
- Evidence is linked per employee + goal using module employee_plan_evidence / recordType admin_execution_goal.
- Employee page rehydrates evidence from platform-files links on reload.
- Manager evaluation page displays each goal's uploaded evidence and opens it through a signed URL.
- Same school isolation remains enforced by platform-files session/backend.
- Existing execution/plan/archive data are not deleted or rewritten broadly.
