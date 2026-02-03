import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type WriteKind = "LEASE_LEAD" | "MAINTENANCE_TICKET" | "CALL_LOG";

export type StoredEvent = {
  id: number;
  receivedAt: string;
  callId: string | null;
  category: string | null;
  payload: unknown;
  headers: Record<string, unknown> | null;
};

export type ToolRun = {
  id: number;
  callId: string;
  toolName: string;
  createdAt: string;
  request: unknown;
  response: unknown;
};

export type StoredCall = {
  callId: string;
  startedAt: string | null;
  endedAt: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  answeredBy: string | null;
  durationMinutes: number | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  detectedIntent: string | null;
  eval: unknown | null;
};

export class SqliteStore {
  readonly #db: Database.Database;

  constructor(dbPath: string) {
    ensureParentDir(dbPath);
    this.#db = new Database(dbPath);
    this.#db.pragma("journal_mode = WAL");
    this.migrate();
  }

  static fromEnv() {
    const dbPath = path.join(process.cwd(), "data", "app.db");
    return new SqliteStore(dbPath);
  }

  migrate() {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        received_at TEXT NOT NULL,
        call_id TEXT,
        category TEXT,
        payload_json TEXT NOT NULL,
        headers_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_events_call_id ON events(call_id);

      CREATE TABLE IF NOT EXISTS tool_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        request_json TEXT NOT NULL,
        response_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tool_runs_call_id ON tool_runs(call_id);

      CREATE TABLE IF NOT EXISTS calls (
        call_id TEXT PRIMARY KEY,
        started_at TEXT,
        ended_at TEXT,
        from_number TEXT,
        to_number TEXT,
        answered_by TEXT,
        duration_minutes REAL,
        summary TEXT,
        transcript TEXT,
        recording_url TEXT,
        detected_intent TEXT,
        eval_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_calls_ended_at ON calls(ended_at);

      CREATE TABLE IF NOT EXISTS writes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        sheet_tab TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(call_id, kind)
      );
    `);
  }

  recordEvent(args: {
    receivedAt: string;
    callId: string | null;
    category: string | null;
    payload: unknown;
    headers?: Record<string, unknown> | null;
  }) {
    const stmt = this.#db.prepare(
      `INSERT INTO events (received_at, call_id, category, payload_json, headers_json)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(
      args.receivedAt,
      args.callId,
      args.category,
      JSON.stringify(args.payload),
      args.headers ? JSON.stringify(args.headers) : null
    );
  }

  recordToolRun(args: {
    callId: string;
    toolName: string;
    createdAt: string;
    request: unknown;
    response: unknown;
  }) {
    const stmt = this.#db.prepare(
      `INSERT INTO tool_runs (call_id, tool_name, created_at, request_json, response_json)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(args.callId, args.toolName, args.createdAt, JSON.stringify(args.request), JSON.stringify(args.response));
  }

  upsertCall(args: StoredCall) {
    const stmt = this.#db.prepare(
      `INSERT INTO calls (
        call_id, started_at, ended_at, from_number, to_number, answered_by, duration_minutes,
        summary, transcript, recording_url, detected_intent, eval_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(call_id) DO UPDATE SET
        started_at=excluded.started_at,
        ended_at=excluded.ended_at,
        from_number=excluded.from_number,
        to_number=excluded.to_number,
        answered_by=excluded.answered_by,
        duration_minutes=excluded.duration_minutes,
        summary=excluded.summary,
        transcript=excluded.transcript,
        recording_url=excluded.recording_url,
        detected_intent=excluded.detected_intent,
        eval_json=excluded.eval_json`
    );
    stmt.run(
      args.callId,
      args.startedAt,
      args.endedAt,
      args.fromNumber,
      args.toNumber,
      args.answeredBy,
      args.durationMinutes,
      args.summary,
      args.transcript,
      args.recordingUrl,
      args.detectedIntent,
      args.eval ? JSON.stringify(args.eval) : null
    );
  }

  hasWrite(callId: string, kind: WriteKind) {
    const stmt = this.#db.prepare(`SELECT 1 FROM writes WHERE call_id = ? AND kind = ? LIMIT 1`);
    return stmt.get(callId, kind) !== undefined;
  }

  tryInsertWrite(args: { callId: string; kind: WriteKind; sheetTab?: string | null; createdAt: string }) {
    const stmt = this.#db.prepare(
      `INSERT OR IGNORE INTO writes (call_id, kind, sheet_tab, created_at) VALUES (?, ?, ?, ?)`
    );
    const res = stmt.run(args.callId, args.kind, args.sheetTab ?? null, args.createdAt);
    return res.changes > 0;
  }

  deleteWrite(callId: string, kind: WriteKind) {
    const stmt = this.#db.prepare(`DELETE FROM writes WHERE call_id = ? AND kind = ?`);
    stmt.run(callId, kind);
  }

  listCalls(limit = 50): StoredCall[] {
    const stmt = this.#db.prepare(
      `SELECT call_id, started_at, ended_at, from_number, to_number, answered_by, duration_minutes,
              summary, transcript, recording_url, detected_intent, eval_json
       FROM calls
       ORDER BY (ended_at IS NULL) ASC, ended_at DESC
       LIMIT ?`
    );
    const rows = stmt.all(limit) as Array<Record<string, unknown>>;
    return rows.map(mapCallRow);
  }

  getCall(callId: string): StoredCall | null {
    const stmt = this.#db.prepare(
      `SELECT call_id, started_at, ended_at, from_number, to_number, answered_by, duration_minutes,
              summary, transcript, recording_url, detected_intent, eval_json
       FROM calls
       WHERE call_id = ?`
    );
    const row = stmt.get(callId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return mapCallRow(row);
  }

  listEvents(callId: string): StoredEvent[] {
    const stmt = this.#db.prepare(
      `SELECT id, received_at, call_id, category, payload_json, headers_json
       FROM events
       WHERE call_id = ?
       ORDER BY id ASC`
    );
    const rows = stmt.all(callId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      receivedAt: String(r.received_at),
      callId: r.call_id === null || r.call_id === undefined ? null : String(r.call_id),
      category: r.category === null || r.category === undefined ? null : String(r.category),
      payload: safeJsonParse(String(r.payload_json)),
      headers: r.headers_json ? (safeJsonParse(String(r.headers_json)) as Record<string, unknown>) : null
    }));
  }

  listToolRuns(callId: string): ToolRun[] {
    const stmt = this.#db.prepare(
      `SELECT id, call_id, tool_name, created_at, request_json, response_json
       FROM tool_runs
       WHERE call_id = ?
       ORDER BY id ASC`
    );
    const rows = stmt.all(callId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      callId: String(r.call_id),
      toolName: String(r.tool_name),
      createdAt: String(r.created_at),
      request: safeJsonParse(String(r.request_json)),
      response: safeJsonParse(String(r.response_json))
    }));
  }
}

let singleton: SqliteStore | null = null;

export function getStore() {
  if (singleton) return singleton;
  singleton = SqliteStore.fromEnv();
  return singleton;
}

function ensureParentDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return s;
  }
}

function mapCallRow(row: Record<string, unknown>): StoredCall {
  return {
    callId: String(row.call_id),
    startedAt: row.started_at === null || row.started_at === undefined ? null : String(row.started_at),
    endedAt: row.ended_at === null || row.ended_at === undefined ? null : String(row.ended_at),
    fromNumber: row.from_number === null || row.from_number === undefined ? null : String(row.from_number),
    toNumber: row.to_number === null || row.to_number === undefined ? null : String(row.to_number),
    answeredBy: row.answered_by === null || row.answered_by === undefined ? null : String(row.answered_by),
    durationMinutes:
      row.duration_minutes === null || row.duration_minutes === undefined ? null : Number(row.duration_minutes),
    summary: row.summary === null || row.summary === undefined ? null : String(row.summary),
    transcript: row.transcript === null || row.transcript === undefined ? null : String(row.transcript),
    recordingUrl: row.recording_url === null || row.recording_url === undefined ? null : String(row.recording_url),
    detectedIntent:
      row.detected_intent === null || row.detected_intent === undefined ? null : String(row.detected_intent),
    eval: row.eval_json ? safeJsonParse(String(row.eval_json)) : null
  };
}
