const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const sqlFile = path.join(__dirname, '..', 'db', 'create_users_table.sql');
if (!fs.existsSync(sqlFile)) {
  console.error('Migration file not found at', sqlFile);
  process.exit(1);
}
const sql = fs.readFileSync(sqlFile, 'utf8');

// Accept POSTGRES_URL from environment or .env
const connectionString = process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DB_CONNECTION;

if (!connectionString) {
  console.error('\nMissing POSTGRES_URL.');
  console.error('Get the connection string from Supabase Project → Settings → Database → Connection string (Full Database URL).');
  console.error('Then set it in a .env file at the project root like: POSTGRES_URL="postgresql://..."\n');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString });
  try {
    console.log('Connecting to Postgres...');
    await client.connect();
    console.log('Connected. Running migration from', sqlFile);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    console.error('Migration failed:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
