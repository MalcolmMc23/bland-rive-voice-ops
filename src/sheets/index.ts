import type { SheetsWriter } from "./types.js";
import { AppsScriptSheetsWriter } from "./appsScriptWriter.js";
import { env } from "../lib/env.js";

export function getSheetsWriter(): SheetsWriter {
  if (env.SHEETS_APPS_SCRIPT_URL && env.SHEETS_APPS_SCRIPT_TOKEN) {
    return new AppsScriptSheetsWriter();
  }
  return new NoopSheetsWriter();
}

class NoopSheetsWriter implements SheetsWriter {
  async appendLeaseLead(): Promise<void> {}
  async appendMaintenanceTicket(): Promise<void> {}
  async appendCallLog(): Promise<void> {}
}
