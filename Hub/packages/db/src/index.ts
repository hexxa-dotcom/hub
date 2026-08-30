export * from './client';
export * from './repositories/index';
export * from './schema/tenancy';
export * from './schema/service-ops';
export * from './schema/tax';
export * from './schema/tax_rules';
export * as schema from './schema/index';
// Tipos gerados do banco vivo (para o client Supabase tipado).
export type { Database, Tables, TablesInsert, TablesUpdate, Enums, Json } from './types/database.types';
export { Constants } from './types/database.types';
export { sql, eq, desc, and, inArray, ilike } from 'drizzle-orm';
