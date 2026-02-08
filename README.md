# YoYo Events PWA

A Progressive Web Application for managing yo-yo competition events, judging, and scoring. Built with Next.js, Supabase, and Tailwind CSS.

## Features

### Admin Interface
- **Event Management**: Create, edit, and manage competition events
- **Division Management**: Organize participants into divisions with different scoring types
- **Member Management**: Manage competitors, judges, and administrators
- **Judge Assignment**: Assign judges to specific divisions
- **Reports**: Overview of system statistics

### Judge Interface (Mobile-Optimized)
- **Division List**: View assigned divisions
- **Mobile Scoring**: Touch-optimized scoring form with number steppers
- **Offline Support**: Score offline and sync when connected
- **Score Queue**: Track pending and completed scores

### Leaderboard
- **Real-time Updates**: Live score updates via Supabase Realtime
- **Public Sharing**: Generate shareable links for spectators
- **Mobile-Friendly**: Responsive design for any device

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS + shadcn/ui
- **PWA**: @ducanh2912/next-pwa
- **Offline Storage**: localforage (IndexedDB)
- **Form Validation**: Zod + React Hook Form

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Supabase account

### 1. Clone and Install

```bash
git clone <repository-url>
cd yoyo-pwa
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings -> API and copy your credentials
3. Run the database schema:
   - Go to SQL Editor in Supabase Dashboard
   - Copy and paste the contents of `supabase/schema.sql`
   - Execute the SQL

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Create First Admin User

1. Go to Supabase Dashboard -> Authentication -> Users
2. Click "Add User" and create a user with email/password
3. Copy the user's UUID
4. Go to SQL Editor and run:

```sql
INSERT INTO members (id, email, full_name, role, is_active)
VALUES (
  'your-user-uuid-here',
  'admin@example.com',
  'Admin User',
  'admin',
  true
);
```

Now you can log in at `/login` with admin privileges.

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables in Vercel project settings
4. Deploy

### Environment Variables for Production

Set these in your Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Project Structure

```
yoyo-pwa/
├── app/                    # Next.js App Router pages
│   ├── (admin)/           # Admin layout and pages
│   ├── (judge)/           # Judge layout and pages
│   ├── api/               # API routes
│   ├── auth/              # Auth callback and reset pages
│   └── leaderboard/       # Public leaderboard
├── components/
│   ├── admin/             # Admin-specific components
│   ├── judge/             # Judge-specific components
│   └── ui/                # Reusable UI components (shadcn)
├── lib/
│   ├── auth/              # Auth helpers and context
│   ├── hooks/             # Custom React hooks
│   ├── offline/           # Offline queue and sync
│   ├── supabase/          # Supabase client configuration
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   └── validations/       # Zod schemas
├── public/
│   ├── icons/             # PWA icons
│   └── manifest.json      # PWA manifest
└── supabase/
    └── schema.sql         # Database schema
```

## PWA Features

The app is installable as a Progressive Web App:

- **Offline Support**: Service worker caches static assets
- **Add to Home Screen**: Install prompt on mobile devices
- **Offline Scoring**: Judges can score without internet
- **Background Sync**: Scores sync when back online

## Database Schema

Key tables:

- `members` - Users (admins, judges, competitors)
- `events` - Competition events
- `divisions` - Event divisions/categories
- `division_members` - Participants in each division
- `division_judges` - Judges assigned to divisions
- `scores` - Individual scores from judges
- `leaderboard_tokens` - Public share tokens

See `supabase/schema.sql` for the complete schema.

## Authentication Flow

1. **Admin Signup**: Admins create accounts for users via the admin interface
2. **Login**: Users log in at `/login`
3. **Role-Based Access**: 
   - Admins → `/admin/*`
   - Judges → `/judge/*`
4. **Password Reset**: Via `/forgot-password`

## Scoring System

The default scoring system includes:

**Technical Execution**
- Clicks (integer, 0.1 multiplier)
- Positive/Variety (0-10, 0.5 increments)
- Choreography (0-10, 0.5 increments)
- Consistency (0-10, 0.5 increments)

**Performance**
- Use of Space (0-10, 0.5 increments)
- Body Control (0-10, 0.5 increments)
- Showmanship (0-10, 0.5 increments)
- Music Use (0-10, 0.5 increments)
- Construction (0-10, 0.5 increments)
- Trick Diversity (0-10, 0.5 increments)

**Deductions** (0-50, integers)

Total = Technical + Performance - Deductions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.
# yoyo-pwa
