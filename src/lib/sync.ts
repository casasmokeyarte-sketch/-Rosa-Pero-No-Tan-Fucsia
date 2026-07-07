import { supabase } from './supabase';

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

const SKIP_RECURSION_KEYS = new Set([
  'permissions',
  'items',
  'paymentMethods',
  'productCategories',
  'bonuses',
  'deductions',
  'userStocks',
  'attachment',
  'activeDays',
  'payment_methods',
  'product_categories',
  'user_stocks',
  'active_days'
]);

export function mapKeys(obj: any, mapper: (s: string) => string): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => mapKeys(item, mapper));
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj;
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const mappedKey = mapper(key);
        const value = obj[key];
        if (SKIP_RECURSION_KEYS.has(key)) {
          result[mappedKey] = value;
        } else {
          result[mappedKey] = mapKeys(value, mapper);
        }
      }
    }
    return result;
  }
  return obj;
}

// Global CRUD helpers
export async function syncUpsert(table: string, data: any) {
  if (!supabase) return null;
  const mapped = mapKeys(data, toSnakeCase);
  const { error } = await supabase.from(table).upsert(mapped);
  if (error) {
    console.error(`Error upserting into table ${table}:`, error);
    throw error;
  }
}

export async function syncDelete(table: string, id: string) {
  if (!supabase) return null;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.error(`Error deleting from table ${table} with id ${id}:`, error);
    throw error;
  }
}

export async function syncDeleteByField(table: string, fieldName: string, fieldValue: string) {
  if (!supabase) return null;
  const { error } = await supabase.from(table).delete().eq(toSnakeCase(fieldName), fieldValue);
  if (error) {
    console.error(`Error deleting from table ${table} where ${fieldName}=${fieldValue}:`, error);
    throw error;
  }
}

export async function fetchTable(table: string): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`Error fetching table ${table}:`, error);
    return [];
  }
  return mapKeys(data, toCamelCase) || [];
}

export async function fetchConfig(): Promise<any | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('business_config').select('*').eq('id', 'singleton').maybeSingle();
  if (error) {
    console.error("Error fetching config:", error);
    return null;
  }
  return data ? mapKeys(data, toCamelCase) : null;
}
