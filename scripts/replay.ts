import { getStore } from "../src/store/sqlite.js";

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1];
    if (!val || val.startsWith("--")) continue;
    args[key] = val;
    i++;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const callId = args["call-id"];
  if (!callId) {
    console.log("Usage: npm run replay -- --call-id <CALL_ID>");
    process.exitCode = 1;
    return;
  }

  const store = getStore();
  const call = store.getCall(callId);
  if (!call) {
    console.log(`No call found for call_id=${callId}`);
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("=== Call ===");
  console.log(JSON.stringify(call, null, 2));

  console.log("");
  console.log("=== Tool Runs ===");
  const toolRuns = store.listToolRuns(callId);
  for (const tr of toolRuns) {
    console.log(JSON.stringify(tr, null, 2));
  }

  console.log("");
  console.log("=== Events ===");
  const events = store.listEvents(callId);
  for (const ev of events) {
    console.log(JSON.stringify(ev, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

