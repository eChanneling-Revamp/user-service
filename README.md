Notes
 - This scaffold shows OAuth redirect endpoints and strategy stubs. The strategies currently return placeholder user objects; you'll need to implement token exchange, user upsert, and issuance of local JWTs and refresh tokens.
 - This project uses Supabase (Postgres) as the primary datastore. Legacy archival schema/repository files have been removed from the codebase; the service is Supabase-only.
User Service (NestJS) — Quick start (PowerShell)

1) From `d:\e-channeling` project root, create the user-service folder and scaffolded files are already placed under `user-service/`.

2) Install dependencies (PowerShell):

```powershell
cd d:\e-channeling\user-service
npm install
```

3) Set up environment variables
- Copy `d:\e-channeling\.env` to `d:\e-channeling\user-service\.env` or point `src/main.ts` dotenv to parent .env (already configured to load parent .env).
- Fill Google/Azure client ids and secrets.

4) Run development server:

```powershell
npm run start:dev
```

Notes
- This scaffold shows OAuth redirect endpoints and strategy stubs. The strategies currently return placeholder user objects; you'll need to implement token exchange, user upsert, and issuance of local JWTs and refresh tokens.
- This project uses Supabase (Postgres) as the primary datastore. Legacy archival schema/repository files were moved to `src/legacy/` for reference only.
