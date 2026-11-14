# Revomaker System Share (simple)

Files: index.html + style.css (public page), script.js, dashboard.html + dashboard.js (owner login + dashboard),
bg.mp4 (background video), api/index.js (the backend), vercel.json.

Put it on vercel.app:
1. Put this folder on GitHub, then in Vercel: Add New > Project > import it. Leave build settings empty.
2. In the project, open Storage / Marketplace, add "Upstash Redis" (free) and connect it to the project.
3. In Settings > Environment Variables add:
   OWNER_USERNAME = revomakeadmin
   OWNER_PASSWORD = (your password)
   (don't write the password inside any file)
4. Redeploy. Public page: /   Owner login + dashboard: /dashboard
