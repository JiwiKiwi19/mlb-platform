// In-memory stand-in for the browser Supabase client, shaped exactly like the
// calls useRealtimeInserts makes. Register it with:
//
//   vi.mock("@/lib/supabase/client", async () => {
//     const { fakeSupabase } = await import("@/test/fake-supabase");
//     return { getBrowserSupabase: () => fakeSupabase.client };
//   });

type StatusCallback = (status: string) => void;
type InsertHandler = (payload: { new: unknown }) => void;

export class FakeChannel {
  table?: string;
  private insertHandler?: InsertHandler;
  private statusCallback?: StatusCallback;

  constructor(public readonly name: string) {}

  on(_event: string, filter: { table: string }, handler: InsertHandler) {
    this.table = filter.table;
    this.insertHandler = handler;
    return this;
  }

  subscribe(cb: StatusCallback) {
    this.statusCallback = cb;
    return this;
  }

  emitStatus(status: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED") {
    this.statusCallback?.(status);
  }

  emitInsert(row: unknown) {
    this.insertHandler?.({ new: row });
  }
}

class FakeSupabase {
  channels: FakeChannel[] = [];
  removed: FakeChannel[] = [];
  backfillCalls: Record<string, number> = {};
  private backfills: Record<string, unknown[]> = {};

  readonly client = {
    channel: (name: string) => {
      const channel = new FakeChannel(name);
      this.channels.push(channel);
      return channel;
    },
    removeChannel: async (channel: FakeChannel) => {
      this.removed.push(channel);
      return "ok";
    },
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          limit: async () => {
            this.backfillCalls[table] = (this.backfillCalls[table] ?? 0) + 1;
            return { data: this.backfills[table] ?? [], error: null };
          },
        }),
      }),
    }),
  };

  reset() {
    this.channels = [];
    this.removed = [];
    this.backfillCalls = {};
    this.backfills = {};
  }

  setBackfill(table: string, rows: unknown[]) {
    this.backfills[table] = rows;
  }

  /** Most recently opened channel for a table. */
  channelFor(table: string): FakeChannel {
    const channel = [...this.channels].reverse().find((c) => c.table === table);
    if (!channel) throw new Error(`No channel opened for ${table}`);
    return channel;
  }
}

export const fakeSupabase = new FakeSupabase();
