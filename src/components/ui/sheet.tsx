"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { prefersReducedMotion } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/i18n/locale-provider"

const SHEET_SPRING = "transform 320ms cubic-bezier(0.32,0.72,0,1)"
const DISMISS_VELOCITY = 0.6

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/40 duration-400 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:duration-150",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  size = "default",
  ref,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  size?: "default" | "form"
}) {
  const { t } = useLocale()
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const dragStartY = React.useRef<number | null>(null)
  const lastY = React.useRef(0)
  const lastTs = React.useRef(0)
  const velocity = React.useRef(0)
  const dragging = React.useRef(false)
  const reduceMotion = prefersReducedMotion()

  function setTranslateY(y: number, withTransition: boolean) {
    const node = contentRef.current
    if (!node) return
    node.style.transition = withTransition ? SHEET_SPRING : "none"
    node.style.transform = y === 0 ? "" : `translateY(${y}px)`
  }

  function canSwipe(event: React.PointerEvent) {
    if (side !== "bottom" || reduceMotion) return false
    if (!(event.target instanceof Element)) return false
    if (event.target.closest("input, textarea, select, [contenteditable='true']")) return false
    const scroller = event.target.closest("[data-keyboard-scroll], [data-slot='sheet-content']")
    if (scroller instanceof HTMLElement && scroller.scrollTop > 8) return false
    return true
  }

  function onSwipePointerDown(event: React.PointerEvent) {
    if (!canSwipe(event)) return
    dragging.current = true
    dragStartY.current = event.clientY
    lastY.current = event.clientY
    lastTs.current = event.timeStamp
    velocity.current = 0
    setTranslateY(0, false)
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onSwipePointerMove(event: React.PointerEvent) {
    if (!dragging.current || dragStartY.current == null) return
    const raw = event.clientY - dragStartY.current
    const y = raw < 0 ? raw * 0.3 : raw
    const dt = event.timeStamp - lastTs.current
    if (dt > 0) {
      velocity.current = (event.clientY - lastY.current) / dt
    }
    lastY.current = event.clientY
    lastTs.current = event.timeStamp
    setTranslateY(y, false)
  }

  function finishSwipe(event: React.PointerEvent) {
    if (!dragging.current || dragStartY.current == null) return
    const raw = Math.max(0, event.clientY - dragStartY.current)
    const height = contentRef.current?.offsetHeight ?? 1
    const shouldDismiss =
      velocity.current > DISMISS_VELOCITY || raw > height * 0.5
    dragging.current = false
    dragStartY.current = null
    if (shouldDismiss) {
      setTranslateY(height, true)
      closeRef.current?.click()
      return
    }
    setTranslateY(0, true)
  }

  const travelClass =
    side === "bottom"
      ? reduceMotion
        ? "duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        : "duration-400 [animation-timing-function:cubic-bezier(0.32,0.72,0,1)] data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom"
      : reduceMotion
        ? "duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        : "duration-400 [animation-timing-function:cubic-bezier(0.32,0.72,0,1)] data-open:animate-in data-open:fade-in-0 data-[side=left]:data-open:slide-in-from-left data-[side=right]:data-open:slide-in-from-right data-[side=top]:data-open:slide-in-from-top data-closed:animate-out data-closed:fade-out-0 data-[side=left]:data-closed:slide-out-to-left data-[side=right]:data-closed:slide-out-to-right data-[side=top]:data-closed:slide-out-to-top"

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        data-sheet-size={size}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-hidden bg-popover bg-clip-padding ui-body text-popover-foreground shadow-lg transition [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:rounded-t-3xl data-[side=bottom]:data-[sheet-size=form]:bottom-[var(--keyboard-inset,0px)] data-[side=bottom]:data-[sheet-size=default]:h-auto data-[side=bottom]:data-[sheet-size=form]:h-[min(92dvh,var(--visual-viewport-height,100dvh))] data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          travelClass,
          className
        )}
        {...props}
        ref={(node) => {
          contentRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event)
          onSwipePointerDown(event)
        }}
        onPointerMove={(event) => {
          onPointerMove?.(event)
          onSwipePointerMove(event)
        }}
        onPointerUp={(event) => {
          onPointerUp?.(event)
          finishSwipe(event)
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event)
          if (!dragging.current) return
          dragging.current = false
          dragStartY.current = null
          setTranslateY(0, true)
        }}
      >
        {side === "bottom" && !reduceMotion ? (
          <div
            className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-foreground/15"
            aria-hidden
          />
        ) : null}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              ref={closeRef}
              variant="ghost"
              size="icon"
              className="absolute top-1.5 right-2 size-11"
              aria-label={t("common.close")}
            >
              <X className="size-5" />
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-row items-center gap-2 px-4 py-2 pr-14", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex shrink-0 flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
