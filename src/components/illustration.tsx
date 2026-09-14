"use client";

import Image from "next/image";
import { ILLUSTRATIONS, type IllustrationName } from "@/lib/illustrations";
import { cn } from "@/lib/utils";

export function Illustration({
  name,
  size,
  className,
  label,
}: {
  name: IllustrationName;
  size: number;
  className?: string;
  label?: string;
}) {
  const art = ILLUSTRATIONS[name];
  const height = Math.min(size, Math.round((size / art.width) * art.height));
  return (
    <Image
      src={art.src}
      alt={label ?? ""}
      width={art.width}
      height={art.height}
      unoptimized
      draggable={false}
      aria-hidden={label ? undefined : true}
      className={cn("max-h-full max-w-full object-contain", className)}
      style={{ width: size, height }}
    />
  );
}
