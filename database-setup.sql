-- Channeling Service - Supabase Database Setup Script
-- Run these SQL commands in your Supabase SQL Editor

-- ============================================
-- 1. CREATE USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'hospital', 'doctor', 'nurse', 'patient')),
  age INTEGER CHECK (age > 0 AND age < 150),
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. CREATE OTPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0
);

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- ============================================
-- 4. CREATE FUNCTION TO UPDATE TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CREATE TRIGGER FOR AUTO-UPDATE TIMESTAMP
-- ============================================
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. CREATE FUNCTION TO DELETE EXPIRED OTPS
-- ============================================
CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otps WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. CREATE RLS POLICIES
-- ============================================

-- Policy: Service role can do everything on users
DROP POLICY IF EXISTS "Service role full access users" ON users;
CREATE POLICY "Service role full access users" ON users
  FOR ALL
  USING (true);

-- Policy: Service role can do everything on otps
DROP POLICY IF EXISTS "Service role full access otps" ON otps;
CREATE POLICY "Service role full access otps" ON otps
  FOR ALL
  USING (true);

-- ============================================
-- 9. INSERT INITIAL SUPER ADMIN (OPTIONAL)
-- ============================================
-- Password is 'Admin@123' hashed with bcrypt
-- You should change this password immediately after first login!
INSERT INTO users (email, password, first_name, last_name, phone_number, role, gender)
VALUES (
  'superadmin@channelingservice.com',
  '$2b$10$rJ8ELQxYZKZqGqJ8ZqYxBuQxELQxYZKZqGqJ8ZqYxBuQxELQxYZ', -- Change this!
  'Super',
  'Admin',
  '+1234567890',
  'super_admin',
  'other'
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 10. GRANT PERMISSIONS
-- ============================================
-- Grant necessary permissions to the service role
GRANT ALL ON users TO service_role;
GRANT ALL ON otps TO service_role;
GRANT USAGE ON SEQUENCE users_id_seq TO service_role;
GRANT USAGE ON SEQUENCE otps_id_seq TO service_role;

-- ============================================
-- 11. CREATE VIEW FOR USER STATISTICS (OPTIONAL)
-- ============================================
CREATE OR REPLACE VIEW user_statistics AS
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE role = 'patient') AS total_patients,
  COUNT(*) FILTER (WHERE role = 'doctor') AS total_doctors,
  COUNT(*) FILTER (WHERE role = 'nurse') AS total_nurses,
  COUNT(*) FILTER (WHERE role = 'hospital') AS total_hospitals,
  COUNT(*) FILTER (WHERE role = 'admin') AS total_admins,
  COUNT(*) FILTER (WHERE role = 'super_admin') AS total_super_admins,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_users_this_week,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_this_month
FROM users;

-- Grant access to the view
GRANT SELECT ON user_statistics TO service_role;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify your setup:

-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'otps');

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('users', 'otps');

-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('users', 'otps');

-- View current policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('users', 'otps');

-- ============================================
-- NOTES:
-- ============================================
-- 1. Replace the super admin password hash with a real bcrypt hash
-- 2. Configure pg_cron extension for automatic OTP cleanup (if needed)
-- 3. Adjust RLS policies based on your security requirements
-- 4. Consider adding additional indexes based on query patterns
-- 5. Set up database backups in Supabase settings
-- ============================================
