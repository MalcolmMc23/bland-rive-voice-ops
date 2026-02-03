import { env } from "../lib/env.js";
import type { CallLogRow, LeaseLeadRow, MaintenanceTicketRow, SheetsWriter } from "./types.js";

type PostBody = {
  token: string;
  type: "lease_lead" | "maintenance_ticket" | "call_log";
  payload: Record<string, unknown>;
};

export class AppsScriptSheetsWriter implements SheetsWriter {
  readonly #url: string;
  readonly #token: string;

  constructor(options: { url?: string; token?: string } = {}) {
    const url = options.url ?? env.SHEETS_APPS_SCRIPT_URL;
    const token = options.token ?? env.SHEETS_APPS_SCRIPT_TOKEN;
    if (!url) throw new Error("Missing SHEETS_APPS_SCRIPT_URL");
    if (!token) throw new Error("Missing SHEETS_APPS_SCRIPT_TOKEN");
    this.#url = url;
    this.#token = token;
  }

  async appendLeaseLead(row: LeaseLeadRow): Promise<void> {
    await this.#post({ type: "lease_lead", payload: row });
  }

  async appendMaintenanceTicket(row: MaintenanceTicketRow): Promise<void> {
    await this.#post({ type: "maintenance_ticket", payload: row });
  }

  async appendCallLog(row: CallLogRow): Promise<void> {
    await this.#post({ type: "call_log", payload: row });
  }

  async #post(args: { type: PostBody["type"]; payload: Record<string, unknown> }) {
    const body: PostBody = {
      token: this.#token,
      type: args.type,
      payload: args.payload
    };

    const res = await fetch(this.#url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Sheets Apps Script error ${res.status}: ${truncate(text, 500)}`);
    }
  }
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

