import Image from "next/image";
import { cn } from "@/lib/utils";

const MARK = "/brand/cuidala-mark.webp";
const WORDMARK = "/brand/cuidala-wordmark.webp";
const WORDMARK_DARK = "/brand/cuidala-wordmark-dark.webp";

const LOCKUP = {
  sm: { className: "h-7", width: 102, height: 28 },
  md: { className: "h-8", width: 116, height: 32 },
  lg: { className: "h-11", width: 160, height: 44 },
} as const;

const MARK_SIZE = {
  sm: "size-7",
  md: "size-8",
  lg: "size-12",
} as const;

export function BrandMark({
  size = "md",
  className,
  alt = "",
}: {
  size?: keyof typeof MARK_SIZE;
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src={MARK}
      alt={alt}
      width={256}
      height={256}
      draggable={false}
      className={cn("shrink-0 object-contain", MARK_SIZE[size], className)}
    />
  );
}

export function BrandLockup({
  size = "md",
  className,
}: {
  size?: keyof typeof LOCKUP;
  className?: string;
}) {
  const box = LOCKUP[size];
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={WORDMARK}
        alt="Cuidala"
        width={box.width}
        height={box.height}
        draggable={false}
        className={cn(box.className, "w-auto dark:hidden")}
      />
      <Image
        src={WORDMARK_DARK}
        alt=""
        width={box.width}
        height={box.height}
        draggable={false}
        aria-hidden
        className={cn(box.className, "hidden w-auto dark:block")}
      />
    </span>
  );
}
