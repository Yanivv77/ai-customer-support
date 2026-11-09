import { ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Clock, Inbox, Mail, PartyPopper, UserRound, type LucideIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"

import { TopicBars, VolumeChart } from "@/components/charts"
import { CheckInboxButton, EmptyState, ErrorState, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/primitives"
import { StatusIcon } from "@/components/status-badge"
import { formatDuration, sectionLabel, timeAgo } from "@/lib/format"
import { fillDays, summarise } from "@/lib/metrics"
import { useEvents, useStats, useTicketList } from "@/lib/queries"
import { outcomeOf, type SupportEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

const DAYS = 14
const WAITING = { status: "escalated", q: "", limit: 5 } as const

/** Counts up to the value once, so a number landing reads as a result, not a jump. */
function useCountUp(target: number) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 700
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, Math.max(0, now - start) / duration)
      setValue(target * (1 - (1 - progress) ** 3))
      if (progress < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target])
  return value
}

type Trend = { text: string; direction: "up" | "down" | "flat"; good: boolean }

function Stat({
  icon: Icon,
  label,
  value,
  format,
  trend,
  note,
}: {
  icon: LucideIcon
  label: string
  value: number | null
  format: (value: number) => string
  trend?: Trend | null
  note: string
}) {
  const shown = useCountUp(value ?? 0)
  const Arrow = trend?.direction === "down" ? ArrowDownRight : ArrowUpRight
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <p className="mt-3 text-[1.75rem] font-semibold tracking-tight tabular-nums">{value === null ? "–" : format(shown)}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {trend && trend.direction !== "flat" && (
          <span className={cn("inline-flex items-center font-medium", trend.good ? "text-success" : "text-warning")}>
            <Arrow className="size-3.5" aria-hidden />
            {trend.text}
          </span>
        )}
        {note}
      </p>
    </Panel>
  )
}

function compare(current: number | null, previous: number | null, unit: "%" | "pts", higherIsBetter: boolean): Trend | null {
  if (current === null || previous === null || previous === 0) return null
  const change = unit === "%" ? ((current - previous) / previous) * 100 : (current - previous) * 100
  const rounded = Math.round(change)
  if (rounded === 0) return { text: "", direction: "flat", good: true }
  return {
    text: `${Math.abs(rounded)}${unit === "%" ? "%" : " pts"}`,
    direction: rounded > 0 ? "up" : "down",
    good: rounded > 0 === higherIsBetter,
  }
}

const FEED_TITLE = {
  answered: "Replied to the customer",
  escalated: "Handed to a person",
  skipped: "Skipped",
  failed: "Could not process",
  processing: "Working on a reply",
}

function FeedRow({ event }: { event: SupportEvent }) {
  const outcome = outcomeOf(event)
  return (
    <li className="flex gap-3 px-5 py-3">
      <StatusIcon status={outcome} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate font-medium">
            {FEED_TITLE[outcome]}
            {event.result?.section && <span className="font-normal text-muted-foreground"> · {sectionLabel(event.result.section)}</span>}
          </span>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.created_at}>
            {timeAgo(event.created_at)}
          </time>
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{event.error ?? event.result?.reason ?? ""}</p>
      </div>
    </li>
  )
}

const viewAll =
  "flex shrink-0 items-center gap-1 rounded text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"

export function OverviewPage() {
  const stats = useStats()
  const events = useEvents(5)
  const waiting = useTicketList(WAITING)

  const volume = useMemo(() => (stats.data ? fillDays(stats.data.days, DAYS) : []), [stats.data])
  const header = <PageHeader title="Overview" description="How the AI handled your support inbox." action={<CheckInboxButton />} />

  if (stats.error) {
    return (
      <Page>
        {header}
        <Panel>
          <ErrorState error={stats.error} onRetry={stats.refetch} />
        </Panel>
      </Page>
    )
  }

  if (!stats.data) {
    return (
      <Page>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-80 rounded-lg xl:col-span-2" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </Page>
    )
  }

  const current = summarise(stats.data.current)
  const previous = summarise(stats.data.previous)
  const hasVolume = volume.some((day) => day.answered + day.escalated > 0)
  const waitingCount = stats.data.waiting

  return (
    <Page>
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Mail}
          label="Emails handled"
          value={current.handled}
          format={(value) => Math.round(value).toString()}
          trend={compare(current.handled, previous.handled, "%", true)}
          note="last 7 days, vs the 7 before"
        />
        <Stat
          icon={Bot}
          label="Answered without a person"
          value={current.automationRate}
          format={(value) => `${Math.round(value * 100)}%`}
          trend={compare(current.automationRate, previous.automationRate, "pts", true)}
          note={`${current.answered} of ${current.handled} emails`}
        />
        <Stat icon={Clock} label="Median time to reply" value={current.medianSeconds} format={formatDuration} note="from email in to reply sent" />
        <Stat
          icon={UserRound}
          label="Waiting for a person"
          value={waitingCount}
          format={(value) => Math.round(value).toString()}
          note={waitingCount ? "tickets with a suggested next step" : "nothing needs you right now"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader title="Emails per day" description={`Last ${DAYS} days`} />
          {hasVolume ? (
            <VolumeChart days={volume} />
          ) : (
            <EmptyState icon={Mail} title="No emails yet">
              The chart fills in as customers write to your support address.
            </EmptyState>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="What customers ask about" description={`Tickets by topic, last ${DAYS} days`} />
          {stats.data.topics.length ? <TopicBars topics={stats.data.topics} /> : <EmptyState icon={Inbox} title="No tickets yet" />}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Waiting for a person"
            description="The AI stepped back and suggested what to do next"
            action={
              <Link to="/tickets" className={viewAll}>
                View all <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {waiting.error ? (
            <ErrorState error={waiting.error} onRetry={waiting.refetch} />
          ) : !waiting.data ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : waiting.data.items.length ? (
            <ul className="mt-3 divide-y border-t">
              {waiting.data.items.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    to={`/tickets/${ticket.id}`}
                    className="group flex items-start gap-3 px-5 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium" dir="auto">
                          {ticket.subject || "(no subject)"}
                        </span>
                        <time className="shrink-0 text-xs text-muted-foreground" dateTime={ticket.updated_at}>
                          {timeAgo(ticket.updated_at)}
                        </time>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{ticket.customer_email}</p>
                      {ticket.proposed_action && (
                        <p className="mt-1.5 line-clamp-2 text-sm text-foreground/80">
                          <span className="font-medium text-warning">Next step: </span>
                          {ticket.proposed_action}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={PartyPopper} title="All clear">
              No ticket is waiting for a person.
            </EmptyState>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Latest activity"
            description="Every email, and why the AI decided what it did"
            action={
              <Link to="/activity" className={viewAll}>
                View all <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {events.error ? (
            <ErrorState error={events.error} onRetry={events.refetch} />
          ) : !events.data ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : events.data.length ? (
            <ul className="mt-3 divide-y border-t">
              {events.data.map((event) => (
                <FeedRow key={event.id} event={event} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={Mail} title="No activity yet">
              Press "Check inbox now" to look for new emails.
            </EmptyState>
          )}
        </Panel>
      </div>
    </Page>
  )
}
