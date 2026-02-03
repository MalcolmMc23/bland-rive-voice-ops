import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../lib/env.js";
import { isoNowInTimeZone } from "../lib/time.js";
import { getSheetsWriter } from "../sheets/index.js";
import { getStore } from "../store/sqlite.js";

const querySchema = z.object({
  call_id: z.string().min(1),
  caller: z.string().min(1).optional()
});

const leaseLeadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    move_in_date: z.string().trim().min(1).optional(),
    unit_type: z.string().trim().min(1).optional(),
    lease_term: z.string().trim().min(1).optional(),
    budget: z.string().trim().min(1).optional(),
    pets: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional()
  })
  .partial();

const maintenanceSchema = z
  .object({
    unit_number: z.string().trim().min(1).optional(),
    issue_summary: z.string().trim().min(1).optional(),
    urgency: z.string().trim().min(1).optional(),
    access_ok: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional()
  })
  .partial();

export const toolsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/log-lease-lead", async (request, reply) => {
    if (!requireToolAuth(request.headers)) return reply.code(401).send({ ok: false });
    const query = querySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ ok: false, error: "invalid query" });

    const body = leaseLeadSchema.safeParse(normalizeEmptyStrings(request.body));
    if (!body.success) return reply.code(400).send({ ok: false, error: "invalid body" });

    const createdAt = isoNowInTimeZone("America/Los_Angeles");
    const callId = query.data.call_id;
    const callerPhone = query.data.caller ?? "";

    const store = getStore();
    const inserted = store.tryInsertWrite({
      callId,
      kind: "LEASE_LEAD",
      sheetTab: "Lease Leads",
      createdAt
    });
    if (!inserted) return reply.code(200).send({ ok: true, lead_id: callId, deduped: true });

    try {
      const writer = getSheetsWriter();
      await writer.appendLeaseLead({
        created_at: createdAt,
        call_id: callId,
        caller_phone: callerPhone,
        ...body.data,
        tool_logged: true
      });

      store.recordToolRun({
        callId,
        toolName: "RiveLogLeaseLead",
        createdAt,
        request: { query: query.data, body: body.data },
        response: { ok: true, lead_id: callId }
      });

      return reply.code(200).send({ ok: true, lead_id: callId });
    } catch (error) {
      store.deleteWrite(callId, "LEASE_LEAD");
      request.log.error({ err: error }, "failed to write lease lead");
      return reply.code(500).send({ ok: false });
    }
  });

  app.post("/log-maintenance-ticket", async (request, reply) => {
    if (!requireToolAuth(request.headers)) return reply.code(401).send({ ok: false });
    const query = querySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ ok: false, error: "invalid query" });

    const body = maintenanceSchema.safeParse(normalizeEmptyStrings(request.body));
    if (!body.success) return reply.code(400).send({ ok: false, error: "invalid body" });

    const createdAt = isoNowInTimeZone("America/Los_Angeles");
    const callId = query.data.call_id;
    const callerPhone = query.data.caller ?? "";

    const store = getStore();
    const inserted = store.tryInsertWrite({
      callId,
      kind: "MAINTENANCE_TICKET",
      sheetTab: "Maintenance Tickets",
      createdAt
    });
    if (!inserted) return reply.code(200).send({ ok: true, ticket_id: callId, deduped: true });

    try {
      const writer = getSheetsWriter();
      await writer.appendMaintenanceTicket({
        created_at: createdAt,
        call_id: callId,
        caller_phone: callerPhone,
        ...body.data,
        tool_logged: true
      });

      store.recordToolRun({
        callId,
        toolName: "RiveLogMaintenanceTicket",
        createdAt,
        request: { query: query.data, body: body.data },
        response: { ok: true, ticket_id: callId }
      });

      return reply.code(200).send({ ok: true, ticket_id: callId });
    } catch (error) {
      store.deleteWrite(callId, "MAINTENANCE_TICKET");
      request.log.error({ err: error }, "failed to write maintenance ticket");
      return reply.code(500).send({ ok: false });
    }
  });
};

function requireToolAuth(headers: Record<string, unknown>) {
  const secret = env.TOOLS_SHARED_SECRET;
  if (!secret) return true; // allow local dev until configured

  const authorization = headerString(headers["authorization"]);
  if (!authorization) return false;
  return authorization === `Bearer ${secret}`;
}

function headerString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  return undefined;
}

function normalizeEmptyStrings(value: unknown) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeEmptyStrings);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed !== "") out[k] = trimmed;
      continue;
    }
    out[k] = normalizeEmptyStrings(v);
  }
  return out;
}
