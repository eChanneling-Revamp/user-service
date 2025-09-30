Supabase integration

This folder provides two Supabase clients via DI:

- `SUPABASE_PUBLIC`: a client constructed with the anon/public key (for client-like operations, limited permissions).
- `SUPABASE_SERVICE`: a client constructed with the service role key (server-side, elevated privileges). Use this for server operations like upserts and secure token-related workflows.

Configure using environment variables in `.env`:

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ... (anon public key)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (service role key - keep secret)
