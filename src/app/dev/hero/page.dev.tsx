import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HeroShotPage } from "./hero-shot-page";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <HeroShotPage />
    </Suspense>
  );
}
