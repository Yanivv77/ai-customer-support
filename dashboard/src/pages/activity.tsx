import { ChevronRight, Lightbulb, ListChecks, Mail, SearchX } from "lucide-react"
import { Fragment, useMemo, useState } from "react"

import { CheckInboxButton, EmptyState, ErrorState, Page, PageHeader, Panel, Segmented, Skeleton } from "@/components/primitives"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatDuration, sectionLabel, timeAgo } from "@/lib/format"
import { useEvents } from "@/lib/queries"
import { outcomeOf, type Outcome, type SupportEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

type Filter = "all" | Outcome
const STEP = 100
const MAX = 500

function Detail({ icon: Icon, label, children, tone }: { icon: typeof Mail; label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div>
      <p className={cn("flex items-center gap-1.5 text-xs font-medium text-muted-foreground", tone)}>
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  )
}

function handledIn(event: SupportEvent) {
  if (!event.processed_at) return null
  return (new Date(event.processed_at).getTime() - new Date(event.created_at).getTime()) / 1000
}

function EventRows({ event }: { event: SupportEvent }) {
  const [open, setOpen] = useState(false)
  const outcome = outcomeOf(event)
  const result = event.result
  const seconds = handledIn(event)
  const panelId = `event-${event.id}`

  return (
    <Fragment>
      <tr onClick={() => setOpen(!open)} className={cn("cursor-pointer border-t transition-colors hover:bg-muted/60", open && "bg-muted/40")}>
        <td className="w-8 py-2.5 pl-3">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Hide details" : "Show details"}
            onClick={(click) => {
              click.stopPropagation()
              setOpen(!open)
            }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className={cn("size-4 transition-transform duration-150", open && "rotate-90")} aria-hidden />
          </button>
        </td>
        <td className="py-2.5 pr-4 whitespace-nowrap">
          <StatusBadge status={outcome} />
        </td>
        <td className="hidden py-2.5 pr-4 whitespace-nowrap text-muted-foreground md:table-cell">
          {result?.section ? sectionLabel(result.section) : "–"}
        </td>
        <td className={cn("max-w-0 truncate py-2.5 pr-4", outcome === "failed" && "text-destructive")}>
          {event.error ?? result?.reason ?? ""}
        </td>
        <td className="hidden py-2.5 pr-4 text-right whitespace-nowrap text-muted-foreground tabular-nums lg:table-cell">
          {seconds === null ? "–" : formatDuration(seconds)}
        </td>
        <td className="py-2.5 pr-4 text-right whitespace-nowrap text-muted-foreground">
          <time dateTime={event.created_at} title={formatDateTime(event.created_at)}>
            {timeAgo(event.created_at)}
          </time>
        </td>
      </tr>
      {open && (
        <tr id={panelId} className="bg-muted/40">
          <td />
          <td colSpan={5} className="pt-1 pr-4 pb-4">
            <div className="max-w-3xl space-y-4">
              {result?.knowledge_gap && (
                <Detail icon={SearchX} label="Missing from the knowledge base" tone="text-warning">
                  <p>{result.knowledge_gap}</p>
                </Detail>
              )}
              {result?.proposed_action && (
                <Detail icon={ListChecks} label="Suggested next step" tone="text-warning">
                  <p>{result.proposed_action}</p>
                </Detail>
              )}
              {(result?.reason || event.error) && (
                <Detail icon={Lightbulb} label="Why">
                  <p className={cn(event.error && "text-destructive")}>{event.error ?? result?.reason}</p>
                </Detail>
              )}
              {result?.reply && (
                <Detail icon={Mail} label="Email sent to the customer">
                  <p dir="auto" className="rounded-md border bg-card px-3.5 py-3 leading-relaxed whitespace-pre-wrap">
                    {result.reply}
                  </p>
                </Detail>
              )}
              <dl className="flex flex-wrap gap-x-8 gap-y-1 text-xs text-muted-foreground">
                <div>
                  <dt className="inline">Received </dt>
                  <dd className="inline text-foreground">{formatDateTime(event.created_at)}</dd>
                </div>
                <div>
                  <dt className="inline">Attempts </dt>
                  <dd className="inline text-foreground tabular-nums">{event.attempts}</dd>
                </div>
                <div>
                  <dt className="inline">Gmail message </dt>
                  <dd className="inline font-mono text-foreground">{event.gmail_message_id}</dd>
                </div>
              </dl>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

const HEAD = "py-2 pr-4 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"

export function ActivityPage() {
  const [limit, setLimit] = useState(STEP)
  const { data: events, error, refetch, isFetching } = useEvents(limit)
  const [filter, setFilter] = useState<Filter>("all")

  const counts = useMemo(() => {
    const totals: Record<Filter, number> = { all: 0, answered: 0, escalated: 0, skipped: 0, failed: 0, processing: 0 }
    for (const event of events ?? []) {
      totals.all += 1
      totals[outcomeOf(event)] += 1
    }
    return totals
  }, [events])

  const visible = useMemo(
    () => (filter === "all" ? events : events?.filter((event) => outcomeOf(event) === filter)),
    [events, filter]
  )

  return (
    <Page>
      <PageHeader
        title="Activity"
        description="Every email the AI looked at, and the reasoning behind each decision."
        action={<CheckInboxButton />}
      />

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
          <Segmented
            label="Filter by outcome"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "answered", label: "Answered", count: counts.answered },
              { value: "escalated", label: "Handed over", count: counts.escalated },
              { value: "skipped", label: "Skipped", count: counts.skipped },
              { value: "failed", label: "Failed", count: counts.failed },
            ]}
          />
          {events && <p className="text-xs text-muted-foreground">Latest {events.length} emails</p>}
        </div>

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !visible ? (
          <div className="p-4">
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className="mb-2 h-8" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={Mail} title={filter === "all" ? "No activity yet" : "Nothing with this outcome"}>
            {filter === "all" ? 'Press "Check inbox now" to look for new emails.' : "Try another filter."}
          </EmptyState>
        ) : (
          <table className="w-full table-auto text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-8" />
                <th scope="col" className={HEAD}>Outcome</th>
                <th scope="col" className={cn(HEAD, "hidden md:table-cell")}>Topic</th>
                <th scope="col" className={cn(HEAD, "w-full")}>Reasoning</th>
                <th scope="col" className={cn(HEAD, "hidden text-right lg:table-cell")}>Handled in</th>
                <th scope="col" className={cn(HEAD, "text-right")}>Received</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((event) => (
                <EventRows key={event.id} event={event} />
              ))}
            </tbody>
          </table>
        )}

        {events && events.length >= limit && limit < MAX && (
          <div className="border-t p-3 text-center">
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => setLimit(Math.min(MAX, limit + STEP))} className="h-8 px-3">
              {isFetching ? "Loading" : "Show older emails"}
            </Button>
          </div>
        )}
      </Panel>
    </Page>
  )
}
