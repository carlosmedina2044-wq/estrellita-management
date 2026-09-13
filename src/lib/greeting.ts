import { tActive } from "@/i18n";

export function todayGreeting(ownerName: string, hour = new Date().getHours()): string {
  const rawName = ownerName.trim();
  const name = rawName && rawName.toLowerCase() !== "me" ? rawName : null;
  const timeGreeting =
    hour < 12
      ? tActive("greeting.morning")
      : hour < 17
        ? tActive("greeting.afternoon")
        : tActive("greeting.evening");
  return name ? tActive("greeting.named", { greeting: timeGreeting, name }) : timeGreeting;
}
