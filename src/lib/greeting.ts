export function todayGreeting(ownerName: string, hour = new Date().getHours()): string {
  const rawName = ownerName.trim();
  const name = rawName && rawName.toLowerCase() !== "me" ? rawName : null;
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${timeGreeting}, ${name}` : timeGreeting;
}
