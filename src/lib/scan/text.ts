/** Small text helpers shared by the parser and the serial decoders. */

export function cleanLine(line: string): string {
  return line
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Digit look-alikes. Only used where the position is known to be a digit
 * (a serial slot that is always numeric, a token that is otherwise all digits).
 * O -> 0 and I / L -> 1. Nothing else: B/8 and S/5 swaps are too easy to get wrong.
 */
export function toDigits(value: string): string {
  return value.replace(/[Oo]/g, "0").replace(/[IiLl|]/g, "1");
}

/** A token made only of digits and O/I/l look-alikes, with at least one real digit, is a number. */
export function fixNumericLookalikes(token: string): string {
  if (/^[0-9OIl|]+$/i.test(token) && /[0-9]/.test(token)) return toDigits(token);
  return token;
}

export function isPlausibleYear(year: number, now: Date, earliest = 1970): boolean {
  return Number.isInteger(year) && year >= earliest && year <= now.getFullYear();
}

/** Two-digit year to four digits: 00..(this year + 1) are 20xx, anything after is 19xx. */
export function expandYear(yy: number, now: Date): number {
  return yy <= (now.getFullYear() % 100) + 1 ? 2000 + yy : 1900 + yy;
}
