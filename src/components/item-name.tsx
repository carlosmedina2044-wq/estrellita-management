"use client";

import { itemNameWithSize } from "@/lib/item-label";

export function ItemName({
  name,
  sizeSpec,
  className,
}: {
  name: string;
  sizeSpec?: string;
  className?: string;
}) {
  const size = sizeSpec?.trim();
  return (
    <span className={className}>
      {name}
      {size ? <span className="font-normal text-muted-foreground"> · {size}</span> : null}
    </span>
  );
}

export { itemNameWithSize };
