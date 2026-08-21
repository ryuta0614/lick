type LogFields = Record<string, unknown>;

const SECRET_KEY_PATTERN = /token|secret|password|apikey|api_key|credential/i;

function redact(fields: LogFields): LogFields {
  const redacted: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    redacted[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : value;
  }
  return redacted;
}

/** Minimal structured logger. Never logs secrets/tokens (CLAUDE.md section 31). */
export const logger = {
  info(message: string, fields: LogFields = {}): void {
    console.log(JSON.stringify({ level: "info", message, ...redact(fields), time: new Date().toISOString() }));
  },
  warn(message: string, fields: LogFields = {}): void {
    console.warn(JSON.stringify({ level: "warn", message, ...redact(fields), time: new Date().toISOString() }));
  },
  error(message: string, fields: LogFields = {}): void {
    console.error(JSON.stringify({ level: "error", message, ...redact(fields), time: new Date().toISOString() }));
  },
};
