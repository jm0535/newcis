/**
 * Source-runner wrapper. Each external feed is fetched through run(), which
 * captures success/failure, the returned value, an error string, and elapsed ms
 * — so one source failing a cycle degrades to {ok:false} instead of throwing and
 * blanking the whole ingest. The orchestration in lib.ts reads these results to
 * build indicators, sector rows, and the last_run health record.
 */
export interface SourceResult<T> {
  ok: boolean;
  value: T | null;
  error?: string;
  ms: number;
}

export async function run<T>(name: string, fn: () => Promise<T>): Promise<SourceResult<T>> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, value, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, value: null, error: String(e), ms: Date.now() - t0 };
  }
}
