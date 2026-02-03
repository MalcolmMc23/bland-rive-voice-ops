import { env } from "../src/lib/env.js";

async function main() {
  console.log("");
  console.log("The Rive — Google Sheets (Apps Script) setup");
  console.log("");
  console.log("1) Create a Google Spreadsheet named: The Rive — Voice Ops");
  console.log("2) Create 3 tabs:");
  console.log('   - "Lease Leads"');
  console.log('   - "Maintenance Tickets"');
  console.log('   - "Call Logs"');
  console.log("3) Extensions -> Apps Script");
  console.log("4) Paste `apps-script/Code.gs` into the Apps Script editor");
  console.log("5) Project Settings -> Script Properties -> add:");
  console.log("   - SHEETS_WEBHOOK_TOKEN = <random secret>");
  console.log("6) Deploy -> New deployment -> Web app");
  console.log("   - Execute as: Me");
  console.log("   - Who has access: Anyone");
  console.log("7) Copy the Web App URL into your `.env`:");
  console.log("   - SHEETS_APPS_SCRIPT_URL=...");
  console.log("   - SHEETS_APPS_SCRIPT_TOKEN=... (same as SHEETS_WEBHOOK_TOKEN)");
  console.log("");

  if (!env.SHEETS_APPS_SCRIPT_URL || !env.SHEETS_APPS_SCRIPT_TOKEN) {
    console.log("Set SHEETS_APPS_SCRIPT_URL and SHEETS_APPS_SCRIPT_TOKEN, then re-run to validate writes.");
    return;
  }

  console.log("Validating Apps Script endpoint...");
  const callId = `test_${Date.now()}`;
  await post(env.SHEETS_APPS_SCRIPT_URL, {
    token: env.SHEETS_APPS_SCRIPT_TOKEN,
    type: "lease_lead",
    payload: {
      created_at: new Date().toISOString(),
      call_id: callId,
      caller_phone: "+15555550100",
      name: "Test Lead",
      tool_logged: true
    }
  });
  await post(env.SHEETS_APPS_SCRIPT_URL, {
    token: env.SHEETS_APPS_SCRIPT_TOKEN,
    type: "maintenance_ticket",
    payload: {
      created_at: new Date().toISOString(),
      call_id: callId,
      caller_phone: "+15555550100",
      unit_number: "101",
      issue_summary: "Test issue",
      urgency: "Routine",
      access_ok: "Unknown",
      tool_logged: true
    }
  });
  await post(env.SHEETS_APPS_SCRIPT_URL, {
    token: env.SHEETS_APPS_SCRIPT_TOKEN,
    type: "call_log",
    payload: {
      created_at: new Date().toISOString(),
      call_id: callId,
      from: "+15555550100",
      to: "+16507497390",
      answered_by: "human",
      duration_minutes: 0.1,
      summary: "Test call log row",
      transcript: "Hello world",
      recording_url: "",
      detected_intent: "LEASE",
      eval_json: "{}"
    }
  });

  console.log("✅ Wrote test rows to Lease Leads, Maintenance Tickets, and Call Logs.");
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Apps Script error ${res.status}: ${text}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

