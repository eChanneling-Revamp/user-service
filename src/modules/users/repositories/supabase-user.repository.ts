// Re-export the Supabase-backed repository from infrastructure so module-level
// repository filename explicitly references Supabase. This keeps existing imports
// consistent while making filenames clear.
export { SupabaseUserRepository } from '../../../infrastructure/supabase/supabase-user.repository';
