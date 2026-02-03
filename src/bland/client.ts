import { env } from "../lib/env.js";

export type BlandClientOptions = {
  apiKey?: string;
  baseUrl?: string;
};

export class BlandClient {
  readonly #apiKey?: string;
  readonly #baseUrl: string;

  constructor(options: BlandClientOptions = {}) {
    this.#apiKey = options.apiKey ?? env.BLAND_API_KEY;
    this.#baseUrl = (options.baseUrl ?? env.BLAND_BASE_URL ?? "").replace(/\/$/, "");
    if (!this.#baseUrl) {
      throw new Error("Missing BLAND_BASE_URL (set env or pass baseUrl)");
    }
  }

  async request<TResponse>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<TResponse> {
    const url = `${this.#baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (this.#apiKey) headers.authorization = this.#apiKey;

    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Bland API error ${res.status}: ${truncate(text, 500)}`);
    }

    if (!text) return undefined as TResponse;
    return JSON.parse(text) as TResponse;
  }
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
