# Deployment Guide

This guide walks you through deploying the YoYo Events PWA to production.

## Prerequisites

- GitHub account (for Vercel deployment)
- Supabase account (free tier works)
- Vercel account (free tier works)

## Step 1: Set Up Supabase

### Create Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `yoyo-events` (or your choice)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click "Create new project" and wait for setup (~2 minutes)

### Apply Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Click "New query"
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the editor
5. Click "Run" to execute
6. You should see "Success" messages

### Get API Credentials

1. Go to **Settings** → **API**
2. Copy these values (you'll need them):
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public** key: `eyJ...`
   - **service_role** key: `eyJ...` (keep secret!)

### Enable Realtime

1. Go to **Database** → **Replication**
2. Under "Realtime", enable:
   - `scores` table (for live leaderboards)

## Step 2: Deploy to Vercel

### Connect Repository

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. Select the `yoyo-pwa` directory as the root

### Configure Environment Variables

In the Vercel deployment setup:

1. Expand "Environment Variables"
2. Add these variables:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |

3. Click "Deploy"

### Custom Domain (Optional)

1. Go to your project in Vercel
2. Click **Settings** → **Domains**
3. Add your custom domain
4. Follow DNS configuration instructions

## Step 3: Create First Admin User

### Option A: Via Supabase Dashboard

1. Go to Supabase → **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. Enter email and password
4. Note the User UID from the user list
5. Go to **SQL Editor** and run:

```sql
INSERT INTO members (id, email, full_name, role, is_active)
VALUES (
  'USER_UUID_HERE',
  'admin@yourdomain.com',
  'Admin Name',
  'admin',
  true
);
```

### Option B: Via App (After First Admin)

Once you have one admin, they can create more users through:
- Admin Dashboard → Members → New Member

## Step 4: Configure Supabase Auth

### Update Site URL

1. Go to Supabase → **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL (e.g., `https://yoyo-events.vercel.app`)
3. Add to **Redirect URLs**:
   - `https://your-domain.com/auth/callback`
   - `https://your-domain.com/auth/reset-password`

### Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize templates for:
   - Confirm signup
   - Reset password
   - Magic link

## Step 5: Test Production

### Checklist

- [ ] Admin can log in at `/login`
- [ ] Admin can create events at `/admin/events`
- [ ] Admin can create members at `/admin/members`
- [ ] Judge can log in and see divisions
- [ ] Scoring form works on mobile
- [ ] Offline mode works (disable network, score, re-enable, sync)
- [ ] Leaderboard share link works
- [ ] PWA can be installed on mobile

## Troubleshooting

### "Missing Supabase environment variables"

- Verify all environment variables are set in Vercel
- Redeploy after adding variables

### "Unauthorized" errors

- Check that the user exists in both Supabase Auth AND the members table
- Verify the member's `is_active` is `true`

### Offline sync not working

- Check browser console for errors
- Ensure service worker is registered
- Try clearing browser cache and reinstalling PWA

### Realtime not updating

- Verify Realtime is enabled for the `scores` table in Supabase
- Check Supabase Realtime quota limits (free tier: 200 concurrent connections)

## Monitoring

### Vercel Analytics

Add to environment variables:
```
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-analytics-id
```

### Supabase Dashboard

Monitor:
- **Database** → **Query performance**
- **Auth** → **Users** (active users)
- **Realtime** → **Inspector** (connection issues)

## Scaling Considerations

### Free Tier Limits

**Supabase Free**:
- 500 MB database
- 200 concurrent Realtime connections
- 50,000 monthly active users

**Vercel Free**:
- 100 GB bandwidth
- Serverless function limits

### When to Upgrade

Consider upgrading when:
- Running events with 200+ simultaneous judges
- Database approaching 500 MB
- Need custom domains or more bandwidth

## Backup & Recovery

### Database Backups

Supabase Pro includes automatic daily backups. For free tier:

1. Go to **Settings** → **Database**
2. Use "Database Backups" to create manual backup
3. Or use pg_dump locally:

```bash
pg_dump postgresql://[connection-string] > backup.sql
```

### Code Backups

- Keep code in GitHub with proper branching
- Tag releases before major events
