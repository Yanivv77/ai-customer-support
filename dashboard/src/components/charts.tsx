import { useState } from "react"

import { formatDay, formatWeekday, sectionLabel } from "@/lib/format"
import type { DayBucket } from "@/lib/metrics"
import type { TopicCount } from "@/lib/types"
import { cn } from "@/lib/utils"

function niceMax(value: number) {
  const steps = [4, 6, 8, 10, 12, 16, 20, 30, 40, 50, 60, 80, 100]
  return steps.find((step) => step >= value) ?? Math.ceil(value / 50) * 50
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[3px]", className)} aria-hidden />
      {label}
    </span>
  )
}

/** Emails per day, stacked: answered by the AI at the base, handed to a person on top. */
export function VolumeChart({ days }: { days: DayBucket[] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = niceMax(Math.max(1, ...days.map((day) => day.answered + day.escalated)))
  const ticks = [max, max / 2, 0]

  return (
    <figure className="px-5 pb-5">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 pt-3 text-xs text-muted-foreground">
        <LegendItem className="bg-chart-1" label="Answered by AI" />
        <LegendItem className="bg-chart-2" label="Handed to a person" />
      </figcaption>

      <div className="relative mt-4 h-44" onMouseLeave={() => setActive(null)}>
        {ticks.map((tick, index) => (
          <div
            key={tick}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ top: `${(index / (ticks.length - 1)) * 100}%`, transform: "translateY(-50%)" }}
            aria-hidden
          >
            <span className="w-5 text-right text-[11px] text-muted-foreground tabular-nums">{tick}</span>
            <span className={cn("h-px flex-1", tick === 0 ? "bg-border" : "bg-border/60")} />
          </div>
        ))}

        <div className="absolute inset-y-0 right-0 left-7 flex items-end gap-1 sm:gap-2">
          {days.map((day, index) => {
            const total = day.answered + day.escalated
            const edge = index < 2 ? "left-0" : index > days.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
            return (
              <button
                key={day.date.toISOString()}
                type="button"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`${formatWeekday(day.date)}: ${day.answered} answered by AI, ${day.escalated} handed to a person`}
                className="group relative flex h-full flex-1 cursor-default flex-col justify-end outline-none"
              >
                <span
                  className={cn(
                    "mx-auto flex w-full max-w-12 origin-bottom animate-grow flex-col gap-0.5 transition-opacity",
                    active !== null && active !== index && "opacity-45",
                    "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-card"
                  )}
                  style={{ height: `${(total / max) * 100}%`, animationDelay: `${index * 25}ms` }}
                >
                  {day.escalated > 0 && <span className="rounded-t-[2px] bg-chart-2" style={{ flexGrow: day.escalated }} />}
                  {day.answered > 0 && (
                    <span className={cn("bg-chart-1", day.escalated === 0 && "rounded-t-[2px]")} style={{ flexGrow: day.answered }} />
                  )}
                </span>

                {active === index && (
                  <span
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute z-10 mb-2 w-max rounded-lg border bg-popover px-3 py-2 text-left text-xs shadow-lg",
                      edge
                    )}
                    style={{ bottom: `min(${(total / max) * 100}%, calc(100% - 5rem))` }}
                  >
                    <span className="block font-medium text-foreground">{formatWeekday(day.date)}</span>
                    <span className="mt-1.5 flex items-center justify-between gap-4 text-muted-foreground">
                      <LegendItem className="bg-chart-1" label="Answered by AI" />
                      <span className="font-medium text-foreground tabular-nums">{day.answered}</span>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-4 text-muted-foreground">
                      <LegendItem className="bg-chart-2" label="Handed to a person" />
                      <span className="font-medium text-foreground tabular-nums">{day.escalated}</span>
                    </span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-1 pl-7 sm:gap-2" aria-hidden>
        {days.map((day, index) => (
          <span key={day.date.toISOString()} className="flex-1 text-center text-[11px] whitespace-nowrap text-muted-foreground">
            {(days.length - 1 - index) % 3 === 0 ? formatDay(day.date) : ""}
          </span>
        ))}
      </div>
    </figure>
  )
}

/** Tickets per topic. One measure, so one colour; the share answered by AI is written out. */
export function TopicBars({ topics }: { topics: TopicCount[] }) {
  const max = Math.max(1, ...topics.map((topic) => topic.total))
  return (
    <ul className="flex flex-col gap-4 px-5 pt-4 pb-5">
      {topics.map((topic, index) => (
        <li key={topic.section}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{sectionLabel(topic.section)}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">{topic.total}</span>
              {" · "}
              {Math.round((topic.answered / topic.total) * 100)}% by AI
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-muted">
            <div
              className="h-full origin-left animate-[grow-x_0.6s_cubic-bezier(0.22,1,0.36,1)_both] rounded-full bg-chart-1"
              style={{ width: `${(topic.total / max) * 100}%`, animationDelay: `${index * 60}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
