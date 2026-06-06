// Tiny in-memory TTL cache shared across requests in the Node server process.
// Keeps us from hammering data providers during a screening sweep.

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return hit.value as T;
  }
  const value = await fn();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

export function clearCache() {
  store.clear();
}
