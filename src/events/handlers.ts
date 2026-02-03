import { env } from "../lib/env.js";
import { isoNowInTimeZone } from "../lib/time.js";
import { getSheetsWriter } from "../sheets/index.js";
import { getStore } from "../store/sqlite.js";
import { BlandClient } from "../bland/client.js";
import { analyzeRiveCall, normalizeEvalForSheet } from "../rive/evals.js";
import { truncateForSheetCell } from "../rive/sheetsFormat.js";

type HandlerMeta = {
  requestId?: string;
  receivedAt?: string;
  headers?: Record<string, unknown>;
};

export async function handleEvent(event: unknown, meta: HandlerMeta) {
  const receivedAt = meta.receivedAt ?? isoNowInTimeZone("America/Los_Angeles");
  const store = getStore();

  const callId = extractCallId(event);
  const category = extractCategory(event);

  store.recordEvent({
    receivedAt,
    callId,
    category,
    payload: event,
    headers: meta.headers ?? null
  });

  if (!callId) return;
  if (!isCallCompletionEvent(event)) return;

  await processCallCompletion(callId, event).catch((error) => {
    // Don't crash webhook processing if eval/sheets fails.
    // Everything important is already stored in SQLite.
    console.error("processCallCompletion failed", { callId, error });
  });
}

async function processCallCompletion(callId: string, event: unknown) {
  const store = getStore();
  const now = isoNowInTimeZone("America/Los_Angeles");

  const call = extractCallDetails(callId, event);

  // Eval: use Bland Analyze API if we have an API key.
  let evalResult: unknown | null = null;
  let detectedIntent: string | null = null;
  if (env.BLAND_API_KEY) {
    const client = new BlandClient();
    const analyzed = await analyzeRiveCall(client, callId);
    evalResult = analyzed;
    detectedIntent = analyzed.intent ?? null;
  }

  store.upsertCall({
    callId,
    startedAt: call.startedAt ?? null,
    endedAt: call.endedAt ?? now,
    fromNumber: call.from ?? null,
    toNumber: call.to ?? null,
    answeredBy: call.answeredBy ?? null,
    durationMinutes: call.durationMinutes ?? null,
    summary: call.summary ?? null,
    transcript: call.transcript ?? null,
    recordingUrl: call.recordingUrl ?? null,
    detectedIntent,
    eval: evalResult
  });

  // Write Call Logs row (idempotent)
  const inserted = store.tryInsertWrite({
    callId,
    kind: "CALL_LOG",
    sheetTab: "Call Logs",
    createdAt: now
  });
  if (!inserted) return;

  try {
    const writer = getSheetsWriter();
    const evalForSheet = evalResult ? normalizeEvalForSheet(evalResult) : "";
    await writer.appendCallLog({
      created_at: now,
      call_id: callId,
      from: call.from ?? "",
      to: call.to ?? "",
      answered_by: call.answeredBy ?? "",
      duration_minutes: call.durationMinutes ?? "",
      summary: truncateForSheetCell(call.summary ?? "", 5000),
      transcript: truncateForSheetCell(call.transcript ?? "", 45000),
      recording_url: call.recordingUrl ?? "",
      detected_intent: detectedIntent ?? "",
      eval_json: truncateForSheetCell(evalForSheet, 45000)
    });
  } catch (error) {
    store.deleteWrite(callId, "CALL_LOG");
    console.error("failed to append call log", { callId, error });
    return;
  }

  // Fallback intake if tools never ran
  if (evalResult && typeof evalResult === "object") {
    await tryFallbackIntake(callId, call.from ?? "", evalResult).catch(() => undefined);
  }
}

async function tryFallbackIntake(callId: string, callerPhone: string, evalResult: unknown) {
  const store = getStore();
  const now = isoNowInTimeZone("America/Los_Angeles");
  const writer = getSheetsWriter();

  const normalized = normalizeEvalForFallback(evalResult);
  if (!normalized.intent) return;

  if (normalized.intent === "LEASE") {
    if (store.hasWrite(callId, "LEASE_LEAD")) return;
    const hasSomething =
      Boolean(normalized.name) ||
      Boolean(normalized.email) ||
      Boolean(normalized.moveInDate) ||
      Boolean(normalized.unitType);
    if (!hasSomething) return;

    const inserted = store.tryInsertWrite({
      callId,
      kind: "LEASE_LEAD",
      sheetTab: "Lease Leads",
      createdAt: now
    });
    if (!inserted) return;

    try {
      await writer.appendLeaseLead({
        created_at: now,
        call_id: callId,
        caller_phone: callerPhone,
        name: normalized.name ?? undefined,
        email: normalized.email ?? undefined,
        move_in_date: normalized.moveInDate ?? undefined,
        unit_type: normalized.unitType ?? undefined,
        lease_term: normalized.leaseTerm ?? undefined,
        budget: normalized.budget ?? undefined,
        pets: normalized.pets ?? undefined,
        notes: normalized.notes ? `FALLBACK: ${normalized.notes}` : "FALLBACK: extracted from call eval",
        tool_logged: false
      });
    } catch (error) {
      store.deleteWrite(callId, "LEASE_LEAD");
      console.error("failed fallback lease lead append", { callId, error });
    }
  }

  if (normalized.intent === "MAINTENANCE") {
    if (store.hasWrite(callId, "MAINTENANCE_TICKET")) return;
    const hasSomething = Boolean(normalized.unitNumber) || Boolean(normalized.issueSummary);
    if (!hasSomething) return;

    const inserted = store.tryInsertWrite({
      callId,
      kind: "MAINTENANCE_TICKET",
      sheetTab: "Maintenance Tickets",
      createdAt: now
    });
    if (!inserted) return;

    try {
      await writer.appendMaintenanceTicket({
        created_at: now,
        call_id: callId,
        caller_phone: callerPhone,
        unit_number: normalized.unitNumber ?? undefined,
        issue_summary: normalized.issueSummary ?? undefined,
        urgency: normalized.urgency ?? undefined,
        access_ok: normalized.accessOk ?? undefined,
        notes: normalized.notes ? `FALLBACK: ${normalized.notes}` : "FALLBACK: extracted from call eval",
        tool_logged: false
      });
    } catch (error) {
      store.deleteWrite(callId, "MAINTENANCE_TICKET");
      console.error("failed fallback maintenance append", { callId, error });
    }
  }
}

function extractCallId(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const obj = event as Record<string, unknown>;
  if (typeof obj.call_id === "string" && obj.call_id) return obj.call_id;
  if (typeof obj.c_id === "string" && obj.c_id) return obj.c_id;
  if (obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    if (typeof data.call_id === "string" && data.call_id) return data.call_id;
  }
  return null;
}

function extractCategory(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const obj = event as Record<string, unknown>;
  if (typeof obj.category === "string" && obj.category) return obj.category;
  if (typeof obj.type === "string" && obj.type) return obj.type;
  return null;
}

function isCallCompletionEvent(event: unknown): boolean {
  if (!event || typeof event !== "object") return false;
  const obj = event as Record<string, unknown>;

  // Post-call webhook payloads include `completed: true`.
  if (obj.completed === true) return true;
  if (typeof obj.status === "string" && obj.status.toLowerCase() === "completed") return true;

  // Heuristic: call details payload has summary/transcript.
  if (typeof obj.concatenated_transcript === "string" && obj.concatenated_transcript.length > 0) return true;
  if (typeof obj.summary === "string" && obj.summary.length > 0) return true;

  return false;
}

function extractCallDetails(callId: string, event: unknown) {
  const obj = (event && typeof event === "object" ? (event as Record<string, unknown>) : {}) as Record<string, unknown>;
  return {
    callId,
    from: typeof obj.from === "string" ? obj.from : null,
    to: typeof obj.to === "string" ? obj.to : null,
    answeredBy: typeof obj.answered_by === "string" ? obj.answered_by : null,
    durationMinutes: typeof obj.call_length === "number" ? obj.call_length : null,
    summary: typeof obj.summary === "string" ? obj.summary : null,
    transcript: typeof obj.concatenated_transcript === "string" ? obj.concatenated_transcript : null,
    recordingUrl: typeof obj.recording_url === "string" ? obj.recording_url : null,
    startedAt: typeof obj.created_at === "string" ? obj.created_at : null,
    endedAt: typeof obj.completed_at === "string" ? obj.completed_at : null
  };
}

function normalizeEvalForFallback(evalResult: unknown): {
  intent?: "LEASE" | "MAINTENANCE" | "OTHER";
  name?: string;
  email?: string;
  moveInDate?: string;
  unitType?: string;
  leaseTerm?: string;
  budget?: string;
  pets?: string;
  unitNumber?: string;
  issueSummary?: string;
  urgency?: string;
  accessOk?: string;
  notes?: string;
} {
  if (!evalResult || typeof evalResult !== "object") return {};
  const e = evalResult as Record<string, unknown>;

  const intentRaw = typeof e.intent === "string" ? e.intent.toUpperCase() : undefined;
  const intent =
    intentRaw === "LEASE" || intentRaw === "MAINTENANCE" || intentRaw === "OTHER"
      ? (intentRaw as "LEASE" | "MAINTENANCE" | "OTHER")
      : undefined;

  return {
    intent,
    name: stringOrUndefined(e.name),
    email: stringOrUndefined(e.email),
    moveInDate: stringOrUndefined(e.move_in_date),
    unitType: stringOrUndefined(e.unit_type),
    leaseTerm: stringOrUndefined(e.lease_term),
    budget: stringOrUndefined(e.budget),
    pets: stringOrUndefined(e.pets),
    unitNumber: stringOrUndefined(e.unit_number),
    issueSummary: stringOrUndefined(e.issue_summary),
    urgency: stringOrUndefined(e.urgency),
    accessOk: stringOrUndefined(e.access_ok),
    notes: stringOrUndefined(e.notes)
  };
}

function stringOrUndefined(v: unknown) {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}
