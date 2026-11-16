# BSG Kitchen Standards on GitHub + Vercel + Supabase

Nothing is typed in the app. Staff just log in with their name and PIN and the app syncs by itself.

1. **Supabase**: SQL Editor -> paste `supabase_setup.sql` -> Run.
2. **GitHub**: put this whole folder in a repository.
3. **Vercel**: Add New Project -> import the repository (no build settings needed).
4. **Vercel -> Settings -> Environment Variables** (then Redeploy):
   - `SUPABASE_URL` = Project URL (Supabase -> Project Settings -> API)
   - `SUPABASE_SERVICE_KEY` = service_role key (keep it only here)
   - `BSG_ORG` = `bsg` (optional; must match the row in the SQL)
5. Open the Vercel link on each phone. Log in with your PIN. First time ever: Admin, PIN 1234. Change it under Users.
