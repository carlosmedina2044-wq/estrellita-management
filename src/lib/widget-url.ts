/** True for the Lock Screen widget deep link `cuidala://today`. */
export function isCuidalaTodayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "cuidala:") return false;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\//, "").toLowerCase();
    return host === "today" || path === "today";
  } catch {
    return /^cuidala:\/\/today\/?$/i.test(url.trim());
  }
}

export type CuidalaRoute =
  | { kind: "today" }
  | { kind: "scan" }
  | { kind: "power-hour" }
  | { kind: "room"; id: string }
  | { kind: "appliance"; id: string };

/**
 * Parses the app's own deep links: `cuidala://today`, `cuidala://scan`,
 * `cuidala://power-hour` (the Control Center control),
 * `cuidala://room/<id>` and `cuidala://appliance/<id>` (Siri, widgets and
 * Visual Intelligence). Anything else is null.
 */
export function parseCuidalaUrl(url: string): CuidalaRoute | null {
  const match = /^cuidala:\/\/([^/?#]+)(?:\/([^?#]*))?(?:[?#].*)?$/i.exec(url.trim());
  if (!match) return null;
  const host = match[1].toLowerCase();
  let rest = match[2] ?? "";
  try {
    rest = decodeURIComponent(rest);
  } catch {
    return null;
  }
  rest = rest.replace(/\/+$/, "");
  if (host === "today" && !rest) return { kind: "today" };
  if (host === "scan" && !rest) return { kind: "scan" };
  if (host === "power-hour" && !rest) return { kind: "power-hour" };
  if ((host === "room" || host === "appliance") && rest && !rest.includes("/")) {
    return { kind: host, id: rest };
  }
  return null;
}
