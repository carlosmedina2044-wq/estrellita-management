const PII = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b\d{5}(?:-\d{4})?\b/g,
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
];

export function redact(value: string): string {
  return PII.reduce((text, pattern) => text.replace(pattern, "[redacted]"), value);
}

export function logEvent(event: string, fields: Record<string, unknown> = {}) {
  const safe = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      typeof value === "string" ? redact(value) : value,
    ]),
  );
  console.info(JSON.stringify({ ts: new Date().toISOString(), event, ...safe }));
}
