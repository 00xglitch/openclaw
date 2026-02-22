type CacheEntry<T> = { data: T; expiry: number };

const cache = new Map<string, CacheEntry<unknown>>();

export function cachedRequest<T>(
  request: (method: string, params: unknown) => Promise<T>,
  method: string,
  params: unknown,
  ttlMs = 30_000,
): Promise<T> {
  const key = `${method}:${JSON.stringify(params)}`;
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiry > Date.now()) {
    return Promise.resolve(entry.data);
  }
  return request(method, params).then((data) => {
    cache.set(key, { data, expiry: Date.now() + ttlMs });
    return data;
  });
}

export function invalidateCache(method?: string): void {
  if (!method) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${method}:`)) {
      cache.delete(key);
    }
  }
}
