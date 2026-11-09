import { BookOpen, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"

import { EmptyState, ErrorState, Page, PageHeader, Panel, Skeleton } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { sectionLabel } from "@/lib/format"
import { useKnowledgeBase, useSaveEntry } from "@/lib/queries"
import type { Entry } from "@/lib/types"
import { cn } from "@/lib/utils"

type Draft = { title: string; content: string }

function Editor({
  entry,
  draft,
  onChange,
  onDiscard,
}: {
  entry: Entry
  draft: Draft | undefined
  onChange: (draft: Draft) => void
  onDiscard: () => void
}) {
  const save = useSaveEntry()
  const value = draft ?? entry
  const dirty = draft !== undefined && (draft.title !== entry.title || draft.content !== entry.content)
  const valid = value.title.trim() !== "" && value.content.trim() !== ""
  const words = value.content.trim().split(/\s+/).filter(Boolean).length

  function submit() {
    if (!dirty || !valid || save.isPending) return
    save.mutate({ id: entry.id, title: value.title, content: value.content }, { onSuccess: onDiscard })
  }

  // Ctrl/Cmd+S saves, as people expect from an editor.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        submit()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex flex-1 flex-col gap-5 p-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{sectionLabel(entry.section)}</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="entry-title">Title</Label>
          <Input
            id="entry-title"
            value={value.title}
            onChange={(event) => onChange({ ...value, title: event.target.value })}
            className="h-10 text-base font-medium md:text-base"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="entry-content">What the AI should know</Label>
          <Textarea
            id="entry-content"
            dir="auto"
            value={value.content}
            onChange={(event) => onChange({ ...value, content: event.target.value })}
            aria-describedby="entry-hint"
            className="min-h-80 flex-1 resize-none font-mono text-sm leading-relaxed"
          />
          <p id="entry-hint" className="text-xs text-muted-foreground">
            Write it the way you would brief a new colleague. The AI answers only from what is written here.
          </p>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
        <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {dirty ? "Unsaved changes" : `${words} words`}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDiscard} disabled={!dirty || save.isPending} className="h-9 px-3.5">
            Discard
          </Button>
          <Button type="submit" disabled={!dirty || !valid || save.isPending} className="h-9 px-3.5">
            {save.isPending ? "Saving" : "Save changes"}
          </Button>
        </div>
      </footer>
    </form>
  )
}

export function KnowledgeBasePage() {
  const { entryId } = useParams()
  const { data: entries, error, refetch } = useKnowledgeBase()
  const [query, setQuery] = useState("")
  // Drafts are kept per entry, so switching entries never loses typing.
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const grouped = new Map<string, Entry[]>()
    for (const entry of entries ?? []) {
      if (needle && !`${entry.title} ${entry.content}`.toLowerCase().includes(needle)) continue
      grouped.set(entry.section, [...(grouped.get(entry.section) ?? []), entry])
    }
    return [...grouped]
  }, [entries, query])

  const selected = entries?.find((entry) => String(entry.id) === entryId) ?? null

  // Ask before closing the tab while there is unsaved typing.
  const hasDrafts = Object.keys(drafts).length > 0
  useEffect(() => {
    if (!hasDrafts) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [hasDrafts])

  function discard(id: number) {
    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== id)))
  }

  return (
    <Page className="lg:h-[calc(100dvh-3rem)]">
      <PageHeader title="Knowledge base" description="What the AI knows about your products and policies. Edits apply from the next email." />

      <Panel className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
          <div className="relative border-b p-4">
            <Search className="pointer-events-none absolute top-1/2 left-6.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search entries"
              aria-label="Search the knowledge base"
              className="h-9 pl-8"
            />
          </div>
          <nav aria-label="Knowledge base entries" className="max-h-72 min-h-0 flex-1 overflow-y-auto p-3 lg:max-h-none">
            {error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : !entries ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 7 }, (_, index) => (
                  <Skeleton key={index} className="h-8" />
                ))}
              </div>
            ) : sections.length === 0 ? (
              <EmptyState icon={BookOpen} title={entries.length ? "No entries match" : "The knowledge base is empty"}>
                {entries.length ? undefined : "Run scripts/seed_knowledge_base.py to load your markdown files."}
              </EmptyState>
            ) : (
              sections.map(([section, items]) => (
                <div key={section} className="mb-4 last:mb-0">
                  <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{sectionLabel(section)}</p>
                  <ul>
                    {items.map((entry) => (
                      <li key={entry.id}>
                        <Link
                          to={`/knowledge-base/${entry.id}`}
                          aria-current={entry.id === selected?.id ? "page" : undefined}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                            entry.id === selected?.id && "bg-accent font-medium hover:bg-accent"
                          )}
                        >
                          <span className="truncate">{entry.title}</span>
                          {drafts[entry.id] && (
                            <span className="size-1.5 shrink-0 rounded-full bg-primary">
                              <span className="sr-only">Unsaved changes</span>
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </nav>
        </div>

        {selected ? (
          <Editor
            key={selected.id}
            entry={selected}
            draft={drafts[selected.id]}
            onChange={(draft) => setDrafts((current) => ({ ...current, [selected.id]: draft }))}
            onDiscard={() => discard(selected.id)}
          />
        ) : (
          <div className="flex min-h-80 items-center justify-center">
            <EmptyState icon={BookOpen} title="Select an entry">
              Pick an entry to read or edit what the AI knows.
            </EmptyState>
          </div>
        )}
      </Panel>
    </Page>
  )
}
