import type { FastifyPluginAsync } from "fastify";

export const uiRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_req, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderIndexHtml());
  });

  app.get("/ui", async (_req, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderIndexHtml());
  });

  app.get<{ Params: { callId: string } }>("/ui/calls/:callId", async (_req, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderCallHtml());
  });
};

function renderIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>The Rive — Voice Ops</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #0b1220; color: #e7eaf0; }
      a { color: #9bd1ff; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 18px 60px; }
      .card { background: #111a2e; border: 1px solid #1b2a4d; border-radius: 14px; padding: 16px; }
      .row { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
      .title { font-size: 20px; font-weight: 700; letter-spacing: 0.2px; }
      .muted { color: #aeb7c8; font-size: 13px; }
      input { background: #0b1324; border: 1px solid #1b2a4d; border-radius: 10px; padding: 10px 12px; color: #e7eaf0; width: 320px; max-width: 100%; }
      button { background: #1f3b72; border: 1px solid #2c4a86; border-radius: 10px; padding: 10px 12px; color: #e7eaf0; cursor: pointer; }
      button:hover { background: #244581; }
      table { width: 100%; border-collapse: collapse; margin-top: 14px; }
      th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #1b2a4d; vertical-align: top; }
      th { font-size: 12px; color: #aeb7c8; font-weight: 600; }
      td { font-size: 13px; }
      .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #2a3f6b; background: #0b1324; color: #cfe3ff; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="row" style="margin-bottom: 14px;">
        <div>
          <div class="title">The Rive — Voice Ops</div>
          <div class="muted">Browse calls, transcripts, evals, and tool runs stored by this server.</div>
        </div>
        <div class="row">
          <input id="q" placeholder="Filter by callId / from / intent…" />
          <button id="refresh">Refresh</button>
        </div>
      </div>

      <div class="card">
        <div class="row">
          <div class="muted">Data source: <span class="mono">/debug/calls</span></div>
          <div class="muted" id="status">Loading…</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Ended</th>
              <th>Intent</th>
              <th>From</th>
              <th>To</th>
              <th>Summary</th>
              <th>Call ID</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </div>

    <script>
      const q = document.getElementById('q');
      const rows = document.getElementById('rows');
      const status = document.getElementById('status');
      const refresh = document.getElementById('refresh');
      let calls = [];

      function text(v) { return (v ?? '').toString(); }
      function lower(v) { return text(v).toLowerCase(); }
      function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
          if (k === 'class') node.className = v;
          else if (k === 'href') node.setAttribute('href', v);
          else node[k] = v;
        }
        for (const child of children) node.appendChild(child);
        return node;
      }

      function render() {
        rows.innerHTML = '';
        const needle = lower(q.value);
        const filtered = needle
          ? calls.filter(c => {
              const hay = [
                c.callId, c.fromNumber, c.toNumber, c.detectedIntent, c.summary
              ].map(lower).join(' ');
              return hay.includes(needle);
            })
          : calls;

        status.textContent = filtered.length + ' call(s)';
        for (const c of filtered) {
          const tr = document.createElement('tr');

          const ended = el('td', { textContent: c.endedAt || c.startedAt || '' });
          const intentTd = document.createElement('td');
          const intent = c.detectedIntent || '';
          const intentPill = el('span', { class: 'pill', textContent: intent || '—' });
          intentTd.appendChild(intentPill);

          const from = el('td', { class: 'mono', textContent: c.fromNumber || '' });
          const to = el('td', { class: 'mono', textContent: c.toNumber || '' });
          const summary = el('td', { textContent: (c.summary || '').slice(0, 160) });

          const idTd = document.createElement('td');
          const a = el('a', { class: 'mono', href: '/ui/calls/' + encodeURIComponent(c.callId), textContent: c.callId });
          idTd.appendChild(a);

          tr.appendChild(ended);
          tr.appendChild(intentTd);
          tr.appendChild(from);
          tr.appendChild(to);
          tr.appendChild(summary);
          tr.appendChild(idTd);
          rows.appendChild(tr);
        }
      }

      async function load() {
        status.textContent = 'Loading…';
        try {
          const res = await fetch('/debug/calls?limit=200');
          const data = await res.json();
          calls = Array.isArray(data.calls) ? data.calls : [];
          render();
        } catch (e) {
          status.textContent = 'Failed to load';
          console.error(e);
        }
      }

      q.addEventListener('input', render);
      refresh.addEventListener('click', load);
      load();
    </script>
  </body>
</html>`;
}

function renderCallHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Call — The Rive Voice Ops</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #0b1220; color: #e7eaf0; }
      a { color: #9bd1ff; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 18px 60px; }
      .card { background: #111a2e; border: 1px solid #1b2a4d; border-radius: 14px; padding: 16px; margin-top: 14px; }
      .row { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
      .title { font-size: 18px; font-weight: 700; letter-spacing: 0.2px; }
      .muted { color: #aeb7c8; font-size: 13px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      pre { white-space: pre-wrap; word-break: break-word; background: #0b1324; border: 1px solid #1b2a4d; border-radius: 12px; padding: 12px; margin: 0; }
      details { border: 1px solid #1b2a4d; border-radius: 12px; padding: 10px 12px; background: #0b1324; }
      details + details { margin-top: 10px; }
      summary { cursor: pointer; color: #cfe3ff; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #2a3f6b; background: #0b1324; color: #cfe3ff; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="row">
        <div>
          <div class="title">Call Details</div>
          <div class="muted"><a href="/ui">← Back to calls</a></div>
        </div>
        <div class="muted" id="status">Loading…</div>
      </div>

      <div class="card">
        <div class="row">
          <div class="mono" id="callId"></div>
          <div class="pill" id="intent"></div>
        </div>
        <div class="grid" style="margin-top: 12px;">
          <div>
            <div class="muted">From</div>
            <div class="mono" id="from"></div>
          </div>
          <div>
            <div class="muted">To</div>
            <div class="mono" id="to"></div>
          </div>
          <div>
            <div class="muted">Started</div>
            <div class="mono" id="started"></div>
          </div>
          <div>
            <div class="muted">Ended</div>
            <div class="mono" id="ended"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="muted" style="margin-bottom: 8px;">Summary</div>
        <pre id="summary"></pre>
      </div>

      <div class="card">
        <div class="muted" style="margin-bottom: 8px;">Transcript</div>
        <pre id="transcript"></pre>
      </div>

      <div class="card">
        <div class="muted" style="margin-bottom: 8px;">Eval JSON</div>
        <pre id="eval"></pre>
      </div>

      <div class="card">
        <div class="muted" style="margin-bottom: 8px;">Tool Runs</div>
        <div id="tools"></div>
      </div>

      <div class="card">
        <div class="muted" style="margin-bottom: 8px;">Raw Events</div>
        <div id="events"></div>
      </div>
    </div>

    <script>
      const status = document.getElementById('status');
      const callIdEl = document.getElementById('callId');
      const intentEl = document.getElementById('intent');
      const fromEl = document.getElementById('from');
      const toEl = document.getElementById('to');
      const startedEl = document.getElementById('started');
      const endedEl = document.getElementById('ended');
      const summaryEl = document.getElementById('summary');
      const transcriptEl = document.getElementById('transcript');
      const evalEl = document.getElementById('eval');
      const toolsEl = document.getElementById('tools');
      const eventsEl = document.getElementById('events');

      function pretty(v) {
        try { return JSON.stringify(v, null, 2); } catch { return String(v ?? ''); }
      }
      function text(v) { return (v ?? '').toString(); }
      function block(title, body) {
        const d = document.createElement('details');
        const s = document.createElement('summary');
        s.textContent = title;
        const pre = document.createElement('pre');
        pre.textContent = body;
        d.appendChild(s);
        d.appendChild(pre);
        return d;
      }

      async function load() {
        const callId = location.pathname.split('/').pop();
        callIdEl.textContent = callId || '';
        status.textContent = 'Loading…';
        try {
          const res = await fetch('/debug/calls/' + encodeURIComponent(callId));
          const data = await res.json();
          if (!data.ok) throw new Error('Not found');

          const c = data.call || {};
          intentEl.textContent = c.detectedIntent || '—';
          fromEl.textContent = c.fromNumber || '';
          toEl.textContent = c.toNumber || '';
          startedEl.textContent = c.startedAt || '';
          endedEl.textContent = c.endedAt || '';
          summaryEl.textContent = text(c.summary);
          transcriptEl.textContent = text(c.transcript);
          evalEl.textContent = pretty(c.eval);

          toolsEl.innerHTML = '';
          const toolRuns = Array.isArray(data.toolRuns) ? data.toolRuns : [];
          if (toolRuns.length === 0) toolsEl.textContent = 'No tool runs recorded.';
          for (const tr of toolRuns) {
            const title = (tr.toolName || 'tool') + ' — ' + (tr.createdAt || '');
            toolsEl.appendChild(block(title, pretty(tr)));
          }

          eventsEl.innerHTML = '';
          const events = Array.isArray(data.events) ? data.events : [];
          if (events.length === 0) eventsEl.textContent = 'No events recorded.';
          for (const ev of events) {
            const title = '#' + ev.id + ' — ' + (ev.receivedAt || '') + (ev.category ? (' — ' + ev.category) : '');
            eventsEl.appendChild(block(title, pretty(ev.payload)));
          }

          status.textContent = 'Loaded';
        } catch (e) {
          status.textContent = 'Failed to load';
          console.error(e);
        }
      }

      load();
    </script>
  </body>
</html>`;
}

