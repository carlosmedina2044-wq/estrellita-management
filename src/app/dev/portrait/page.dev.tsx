import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PortraitShotPage } from "./portrait-shot-page";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <PortraitShotPage />
    </Suspense>
  );
}
