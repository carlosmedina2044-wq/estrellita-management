export function itemNameWithSize(name: string, sizeSpec?: string): string {
  const size = sizeSpec?.trim();
  return size ? `${name} · ${size}` : name;
}

export function sizePlaceholder(itemName: string): string {
  const name = itemName.toLowerCase();
  if (/batter/.test(name)) return "CR2032";
  if (/bulb|lamp/.test(name)) return "Type A19";
  return "16x25x1";
}
