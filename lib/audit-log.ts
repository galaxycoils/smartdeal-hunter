export const AUDIT_LOG_KEY = 'sdh:audit-log';
const AUDIT_LOG_LIMIT = 500;

export interface AuditLogEntry {
  ts: number;
  kind:
    | 'deep-check'
    | 'price-alert-enroll'
    | 'price-alert-disenroll'
    | 'price-alert-fired'
    | 'review-authenticity-evaluated';
  summary: string;
}

export async function appendAuditLog(entry: Omit<AuditLogEntry, 'ts'>): Promise<void> {
  const { optInAuditLog = false } = await chrome.storage.local.get({ optInAuditLog: false });
  if (!optInAuditLog) {
    return;
  }

  const stored = await chrome.storage.local.get(AUDIT_LOG_KEY);
  const entries = (stored[AUDIT_LOG_KEY] as AuditLogEntry[] | undefined) ?? [];
  const nextEntries = [...entries, { ...entry, ts: Date.now() }].slice(-AUDIT_LOG_LIMIT);
  await chrome.storage.local.set({ [AUDIT_LOG_KEY]: nextEntries });
}

export async function getAuditLogEntries(limit = 50): Promise<AuditLogEntry[]> {
  const stored = await chrome.storage.local.get(AUDIT_LOG_KEY);
  const entries = (stored[AUDIT_LOG_KEY] as AuditLogEntry[] | undefined) ?? [];
  return entries.slice(-limit);
}
