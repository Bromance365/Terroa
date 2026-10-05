# Supabase (phase 2, not connected)

`migrations/20261005000000_init.sql` is the schema from HANDOFF.md section 11 with RLS on every table. It has **not** been applied anywhere.

Before applying:
1. Create a dedicated Terroa project in Canada (Central) and confirm the region.
2. Answer HANDOFF.md section 13 (retention periods, privacy officer, provider approval).
3. Run `npx supabase db push` against a staging project first, then test with isolated accounts: anonymous REST calls to `quote_requests`, `quote_items`, `plan_uploads` must fail; a staff user (`app_metadata.role = 'staff'`) succeeds; unpublished products and projects without `consent_on_file` stay hidden.
