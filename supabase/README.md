# Supabase

Project `yceqveccwdmzgkkamupi` (Canada Central, `ca-central-1`), URL `https://yceqveccwdmzgkkamupi.supabase.co`. Dedicated to Terroa: its own organization, keys and storage.

`migrations/20261005000000_init.sql` was applied on 5 October 2026: HANDOFF.md section 11 tables, RLS on every table, `is_staff()` helper, buckets `product-media` (public read) and `plans` (private).

## Verified (5 Oct 2026, synthetic fixtures rolled back)

- anon sees published products and consented projects only; 0 rows from `quote_requests`, `quote_items`, `plan_uploads`; cannot insert quotes; cannot update products.
- authenticated non-staff sees 0 quote rows; staff (`app_metadata.role = 'staff'`) sees quotes and unpublished products.
- Security advisor: no findings.

## Still to do (owner: Vy)

1. Set server env vars in Vercel (never `NEXT_PUBLIC_`): `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Dashboard > Project Settings > API Keys > secret key).
2. Create staff users in Auth with `app_metadata.role = 'staff'` and turn on MFA.
3. Seed the real catalogue when Terroa supplies it (the site still reads `data/*.json`).
