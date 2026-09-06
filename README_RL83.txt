RL83 - Independent school permanent system-admin registration link fix

Modified file only:
- supabase/functions/platform-directory/index.ts

Fix:
- System-admin school registration links are validated by the school's immutable link contract:
  schoolId + schoolCode + registrationCode + active school status.
- Removed the additional active-manager membership dependency introduced in RL82.
- No school IDs, codes, registration codes, users, archives, or stored files are modified.
- Manager-issued signed links and administrative-employee signed links remain unchanged.

Deployment required:
Redeploy Supabase Edge Function: platform-directory
