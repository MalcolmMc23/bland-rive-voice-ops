import { buildServer } from "./server.js";
import { env } from "./lib/env.js";

const server = await buildServer();

await server.listen({ host: "0.0.0.0", port: env.PORT });
server.log.info({ port: env.PORT }, "server listening");

