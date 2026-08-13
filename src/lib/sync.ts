import { supabase } from './supabase';

export function toSnakeCase(str: string): string {
  if (str === 'specialPrice1g') return 'special_price_1g';
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  if (str === 'special_price_1g') return 'specialPrice1g';
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
  'active_days',
  'passkeyCredential',
  'passkey_credential'
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

const BLOCKED_DEMO_HISTORY_IDS: Record<string, Set<string>> = {
  invoices: new Set(['inv-1', 'inv-2', 'inv-3', 'inv-4']),
  expenses: new Set(['exp-1', 'exp-2']),
  shifts: new Set(['shift-old-1', 'shift-current', 'shift-seed-1'])
};

// Global CRUD helpers
export async function syncUpsert(table: string, data: any) {
  if (data?.id && BLOCKED_DEMO_HISTORY_IDS[table]?.has(data.id)) {
    console.warn('Blocked demo history upsert:', table, data.id);
    return null;
  }
  if (!supabase) return null;
  const mapped = mapKeys(data, toSnakeCase);
  let lastError: unknown = null;

  // Reuse the same immutable ID on every attempt, making transient retries idempotent.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { error } = await supabase.from(table).upsert(mapped);
      if (error) throw error;
      return data;
    } catch (error) {
      lastError = error;
      console.error(`Error upserting into table ${table} (attempt ${attempt}/3):`, error);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, attempt * 400));
      }
    }
  }

  throw lastError;
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
  
  let query = supabase.from(table).select('*');
  
  // Optimización de rendimiento para tablas de historial / logs masivos
  if (table === 'chat_messages') {
    query = query.order('timestamp', { ascending: false }).limit(50);
  } else if (table === 'invoices') {
    query = query.order('created_at', { ascending: false }).limit(1000);
  } else if (table === 'stock_adjustments') {
    query = query.order('created_at', { ascending: false }).limit(50);
  } else if (table === 'expenses') {
    query = query.order('created_at', { ascending: false }).limit(500);
  } else if (table === 'shifts') {
    query = query.order('start_time', { ascending: false }).limit(30);
  } else if (table === 'payroll_entries') {
    query = query.order('created_at', { ascending: false }).limit(30);
  } else if (table === 'stock_transfers') {
    query = query.order('created_at', { ascending: false }).limit(30);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`Error fetching table ${table}:`, error);
    return [];
  }
  return mapKeys(data, toCamelCase) || [];
}

export function mergeRecordsById<T extends { id: string }>(local: T[], remote: T[], ignoredIds: string[] = []): T[] {
  const merged = new Map<string, T>();
  const ignoredIdsSet = new Set(ignoredIds);

  local.forEach(item => { if (!ignoredIdsSet.has(item.id)) merged.set(item.id, item); });
  remote.forEach(item => { if (!ignoredIdsSet.has(item.id)) merged.set(item.id, item); });

  return Array.from(merged.values());
}

export async function syncMissingRecords(
  table: string,
  local: Array<{ id: string }>,
  remote: Array<{ id: string }>,
  ignoredIds: string[] = []
): Promise<void> {
  const remoteIds = new Set(remote.map(item => item.id));
  const ignoredIdsSet = new Set(ignoredIds);
  const missing = local.filter(item => !remoteIds.has(item.id) && !ignoredIdsSet.has(item.id));

  if (missing.length === 0) return;

  await Promise.allSettled(
    missing.map(item => syncUpsert(table, item))
  );
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
