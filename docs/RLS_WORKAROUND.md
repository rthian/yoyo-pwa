# Row Level Security (RLS) & role checks

## Why this doc exists

Postgres RLS on `members` can recurse if a policy on `members` queries `members` again to decide whether the caller is an admin. That produced:

`infinite recursion detected in policy for relation "members"` (42P17)

## Current pattern (supported)

### 1. `is_admin()` SECURITY DEFINER (SQL)

Migrations / `schema.sql` define an `is_admin()` helper that reads `members.role` as definer, so admin policies do not recurse through RLS. Prefer this for any policy that needs “is the caller an admin?”.

### 2. `createAdminClient()` on the server (app)

For server-side **role and capability checks**, APIs and layouts use the service-role client:

```ts
import { createAdminClient } from '@/lib/supabase/admin'

const supabaseAdmin = createAdminClient()
const { data: member } = await supabaseAdmin
  .from('members')
  .select('id, role, …')
  .eq('id', user.id)
  .single()
```

Canonical helpers:

- `lib/supabase/admin.ts` — service role (never expose to the browser)
- `lib/auth/request.ts` — `getAuthedAdminClient()`
- `lib/auth/event-permissions.ts` — event-scoped capabilities

Session auth still comes from the cookie client (`lib/supabase/server.ts`); only the **authorization lookup** uses the admin client.

### 3. First admin user

```bash
node scripts/create-admin.js
```

Uses the service role to create the first admin without depending on RLS.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Keep it server-only (Vercel / `.env.local`). Never prefix it with `NEXT_PUBLIC_`.
- Browser code must use the anon key + user JWT; do not ship the service role key.
- New tables that need self-service RLS should avoid recursive `members` subqueries; use `is_admin()` or policies that only compare `auth.uid()` to a column.

## Historical note

Older admin pages queried `members` with the user-scoped client and hit recursion. Those paths were moved to `createAdminClient()`. This doc no longer tracks a “remaining broken admin pages” list — if you add a new server check against `members`, use the admin client or `is_admin()` in SQL.
