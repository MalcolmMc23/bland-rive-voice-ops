type EnqueueMeta = {
  requestId?: string;
  receivedAt?: string;
  headers?: Record<string, unknown>;
};

type QueueItem = {
  event: unknown;
  meta: EnqueueMeta;
};

const queue: QueueItem[] = [];
let isDraining = false;

export function enqueueEvent(event: unknown, meta: EnqueueMeta = {}) {
  queue.push({ event, meta });
  drainSoon();
}

function drainSoon() {
  if (isDraining) return;
  isDraining = true;
  setImmediate(async () => {
    try {
      const { handleEvent } = await import("./handlers.js");
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;
        await handleEvent(item.event, item.meta);
      }
    } finally {
      isDraining = false;
    }
  });
}
