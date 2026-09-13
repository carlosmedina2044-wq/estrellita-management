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
