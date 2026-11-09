import { ArrowLeft, Check, Inbox, PartyPopper, ListChecks, MessagesSquare, RotateCcw, Search, Send, Sparkles, UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useParams, useSearchParams } from "react-router"

import { EmptyState, ErrorState, Page, PageHeader, Panel, Segmented, Skeleton } from "@/components/primitives"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime, initials, sectionLabel, timeAgo } from "@/lib/format"
import { useDebounced } from "@/lib/hooks"
import { useMessages, useSendReply, useTicket, useTicketAction, useTicketList } from "@/lib/queries"
import type { Message, Ticket, TicketStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

type Filter = "all" | "escalated" | "answered" | "resolved"
const FILTERS: Filter[] = ["escalated", "all", "answered", "resolved"]
// The inbox opens on what needs a person; the other views are one click away.
const DEFAULT_FILTER: Filter = "escalated"
const PAGE_SIZE = 50

function Avatar({ email }: { email: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground" aria-hidden>
      {initials(email)}
    </span>
  )
}

function TicketItem({ ticket, search }: { ticket: Ticket; search: string }) {
  return (
    <li>
      <NavLink
        to={{ pathname: `/tickets/${ticket.id}`, search }}
        className={({ isActive }) =>
          cn(
            "flex gap-3 border-l-2 border-transparent px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60",
            isActive && "border-primary bg-accent/60 hover:bg-accent/60"
          )
        }
      >
        <Avatar email={ticket.customer_email} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{ticket.customer_email}</span>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={ticket.updated_at}>
              {timeAgo(ticket.updated_at)}
            </time>
          </p>
          <p className="mt-0.5 truncate text-sm text-foreground/80" dir="auto">
            {ticket.subject || "(no subject)"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            {ticket.category && <span className="truncate text-xs text-muted-foreground">{sectionLabel(ticket.category)}</span>}
          </div>
        </div>
      </NavLink>
    </li>
  )
}

function MessageCard({ message }: { message: Message }) {
  const ours = message.direction === "out"
  const byTeam = message.sent_by === "agent"
  const Author = byTeam ? UserRound : Sparkles
  return (
    <li className={cn("flex max-w-[85%] flex-col gap-1", ours ? "items-end self-end" : "items-start self-start")}>
      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        {ours && <Author className="size-3.5 text-primary" aria-hidden />}
        <span className="font-medium text-foreground/80">{!ours ? message.from_address : byTeam ? "Your team" : "AI reply"}</span>
        <time dateTime={message.created_at} title={formatDateTime(message.created_at)}>
          {timeAgo(message.created_at)}
        </time>
      </p>
      <p
        dir="auto"
        className={cn(
          "rounded-lg border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          ours ? "border-primary/25 bg-primary/8" : "bg-card"
        )}
      >
        {message.body}
      </p>
    </li>
  )
}

function Composer({ ticket, draft, onDraft }: { ticket: Ticket; draft: string; onDraft: (text: string) => void }) {
  const send = useSendReply(ticket)
  const empty = draft.trim() === ""

  function submit(resolve: boolean) {
    if (empty || send.isPending) return
    send.mutate({ body: draft, resolve }, { onSuccess: () => onDraft("") })
  }

  return (
    <form
      className="border-t bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit(false)
      }}
    >
      <label htmlFor="reply" className="text-xs font-medium text-muted-foreground">
        Reply to {ticket.customer_email}
      </label>
      <Textarea
        id="reply"
        dir="auto"
        value={draft}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={(event) => {
          // Ctrl/Cmd+Enter sends, like a mail client.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            submit(false)
          }
        }}
        placeholder="Write your reply. It is sent as an email in the same thread."
        maxLength={10_000}
        disabled={send.isPending}
        className="mt-1.5 max-h-60 min-h-24 text-sm leading-relaxed"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Sent to the customer as an email right away. Ctrl+Enter to send.</p>
        <div className="flex gap-2">
          {ticket.status !== "resolved" && (
            <Button type="button" variant="outline" disabled={empty || send.isPending} onClick={() => submit(true)} className="h-9 px-3.5">
              <Check aria-hidden />
              Send and resolve
            </Button>
          )}
          <Button type="submit" disabled={empty || send.isPending} className="h-9 px-3.5">
            <Send aria-hidden />
            {send.isPending ? "Sending" : "Send reply"}
          </Button>
        </div>
      </div>
    </form>
  )
}

function Conversation({
  ticket,
  backTo,
  draft,
  onDraft,
}: {
  ticket: Ticket
  backTo: string
  draft: string
  onDraft: (text: string) => void
}) {
  const { data: messages, error, refetch } = useMessages(ticket.id)
  const action = useTicketAction(ticket)
  const end = useRef<HTMLDivElement>(null)

  // Open on the newest message, and follow new ones as they arrive.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages?.length])

  const isOpen = ticket.status !== "resolved"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b px-5 py-4">
        <Link
          to={backTo}
          className="mb-3 inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden /> All tickets
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold" dir="auto">
              {ticket.subject || "(no subject)"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {ticket.customer_email}
              {ticket.category && ` · ${sectionLabel(ticket.category)}`}
              {` · #${ticket.id}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            {isOpen ? (
              <Button variant="outline" size="sm" disabled={action.isPending} onClick={() => action.mutate("resolve")} className="h-8 px-3">
                <Check aria-hidden />
                Resolve
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={action.isPending} onClick={() => action.mutate("reopen")} className="h-8 px-3">
                <RotateCcw aria-hidden />
                Reopen
              </Button>
            )}
          </div>
        </div>
        {ticket.proposed_action && ticket.status === "escalated" && (
          <div className="mt-4 flex gap-3 rounded-lg border border-warning/30 bg-warning/8 px-3.5 py-3">
            <ListChecks className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">Suggested next step</p>
              <p className="mt-0.5 text-foreground/80">{ticket.proposed_action}</p>
            </div>
          </div>
        )}
      </header>

      <div className="min-h-40 flex-1 overflow-y-auto bg-muted/30 px-5 py-5">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !messages ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-20 w-2/3 rounded-lg" />
            <Skeleton className="h-28 w-2/3 self-end rounded-lg" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="No messages saved for this ticket" />
        ) : (
          <ol className="flex flex-col gap-5">
            {messages.map((message) => (
              <MessageCard key={message.id} message={message} />
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>

      <Composer ticket={ticket} draft={draft} onDraft={onDraft} />
    </div>
  )
}

export function TicketsPage() {
  const params = useParams()
  const ticketId = params.ticketId && /^\d+$/.test(params.ticketId) ? Number(params.ticketId) : null
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE_SIZE)
  // Unsent replies are kept per ticket, so opening another ticket never loses typing.
  const [drafts, setDrafts] = useState<Record<number, string>>({})

  // The filter lives in the URL, so a filtered inbox can be linked to and survives a reload.
  const requested = searchParams.get("status") as Filter | null
  const filter: Filter = requested && FILTERS.includes(requested) ? requested : DEFAULT_FILTER
  const search = searchParams.toString() ? `?${searchParams}` : ""
  const q = useDebounced(query.trim())

  const list = useTicketList({ status: filter === "all" ? null : (filter as TicketStatus), q, limit })
  const selected = useTicket(ticketId)

  const counts = list.data?.counts ?? {}
  const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0)
  const matching = filter === "all" ? total : (counts[filter] ?? 0)
  const items = list.data?.items
  const count = (value: number | undefined) => (list.data ? (value ?? 0) : undefined)

  function changeFilter(value: Filter) {
    setLimit(PAGE_SIZE)
    setSearchParams(value === DEFAULT_FILTER ? {} : { status: value }, { replace: true })
  }

  return (
    <Page className="lg:h-[calc(100dvh-3rem)]">
      <PageHeader title="Tickets" description="Every conversation. Reply yourself, or close a ticket to hand the thread back to the AI." />

      <Panel className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className={cn("flex min-h-0 flex-col lg:border-r", ticketId !== null && "hidden lg:flex")}>
          <div className="flex flex-col gap-3 border-b p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setLimit(PAGE_SIZE)
                }}
                placeholder="Search by customer or subject"
                aria-label="Search tickets"
                className="h-9 pl-8"
              />
            </div>
            <Segmented
              label="Filter by status"
              value={filter}
              onChange={changeFilter}
              options={[
                { value: "escalated", label: "Waiting", count: count(counts.escalated) },
                { value: "all", label: "All", count: list.data ? total : undefined },
                { value: "answered", label: "Answered", count: count(counts.answered) },
                { value: "resolved", label: "Done", count: count(counts.resolved) },
              ]}
            />
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto transition-opacity", list.isPlaceholderData && "opacity-60")}>
            {list.error ? (
              <ErrorState error={list.error} onRetry={list.refetch} />
            ) : !items ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-20" />
                ))}
              </div>
            ) : items.length === 0 && filter === "escalated" && !q ? (
              <EmptyState icon={PartyPopper} title="All clear">
                No ticket is waiting for a person. Everything else is under All.
              </EmptyState>
            ) : items.length === 0 ? (
              <EmptyState icon={Inbox} title={q || filter !== "all" ? "No tickets match" : "No tickets yet"}>
                {q || filter !== "all" ? "Try a different search or filter." : "Tickets appear here when customers email you."}
              </EmptyState>
            ) : (
              <>
                <ul className="divide-y">
                  {items.map((ticket) => (
                    <TicketItem key={ticket.id} ticket={ticket} search={search} />
                  ))}
                </ul>
                {items.length < matching && (
                  <div className="border-t p-3 text-center">
                    <Button variant="outline" size="sm" disabled={list.isFetching} onClick={() => setLimit(limit + PAGE_SIZE)} className="h-8 px-3">
                      {list.isFetching ? "Loading" : `Show more (${matching - items.length} left)`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className={cn("min-h-0 lg:block", ticketId === null && "hidden")}>
          {selected.data ? (
            <Conversation
              key={selected.data.id}
              ticket={selected.data}
              backTo={`/tickets${search}`}
              draft={drafts[selected.data.id] ?? ""}
              onDraft={(text) => setDrafts((current) => ({ ...current, [selected.data.id]: text }))}
            />
          ) : selected.error ? (
            <div className="flex h-full items-center justify-center">
              <ErrorState error={selected.error} onRetry={selected.refetch} />
            </div>
          ) : ticketId !== null ? (
            <div className="space-y-4 p-5">
              <Skeleton className="h-12 w-1/2" />
              <Skeleton className="h-28 w-2/3" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState icon={MessagesSquare} title="Select a ticket">
                Pick a conversation on the left to read it and reply.
              </EmptyState>
            </div>
          )}
        </div>
      </Panel>
    </Page>
  )
}
