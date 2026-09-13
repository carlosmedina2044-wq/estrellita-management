import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <BrandLockup size="sm" />
      <h1 className="ui-heading mt-5 ui-display font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">That screen isn’t part of Cuidala.</p>
      <Link href="/" className="mt-6 ui-body font-medium text-primary">
        Back to Home
      </Link>
    </div>
  );
}
