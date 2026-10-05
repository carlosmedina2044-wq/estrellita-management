"use client"

import * as React from "react"

import { useLocale } from "@/i18n/locale-provider"
import { cn } from "@/lib/utils"

const BASE =
  "h-11 w-full min-w-0 rounded-lg border border-transparent bg-secondary px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (type === "date") return <DateInput className={className} {...props} />
  return <input type={type} data-slot="input" className={cn(BASE, className)} {...props} />
}

/**
 * An empty date input renders as a blank, collapsed block in WebKit. This one
 * keeps the native picker but stays inside its container (min-w-0, w-full, no
 * native appearance) and shows "Choose a date" while it has no value.
 */
function DateInput({ className, onChange, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const { t } = useLocale()
  const controlled = props.value !== undefined
  const [typed, setTyped] = React.useState(() => String(props.defaultValue ?? ""))
  const empty = controlled ? String(props.value ?? "") === "" : typed === ""
  const alignEnd = typeof className === "string" && className.includes("text-right")

  return (
    <span className="relative block w-full min-w-0">
      <input
        type="date"
        data-slot="input"
        data-empty={empty ? "true" : undefined}
        className={cn(
          BASE,
          "block max-w-full min-w-0 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left data-[empty=true]:[&::-webkit-date-and-time-value]:opacity-0",
          className
        )}
        onChange={(event) => {
          setTyped(event.target.value)
          onChange?.(event)
        }}
        {...props}
      />
      {empty ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center truncate ui-body text-muted-foreground",
            alignEnd && "justify-end"
          )}
        >
          {t("common.chooseDate")}
        </span>
      ) : null}
    </span>
  )
}

export { Input }
