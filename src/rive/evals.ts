import type { BlandClient } from "../bland/client.js";

type AnalyzeResponse = {
  answers: Array<string | number | boolean | null>;
};

export type RiveEval = {
  intent: "LEASE" | "MAINTENANCE" | "OTHER";
  routed_correctly: boolean | null;

  name?: string;
  email?: string;
  move_in_date?: string;
  unit_type?: string;
  lease_term?: string;
  budget?: string;
  pets?: string;

  unit_number?: string;
  issue_summary?: string;
  urgency?: string;
  access_ok?: string;

  notes?: string;
};

export async function analyzeRiveCall(client: BlandClient, callId: string): Promise<RiveEval> {
  const questions: Array<[string, "string" | "boolean"]> = [
    ["What is the caller's intent? Answer exactly one of: LEASE, MAINTENANCE, OTHER.", "string"],
    ["Did the agent correctly route the call for the caller's intent? Answer true or false.", "boolean"],

    ["Extract the caller name if provided, otherwise null.", "string"],
    ["Extract the caller email if provided, otherwise null.", "string"],
    ["Extract the desired move-in date/timeframe if provided, otherwise null.", "string"],
    ["Extract the desired unit type (Studio/1BR/2BR/Other) if provided, otherwise null.", "string"],
    ["Extract the desired lease term (6/12/18 months) if provided, otherwise null.", "string"],
    ["Extract the budget if provided, otherwise null.", "string"],
    ["Extract pets info if provided, otherwise null.", "string"],

    ["If maintenance: extract the unit number if provided, otherwise null.", "string"],
    ["If maintenance: extract the issue summary if provided, otherwise null.", "string"],
    ["If maintenance: extract urgency (Emergency/Urgent/Routine/Unknown) if provided, otherwise null.", "string"],
    ["If maintenance: is access OK to enter when not home? Answer Yes/No/Unknown.", "string"],

    ["Any other important notes to store for follow-up? Keep it brief.", "string"]
  ];

  const res = await client.request<AnalyzeResponse>("POST", `/v1/calls/${encodeURIComponent(callId)}/analyze`, {
    goal: "Categorize and evaluate a phone call for The Rive inbound line (leasing vs maintenance vs other), and extract any captured lead/ticket fields without inventing information.",
    questions
  });

  const answers = Array.isArray(res.answers) ? res.answers : [];
  const intent = normalizeIntent(answers[0]);
  const routed_correctly = typeof answers[1] === "boolean" ? answers[1] : null;

  const evalResult: RiveEval = {
    intent,
    routed_correctly
  };

  setIfString(evalResult, "name", answers[2]);
  setIfString(evalResult, "email", answers[3]);
  setIfString(evalResult, "move_in_date", answers[4]);
  setIfString(evalResult, "unit_type", answers[5]);
  setIfString(evalResult, "lease_term", answers[6]);
  setIfString(evalResult, "budget", answers[7]);
  setIfString(evalResult, "pets", answers[8]);

  setIfString(evalResult, "unit_number", answers[9]);
  setIfString(evalResult, "issue_summary", answers[10]);
  setIfString(evalResult, "urgency", answers[11]);
  setIfString(evalResult, "access_ok", answers[12]);

  setIfString(evalResult, "notes", answers[13]);
  return evalResult;
}

export function normalizeEvalForSheet(evalResult: unknown): string {
  try {
    return JSON.stringify(evalResult);
  } catch {
    return "";
  }
}

function normalizeIntent(v: unknown): RiveEval["intent"] {
  if (typeof v !== "string") return "OTHER";
  const t = v.trim().toUpperCase();
  if (t === "LEASE") return "LEASE";
  if (t === "MAINTENANCE") return "MAINTENANCE";
  return "OTHER";
}

function setIfString<T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K, value: unknown) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return;
  obj[key] = trimmed as T[K];
}

