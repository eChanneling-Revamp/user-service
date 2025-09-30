// Re-export the canonical User schema from the infrastructure location to avoid
// duplication across the codebase. Keep this file so any imports using the
// modules path continue to work.
export * from '../../../infrastructure/database/schemas/user.schema';
