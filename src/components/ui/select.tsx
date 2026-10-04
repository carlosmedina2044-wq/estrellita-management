"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * A native <select> wearing the app's field styling.
 *
 * The API matches the Radix-style composition this app already used
 * (Select > SelectTrigger/SelectValue + SelectContent > SelectItem), so no
 * call site changed, but what opens on tap is now the system picker: the
 * wheel or menu iOS users already know, with its own haptics, Dynamic Type,
 * Dark Mode and VoiceOver behaviour, instead of a hand-built popover.
 *
 * The visible trigger is drawn; the real <select> sits invisibly over it and
 * takes the tap. It lives in SelectContent so the options stay declared the
 * same way, and reports its chosen label back so SelectValue can show it.
 */

type SelectContextValue = {
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
  label: string
  setLabel: (label: string) => void
  ariaLabel: string | undefined
  setAriaLabel: (label: string | undefined) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelect(): SelectContextValue {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error("Select parts must be used inside <Select>")
  return context
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const [inner, setInner] = React.useState(defaultValue ?? "")
  const [label, setLabel] = React.useState("")
  const [ariaLabel, setAriaLabel] = React.useState<string | undefined>(undefined)
  const controlled = value !== undefined
  const current = controlled ? (value ?? "") : inner

  const context = React.useMemo<SelectContextValue>(
    () => ({
      value: current,
      onValueChange: (next) => {
        if (!controlled) setInner(next)
        onValueChange?.(next)
      },
      disabled,
      label,
      setLabel,
      ariaLabel,
      setAriaLabel,
    }),
    [current, controlled, onValueChange, disabled, label, ariaLabel],
  )

  return (
    <SelectContext.Provider value={context}>
      <div data-slot="select" className="relative flex w-full">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

function SelectValue({
  placeholder,
  children,
  className,
}: {
  placeholder?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const { value, label } = useSelect()
  const shown = value ? (children ?? label) : placeholder
  const isPlaceholder = !value
  return (
    <span
      data-slot="select-value"
      className={cn("min-w-0 truncate", isPlaceholder && "text-muted-foreground", className)}
    >
      {shown}
    </span>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  "aria-label": ariaLabel,
}: {
  className?: string
  size?: "sm" | "default"
  children?: React.ReactNode
  "aria-label"?: string
  [key: string]: unknown
}) {
  const { disabled, setAriaLabel } = useSelect()
  React.useLayoutEffect(() => {
    setAriaLabel(ariaLabel)
  }, [ariaLabel, setAriaLabel])

  return (
    <div
      data-slot="select-trigger"
      data-size={size}
      aria-hidden
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors select-none data-[size=default]:h-11 data-[size=sm]:h-11 data-[size=sm]:rounded-[min(var(--radius-md),10px)] dark:bg-input/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        disabled && "opacity-50",
        className,
      )}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </div>
  )
}

function SelectContent({ children }: { children?: React.ReactNode; [key: string]: unknown }) {
  const { value, onValueChange, disabled, setLabel, ariaLabel } = useSelect()
  const ref = React.useRef<HTMLSelectElement>(null)

  // After every render, tell SelectValue what the chosen option reads as.
  React.useLayoutEffect(() => {
    const chosen = ref.current?.selectedOptions[0]
    setLabel(value && chosen ? chosen.text : "")
  })

  return (
    <select
      ref={ref}
      data-slot="select-content"
      aria-label={ariaLabel}
      disabled={disabled}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      // 16px keeps WKWebView from zooming the page when the picker opens.
      className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-lg border-0 bg-transparent text-[16px] opacity-0 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:[color:transparent]"
    >
      {value ? null : <option value="" disabled hidden />}
      {children}
    </select>
  )
}

function SelectGroup({ children }: { children?: React.ReactNode; className?: string }) {
  let label = ""
  const rest: React.ReactNode[] = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === SelectLabel) {
      label = textOf((child.props as { children?: React.ReactNode }).children)
    } else {
      rest.push(child)
    }
  })
  return <optgroup label={label}>{rest}</optgroup>
}

function SelectLabel({ children }: { children?: React.ReactNode; className?: string }) {
  // Only meaningful as the first child of a SelectGroup, which reads it as the
  // group's label; rendered alone it would be invalid inside <select>.
  void children
  return null
}

function SelectItem({
  value,
  disabled,
  children,
}: {
  value: string
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}) {
  return (
    <option value={value} disabled={disabled}>
      {textOf(children)}
    </option>
  )
}

function SelectSeparator() {
  return null
}

function SelectScrollUpButton() {
  return null
}

function SelectScrollDownButton() {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
