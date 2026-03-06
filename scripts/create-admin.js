/**
 * Script to create an admin user directly via Supabase service role
 * This bypasses RLS policies
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */

// Read .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

// Parse env variables
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE environment variables in .env.local');
  console.error('Found:', { supabaseUrl, serviceKeyExists: !!supabaseServiceKey });
  process.exit(1);
}

// Create admin client with service role (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  console.log('🔍 Checking for existing user...');
  
  // Get the authenticated user info
  const userId = '97b8063c-1bb6-49f4-8b1b-853b59a3b83d';
  const email = 'yewmun88@gmail.com';
  
  console.log(`User ID: ${userId}`);
  console.log(`Email: ${email}`);
  
  // Insert or update the member record
  const { data, error } = await supabase
    .from('members')
    .upsert({
      id: userId,
      email: email,
      full_name: 'Admin User',
      role: 'admin',
      is_active: true
    }, {
      onConflict: 'id'
    })
    .select();
  
  if (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
  
  console.log('✅ Admin user created successfully!');
  console.log(data);
  
  // Verify the user
  const { data: member, error: fetchError } = await supabase
    .from('members')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (fetchError) {
    console.error('❌ Error fetching member:', fetchError);
    process.exit(1);
  }
  
  console.log('\n✅ Verified admin user:');
  console.log(`  Email: ${member.email}`);
  console.log(`  Role: ${member.role}`);
  console.log(`  Active: ${member.is_active}`);
  console.log('\n🎉 You can now log in at http://localhost:3000/admin');
}

createAdmin();
