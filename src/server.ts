import Fastify from "fastify";
import { env } from "./lib/env.js";
import { webhooksRoutes } from "./webhooks/routes.js";
import { toolsRoutes } from "./tools/routes.js";
import { debugRoutes } from "./debug/routes.js";

export async function buildServer() {
  const server = Fastify({
    logger: true,
    disableRequestLogging: env.NODE_ENV === "test"
  });

  server.get("/health", async () => {
    return { ok: true };
  });

  await server.register(webhooksRoutes, { prefix: "/webhooks" });
  await server.register(toolsRoutes, { prefix: "/tools" });
  await server.register(debugRoutes, { prefix: "/debug" });

  return server;
}
