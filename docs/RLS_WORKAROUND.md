# Row Level Security (RLS) Workaround

## Problem

The Supabase RLS policies for the `members` table had an infinite recursion issue:

```sql
CREATE POLICY "Admins can manage members"
  ON members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id::text = auth.uid()::text 
      AND m.role = 'admin'
    )
  );
```

**The Issue**: To check if you can read from `members`, it queries `members` to see if you're an admin, which triggers the policy again → infinite loop.

**Error**: `infinite recursion detected in policy for relation "members"` (PostgreSQL error code: 42P17)

## Solution Implemented

### 1. Created Admin User via Service Role

Script: `scripts/create-admin.js`

This script uses the service role key (which bypasses RLS) to insert the admin user directly into the database.

**Usage:**
```bash
node scripts/create-admin.js
```

### 2. Workaround in Layouts

Modified:
- `app/(admin)/layout.tsx`
- `app/(judge)/layout.tsx`

**What Changed**: Instead of using the regular Supabase client (which respects RLS), we use a service role client for the role check:

```typescript
// Use service role to bypass RLS for role check
const { createClient: createClientSupabase } = await import('@supabase/supabase-js')
const supabaseAdmin = createClientSupabase(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const { data: member } = await supabaseAdmin
  .from('members')
  .select('*')
  .eq('id', user.id)
  .single()
```

## Remaining Issues

Some admin pages still show RLS errors when fetching data because they use the regular Supabase client. Pages affected:
- `/admin/events` - when fetching events created by members
- `/admin/members` - when fetching member list
- `/admin/judges` - when fetching judge list

These pages will need similar workarounds or the RLS policies need to be properly fixed.

## Proper Fix (TODO)

To fix the RLS policies properly, you need to break the recursion by allowing users to read their own record first:

```sql
-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can manage members" ON members;

-- Allow users to read their own record (breaks recursion)
CREATE POLICY "Users can view own record"
  ON members FOR SELECT
  TO authenticated
  USING (id::text = auth.uid()::text);

-- Then allow admins to manage all (this won't cause recursion anymore)
CREATE POLICY "Admins full access"
  ON members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id::text = auth.uid()::text 
      AND m.role = 'admin'
    )
  );
```

Run this SQL in Supabase SQL Editor, then remove the service role workarounds from the code.

## Security Note

⚠️ The service role key has **full database access** and bypasses all RLS policies. It should:
- Only be used on the **server side** (Never in client code)
- Never be exposed in client bundles
- Be kept secret in environment variables
- Only be used when necessary (like this auth workaround)

The current implementation is safe because it's only used in:
1. Server-side layouts (not exposed to client)
2. For role checking only (not data manipulation)
3. Only queries the user's own member record
