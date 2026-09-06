RL88 — Root fix for independent-school user registration deployment

PROVEN ROOT CAUSE:
The existing GitHub Actions workflow did NOT include platform-directory in either:
1) the push paths trigger, or
2) the deployment steps.
Therefore a green "Deploy Supabase Edge Functions" run could complete while leaving platform-directory on its old server version.

FILES CHANGED ONLY:
1) register.html
2) supabase/functions/platform-directory/index.ts
3) .github/workflows/deploy-supabase-functions.yml

INSTALL:
- Replace the three files at their exact repository paths.
- Commit/push to main.
- The workflow will now trigger when platform-directory changes and explicitly deploy it.
- The workflow also refuses to deploy if the expected registration contract marker is absent from the checked-out platform-directory source.
- Wait for both GitHub Pages and Deploy Supabase Edge Functions to complete.
- Test the SAME permanent owner-generated registration link; do not regenerate it.

NOT TOUCHED:
- school-login.html / login links
- school IDs, school codes, registration codes
- school data, memberships, archives, or storage
