export type LeaseLeadRow = {
  created_at: string;
  call_id: string;
  caller_phone: string;
  name?: string;
  email?: string;
  move_in_date?: string;
  unit_type?: string;
  lease_term?: string;
  budget?: string;
  pets?: string;
  notes?: string;
  tool_logged: boolean;
};

export type MaintenanceTicketRow = {
  created_at: string;
  call_id: string;
  caller_phone: string;
  unit_number?: string;
  issue_summary?: string;
  urgency?: string;
  access_ok?: string;
  notes?: string;
  tool_logged: boolean;
};

export type CallLogRow = {
  created_at: string;
  call_id: string;
  from?: string;
  to?: string;
  answered_by?: string;
  duration_minutes?: number | string;
  summary?: string;
  transcript?: string;
  recording_url?: string;
  detected_intent?: string;
  eval_json?: string;
};

export type SheetsWriter = {
  appendLeaseLead(row: LeaseLeadRow): Promise<void>;
  appendMaintenanceTicket(row: MaintenanceTicketRow): Promise<void>;
  appendCallLog(row: CallLogRow): Promise<void>;
};

