import { z } from "zod";
import { loadDotEnv } from "./dotenv.js";

loadDotEnv();

const optionalUrl = () =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().optional()
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  BLAND_API_KEY: z.string().optional(),
  BLAND_BASE_URL: z.string().url().default("https://api.bland.ai"),
  BLAND_WEBHOOK_SECRET: z.string().optional(),
  BLAND_INBOUND_NUMBER: z.string().optional(),
  BLAND_MODEL: z.string().default("base"),
  BLAND_VOICE: z.string().default("Paige"),

  PUBLIC_BASE_URL: optionalUrl(),
  TOOLS_SHARED_SECRET: z.string().optional(),

  SHEETS_APPS_SCRIPT_URL: optionalUrl(),
  SHEETS_APPS_SCRIPT_TOKEN: z.string().optional()
});

export const env = envSchema.parse(process.env);
