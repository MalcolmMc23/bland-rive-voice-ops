import { env } from "../src/lib/env.js";
import { BlandClient } from "../src/bland/client.js";
import { RIVE_SYSTEM_PROMPT } from "../src/rive/prompt.js";

type BlandToolList = {
  tools: Array<{
    tool_id: string;
    label?: string;
    tool: {
      name: string;
    };
  }>;
};

type CreateToolResponse = { tool_id: string } | { status: string; tool_id?: string };

async function main() {
  if (!env.BLAND_API_KEY) throw new Error("Missing BLAND_API_KEY");
  if (!env.PUBLIC_BASE_URL) throw new Error("Missing PUBLIC_BASE_URL (must be https)");
  if (!env.BLAND_INBOUND_NUMBER) throw new Error("Missing BLAND_INBOUND_NUMBER");
  if (!env.TOOLS_SHARED_SECRET) throw new Error("Missing TOOLS_SHARED_SECRET");

  const client = new BlandClient();

  const tools = await client.request<BlandToolList>("GET", "/v1/tools");
  const leaseToolId = await upsertTool(client, tools, buildLeaseTool());
  const maintenanceToolId = await upsertTool(client, tools, buildMaintenanceTool());

  await client.request("POST", `/v1/inbound/${encodeURIComponent(env.BLAND_INBOUND_NUMBER)}`, {
    prompt: RIVE_SYSTEM_PROMPT,
    voice: env.BLAND_VOICE,
    model: env.BLAND_MODEL,
    timezone: "America/Los_Angeles",
    webhook: `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/webhooks/bland`,
    webhook_events: ["call", "tool", "webhook"],
    tools: [leaseToolId, maintenanceToolId]
  });

  console.log("✅ Updated inbound number config");
  console.log(`- Number: ${env.BLAND_INBOUND_NUMBER}`);
  console.log(`- Webhook: ${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/webhooks/bland`);
  console.log(`- Tools: ${leaseToolId}, ${maintenanceToolId}`);
}

function buildLeaseTool() {
  const base = env.PUBLIC_BASE_URL!.replace(/\/$/, "");
  return {
    name: "RiveLogLeaseLead",
    description: "Log a leasing lead for The Rive into Google Sheets.",
    speech: "Got it — I'll save those details for our leasing team.",
    url: `${base}/tools/log-lease-lead`,
    method: "POST",
    headers: {
      authorization: `Bearer ${env.TOOLS_SHARED_SECRET}`
    },
    query: {
      call_id: "{{call_id}}",
      caller: "{{phone_number}}"
    },
    body: {
      name: "{{input.name}}",
      email: "{{input.email}}",
      move_in_date: "{{input.move_in_date}}",
      unit_type: "{{input.unit_type}}",
      lease_term: "{{input.lease_term}}",
      budget: "{{input.budget}}",
      pets: "{{input.pets}}",
      notes: "{{input.notes}}"
    },
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Caller preferred name." },
        email: { type: "string", description: "Caller email address (optional)." },
        move_in_date: { type: "string", description: "Desired move-in date or timeframe." },
        unit_type: { type: "string", description: "Studio / 1BR / 2BR / Other." },
        lease_term: { type: "string", description: "6 / 12 / 18 months (availability varies)." },
        budget: { type: "string", description: "Budget if provided." },
        pets: { type: "string", description: "Pets info if provided." },
        notes: { type: "string", description: "Any extra context." }
      }
    },
    response: {
      ok: "$.data.ok",
      lead_id: "$.data.lead_id"
    }
  };
}

function buildMaintenanceTool() {
  const base = env.PUBLIC_BASE_URL!.replace(/\/$/, "");
  return {
    name: "RiveLogMaintenanceTicket",
    description: "Log a maintenance request for The Rive into Google Sheets.",
    speech: "Thanks — I'm logging that maintenance request now.",
    url: `${base}/tools/log-maintenance-ticket`,
    method: "POST",
    headers: {
      authorization: `Bearer ${env.TOOLS_SHARED_SECRET}`
    },
    query: {
      call_id: "{{call_id}}",
      caller: "{{phone_number}}"
    },
    body: {
      unit_number: "{{input.unit_number}}",
      issue_summary: "{{input.issue_summary}}",
      urgency: "{{input.urgency}}",
      access_ok: "{{input.access_ok}}",
      notes: "{{input.notes}}"
    },
    input_schema: {
      type: "object",
      properties: {
        unit_number: { type: "string", description: "Resident unit number." },
        issue_summary: { type: "string", description: "Short description of the issue." },
        urgency: { type: "string", description: "Emergency / Urgent / Routine / Unknown." },
        access_ok: { type: "string", description: "Yes / No / Unknown." },
        notes: { type: "string", description: "Any extra context." }
      }
    },
    response: {
      ok: "$.data.ok",
      ticket_id: "$.data.ticket_id"
    }
  };
}

async function upsertTool(client: BlandClient, list: BlandToolList, toolDef: Record<string, unknown>) {
  const existing = list.tools.find((t) => t.tool?.name === toolDef.name);
  if (!existing) {
    const created = await client.request<CreateToolResponse>("POST", "/v1/tools", toolDef);
    const toolId = (created as { tool_id?: string }).tool_id;
    if (!toolId) throw new Error(`Failed to create tool ${String(toolDef.name)}`);
    console.log(`✅ Created tool ${String(toolDef.name)}: ${toolId}`);
    return toolId;
  }

  await client.request("POST", `/v1/tools/${encodeURIComponent(existing.tool_id)}`, toolDef);
  console.log(`✅ Updated tool ${String(toolDef.name)}: ${existing.tool_id}`);
  return existing.tool_id;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
