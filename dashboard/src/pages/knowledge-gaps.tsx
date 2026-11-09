import { BookOpen, ChevronRight, CircleCheck, FlaskConical, MessageSquareText, SearchX } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"

import { AddEntryForm } from "@/components/add-entry-form"
import { EmptyState, ErrorState, Page, PageHeader, Panel, Segmented, Skeleton } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { formatDateTime, sectionLabel, timeAgo } from "@/lib/format"
import { groupGaps, suggestTitle, type GapGroup } from "@/lib/gaps"
import { useKnowledgeGaps } from "@/lib/queries"
import { cn } from "@/lib/utils"

function SummaryStat({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <Panel className="px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </Panel>
  )
}

function GapRows({ group, added, onAdded }: { group: GapGroup; added: boolean; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const latest = group.asks[0]
  const question = latest.question?.trim() ?? ""

  function tryAgain() {
    navigate("/try", {
      state: { email: { subject: latest.subject ?? "", body: question || group.missing, has_attachments: false } },
    })
  }

  return (
    <Fragment>
      <tr onClick={() => setOpen(!open)} className={cn("cursor-pointer border-t transition-colors hover:bg-muted/60", open && "bg-muted/40")}>
        <td className="w-8 py-3 pl-3 align-top">
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Hide the questions" : "Show the questions"}
            onClick={(click) => {
              click.stopPropagation()
              setOpen(!open)
            }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className={cn("size-4 transition-transform duration-150", open && "rotate-90")} aria-hidden />
          </button>
        </td>
        <td className="py-3 pr-4 align-top">
          <p className="font-medium">{group.missing}</p>
          {question && (
            <p dir="auto" className="mt-0.5 line-clamp-1 text-muted-foreground">
              “{question}”
            </p>
          )}
        </td>
        <td className="hidden py-3 pr-4 align-top whitespace-nowrap text-muted-foreground md:table-cell">{sectionLabel(group.section)}</td>
        <td className="py-3 pr-4 text-right align-top whitespace-nowrap tabular-nums">
          <span className={cn("font-medium", group.asks.length > 1 && "text-warning")}>{group.asks.length}</span>
          <span className="text-muted-foreground"> {group.asks.length === 1 ? "time" : "times"}</span>
        </td>
        <td className="hidden py-3 pr-4 text-right align-top whitespace-nowrap text-muted-foreground lg:table-cell">
          <time dateTime={group.lastAsked} title={formatDateTime(group.lastAsked)}>
            {timeAgo(group.lastAsked)}
          </time>
        </td>
        <td className="py-2.5 pr-3 text-right align-top whitespace-nowrap" onClick={(click) => click.stopPropagation()}>
          {added ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-6 items-center gap-1 rounded bg-success/10 px-1.5 text-xs font-medium text-success">
                <CircleCheck className="size-3.5" aria-hidden />
                Answer added
              </span>
              <Button size="sm" variant="outline" onClick={tryAgain} className="h-8 px-3">
                <FlaskConical aria-hidden />
                Test it
              </Button>
            </span>
          ) : (
            <Button
              size="sm"
              variant={adding ? "secondary" : "outline"}
              onClick={() => {
                setAdding(!adding)
                setOpen(true)
              }}
              className="h-8 px-3"
            >
              <BookOpen aria-hidden />
              Add answer
            </Button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/40">
          <td />
          <td colSpan={5} className="pr-4 pb-4">
            {adding && !added && (
              <AddEntryForm
                className="mb-4 max-w-3xl"
                section={group.section}
                title={suggestTitle(group.missing)}
                context={question || undefined}
                onCancel={() => setAdding(false)}
                onSaved={() => {
                  setAdding(false)
                  onAdded()
                }}
              />
            )}
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {group.asks.length === 1 ? "The email that asked" : `The ${group.asks.length} emails that asked`}
            </p>
            <ul className="flex max-w-3xl flex-col gap-2">
              {group.asks.map((ask) => (
                <li key={ask.event_id} className="rounded-md border bg-card px-3.5 py-2.5 text-sm">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
                    <span>
                      {ask.customer_email ?? "Unknown sender"} · {timeAgo(ask.created_at)}
                    </span>
                    {ask.ticket_id && (
                      <Link
                        to={`/tickets/${ask.ticket_id}?status=all`}
                        className="inline-flex items-center gap-1 rounded font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MessageSquareText className="size-3.5" aria-hidden />
                        Open ticket #{ask.ticket_id}
                      </Link>
                    )}
                  </p>
                  <p dir="auto" className="mt-1 whitespace-pre-wrap">
                    {ask.question ?? "The email text was not saved."}
                  </p>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

const HEAD = "py-2 pr-4 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"

export function KnowledgeGapsPage() {
  const { data: gaps, error, refetch } = useKnowledgeGaps()
  const [section, setSection] = useState("all")
  // Gaps answered in this visit. The emails stay in the history, so they stay listed, marked as done.
  const [added, setAdded] = useState<Set<string>>(new Set())

  const groups = useMemo(() => groupGaps(gaps ?? []), [gaps])
  const sections = useMemo(() => [...new Set(groups.map((group) => group.section ?? "other"))], [groups])
  const visible = section === "all" ? groups : groups.filter((group) => (group.section ?? "other") === section)
  const open = groups.filter((group) => !added.has(group.key))
  const repeated = open.filter((group) => group.asks.length > 1).length

  return (
    <Page>
      <PageHeader
        title="Knowledge gaps"
        description="Questions the AI handed to a person because the knowledge base did not have the answer. Add the answer once and the AI handles it from then on."
        action={
          <Button asChild variant="outline" className="h-9 px-3.5">
            <Link to="/try">
              <FlaskConical aria-hidden />
              Try an email
            </Link>
          </Button>
        }
      />

      {gaps && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryStat label="Missing answers" value={open.length} note="different things customers asked about" />
          <SummaryStat label="Emails affected" value={gaps.length} note="each one needed a person to reply" />
          <SummaryStat label="Asked more than once" value={repeated} note="the best ones to answer first" />
        </div>
      )}

      <Panel className="overflow-hidden">
        {sections.length > 1 && (
          <div className="border-b px-3 py-2.5">
            <Segmented
              label="Filter by topic"
              value={section}
              onChange={setSection}
              options={[
                { value: "all", label: "All", count: groups.length },
                ...sections.map((name) => ({
                  value: name,
                  label: sectionLabel(name),
                  count: groups.filter((group) => (group.section ?? "other") === name).length,
                })),
              ]}
            />
          </div>
        )}

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !gaps ? (
          <div className="p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="mb-2 h-10" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState icon={SearchX} title="No knowledge gaps">
            Every question so far was answered from the knowledge base. New gaps appear here when the AI cannot find an answer.
          </EmptyState>
        ) : (
          <table className="w-full table-auto text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-8" />
                <th scope="col" className={cn(HEAD, "w-full")}>
                  Missing information
                </th>
                <th scope="col" className={cn(HEAD, "hidden md:table-cell")}>
                  Topic
                </th>
                <th scope="col" className={cn(HEAD, "text-right")}>
                  Asked
                </th>
                <th scope="col" className={cn(HEAD, "hidden text-right lg:table-cell")}>
                  Last asked
                </th>
                <th scope="col" className={cn(HEAD, "text-right")}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((group) => (
                <GapRows
                  key={group.key}
                  group={group}
                  added={added.has(group.key)}
                  onAdded={() => setAdded((current) => new Set(current).add(group.key))}
                />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </Page>
  )
}
