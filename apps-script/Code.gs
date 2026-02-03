// The Rive — Voice Ops (Apps Script Web App)
//
// 1) Create a Google Spreadsheet named "The Rive — Voice Ops"
// 2) Extensions -> Apps Script
// 3) Paste this file into Code.gs
// 4) Project Settings -> Script Properties -> add:
//    SHEETS_WEBHOOK_TOKEN = <random secret>
// 5) Deploy -> New deployment -> Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 6) Copy the Web App URL into your server env:
//    SHEETS_APPS_SCRIPT_URL=...
//    SHEETS_APPS_SCRIPT_TOKEN=...
//
// Expected POST JSON body:
//   { token: string, type: "lease_lead"|"maintenance_ticket"|"call_log", payload: object }

var TABS = {
  lease_lead: {
    name: "Lease Leads",
    headers: [
      "Created At",
      "Call ID",
      "Caller Phone",
      "Intent",
      "Name",
      "Email",
      "Move-in Date",
      "Unit Type",
      "Lease Term",
      "Budget",
      "Pets",
      "Notes",
      "Tool Logged"
    ]
  },
  maintenance_ticket: {
    name: "Maintenance Tickets",
    headers: [
      "Created At",
      "Call ID",
      "Caller Phone",
      "Intent",
      "Unit #",
      "Issue Summary",
      "Urgency",
      "Access OK",
      "Notes",
      "Tool Logged"
    ]
  },
  call_log: {
    name: "Call Logs",
    headers: [
      "Created At",
      "Call ID",
      "From",
      "To",
      "Answered By",
      "Duration (min)",
      "Summary",
      "Transcript",
      "Recording URL",
      "Detected Intent",
      "Eval JSON"
    ]
  }
};

function doPost(e) {
  try {
    var token = PropertiesService.getScriptProperties().getProperty("SHEETS_WEBHOOK_TOKEN");
    if (!token) {
      return jsonResponse(500, { ok: false, error: "Missing script property SHEETS_WEBHOOK_TOKEN" });
    }

    var body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
    if (!body || body.token !== token) return jsonResponse(401, { ok: false });
    if (!body.type || !TABS[body.type]) return jsonResponse(400, { ok: false, error: "Unknown type" });

    var tab = TABS[body.type];
    var sheet = ensureSheet(tab.name, tab.headers);
    var row = buildRow(body.type, body.payload || {});
    sheet.appendRow(row);

    return jsonResponse(200, { ok: true });
  } catch (err) {
    return jsonResponse(500, { ok: false, error: String(err) });
  }
}

function ensureSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.getDataRange().createFilter();
    applyValidationsAndFormatting(name, sheet);
  }
  return sheet;
}

function applyValidationsAndFormatting(name, sheet) {
  // Apply lightweight validations for rows 2..1000
  var maxRows = 999;

  if (name === "Lease Leads") {
    // Unit Type (col 8): Studio/1BR/2BR/Other
    setValidation(sheet, 2, 8, maxRows, ["Studio", "1BR", "2BR", "Other"]);
    // Lease Term (col 9): 6/12/18/Unknown
    setValidation(sheet, 2, 9, maxRows, ["6", "12", "18", "Unknown"]);
    // Tool Logged (col 13): TRUE/FALSE
    setValidation(sheet, 2, 13, maxRows, ["TRUE", "FALSE"]);
  }

  if (name === "Maintenance Tickets") {
    // Urgency (col 7)
    setValidation(sheet, 2, 7, maxRows, ["Emergency", "Urgent", "Routine", "Unknown"]);
    // Access OK (col 8)
    setValidation(sheet, 2, 8, maxRows, ["Yes", "No", "Unknown"]);
    // Tool Logged (col 10)
    setValidation(sheet, 2, 10, maxRows, ["TRUE", "FALSE"]);

    // Conditional formatting: Emergency highlighted
    var range = sheet.getRange(2, 7, maxRows, 1);
    var rules = sheet.getConditionalFormatRules();
    var emergencyRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Emergency")
      .setBackground("#f8d7da")
      .setRanges([range])
      .build();
    sheet.setConditionalFormatRules([emergencyRule].concat(rules));
  }

  if (name === "Call Logs") {
    // Detected Intent (col 10)
    setValidation(sheet, 2, 10, maxRows, ["LEASE", "MAINTENANCE", "OTHER"]);
  }
}

function setValidation(sheet, startRow, col, numRows, allowedValues) {
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(allowedValues, true).build();
  sheet.getRange(startRow, col, numRows, 1).setDataValidation(rule);
}

function buildRow(type, payload) {
  if (type === "lease_lead") {
    return [
      payload.created_at || "",
      payload.call_id || "",
      payload.caller_phone || "",
      "LEASE",
      payload.name || "",
      payload.email || "",
      payload.move_in_date || "",
      payload.unit_type || "",
      payload.lease_term || "",
      payload.budget || "",
      payload.pets || "",
      payload.notes || "",
      payload.tool_logged ? "TRUE" : "FALSE"
    ];
  }

  if (type === "maintenance_ticket") {
    return [
      payload.created_at || "",
      payload.call_id || "",
      payload.caller_phone || "",
      "MAINTENANCE",
      payload.unit_number || "",
      payload.issue_summary || "",
      payload.urgency || "",
      payload.access_ok || "",
      payload.notes || "",
      payload.tool_logged ? "TRUE" : "FALSE"
    ];
  }

  // call_log
  return [
    payload.created_at || "",
    payload.call_id || "",
    payload.from || "",
    payload.to || "",
    payload.answered_by || "",
    payload.duration_minutes || "",
    payload.summary || "",
    payload.transcript || "",
    payload.recording_url || "",
    payload.detected_intent || "",
    payload.eval_json || ""
  ];
}

function jsonResponse(code, obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
