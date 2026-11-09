import { CircleAlert, RefreshCw, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { useCheckInbox } from "@/lib/queries"
import { cn } from "@/lib/utils"

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex w-full animate-rise flex-col gap-4", className)}>{children}</div>
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </header>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border bg-card shadow-card", className)}>{children}</section>
}

export function PanelHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium">Could not load this</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function CheckInboxButton() {
  const check = useCheckInbox()
  return (
    <Button onClick={() => check.mutate()} disabled={check.isPending} className="h-9 px-3.5">
      <RefreshCw className={cn(check.isPending && "animate-spin")} aria-hidden />
      {check.isPending ? "Checking inbox" : "Check inbox now"}
    </Button>
  )
}

/** A segmented filter. Counts are optional. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; count?: number }[]
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            option.value === value && "bg-card text-foreground shadow-card"
          )}
        >
          {option.label}
          {option.count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{option.count}</span>}
        </button>
      ))}
    </div>
  )
}
