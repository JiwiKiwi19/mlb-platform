/** Any row with a bigserial insertion id and the pipeline's idempotency key. */
export type StreamRow = { id: number; unique_id: string };

/**
 * Merge incoming rows into a newest-first list: dedupe by unique_id (incoming wins),
 * order by insertion id, and cap the size. Returns `current` unchanged when nothing
 * new arrived, so reducers can return the same state and React can bail out.
 */
export function mergeRows<T extends StreamRow>(
  current: T[],
  incoming: readonly T[],
  limit: number,
  isSame: (a: T, b: T) => boolean = (a, b) => a.id === b.id,
): T[] {
  if (incoming.length === 0) return current;
  const byKey = new Map<string, T>();
  for (const row of current) byKey.set(row.unique_id, row);
  let changed = false;
  for (const row of incoming) {
    const existing = byKey.get(row.unique_id);
    if (!existing || !isSame(existing, row)) changed = true;
    byKey.set(row.unique_id, existing && isSame(existing, row) ? existing : row);
  }
  if (!changed) return current;
  return Array.from(byKey.values())
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

/** Parse a list of untrusted rows, dropping any that fail validation. */
export function parseRows<T>(rows: readonly unknown[] | null | undefined, parse: (row: unknown) => T | null): T[] {
  return (rows ?? []).map(parse).filter((row): row is T => row !== null);
}
