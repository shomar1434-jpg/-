PATCH RL136 — Restore legacy active-account login compatibility while preserving RL132 account management

Changed file only:
- school-login.html

What changed:
- Restores the previously working login contract: correct credential + same school + active account can enter.
- Keeps strict school-link/school_id isolation from RL115.
- Still attempts PlatformCloudSession first for cloud services and authoritative role when available.
- If cloud-session creation fails after the account itself was verified active in the bound school, login falls back to the verified account role instead of blocking the user.
- Does not modify manager.html, platform-directory, account creation/activation, passwords, database rows, or Edge Functions.
- RL132 remains intact.
