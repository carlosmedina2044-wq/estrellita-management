"use client";

export function TeachingTip({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-2.5">
      <p className="text-sm text-muted-foreground">{children}</p>
      <button type="button" className="mt-1 inline-flex min-h-11 items-center ui-caption font-medium text-primary" onClick={onDismiss}>
        Got it
      </button>
    </div>
  );
}
