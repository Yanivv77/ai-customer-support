import { Archive, CircleAlert, CircleCheck, CircleDashed, LoaderCircle, MinusCircle, UserRound, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type Tone = { label: string; icon: LucideIcon; className: string }

// Every state carries an icon and a word, so colour is never the only signal.
const TONES: Record<string, Tone> = {
  answered: { label: "Answered by AI", icon: CircleCheck, className: "bg-success/10 text-success" },
  escalated: { label: "Needs a person", icon: UserRound, className: "bg-warning/12 text-warning" },
  resolved: { label: "Resolved", icon: Archive, className: "bg-muted text-muted-foreground" },
  failed: { label: "Failed", icon: CircleAlert, className: "bg-destructive/10 text-destructive" },
  skipped: { label: "Skipped", icon: MinusCircle, className: "bg-muted text-muted-foreground" },
  processing: { label: "Working", icon: LoaderCircle, className: "bg-primary/10 text-primary" },
  open: { label: "Open", icon: CircleDashed, className: "bg-primary/10 text-primary" },
}

/** The round, icon-only form, for timelines. The label stays available to screen readers. */
export function StatusIcon({ status, className }: { status: string; className?: string }) {
  const tone = TONES[status] ?? TONES.open
  const Icon = tone.icon
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", tone.className, className)}>
      <Icon className={cn("size-4", status === "processing" && "animate-spin")} aria-hidden />
      <span className="sr-only">{tone.label}</span>
    </span>
  )
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = TONES[status] ?? { ...TONES.open, label: status }
  const Icon = tone.icon
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-xs font-medium whitespace-nowrap",
        tone.className,
        className
      )}
    >
      <Icon className={cn("size-3.5", status === "processing" && "animate-spin")} aria-hidden />
      {tone.label}
    </span>
  )
}
