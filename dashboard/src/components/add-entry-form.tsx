import { useId, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { sectionLabel } from "@/lib/format"
import { useCreateEntry, useKnowledgeBase } from "@/lib/queries"
import type { Entry } from "@/lib/types"
import { cn } from "@/lib/utils"

const ALWAYS = ["e-bikes", "batteries", "returns-and-warranty", "shipping"]

/** Writes a new knowledge base entry. Used where the AI found something missing. */
export function AddEntryForm({
  section,
  title,
  context,
  onSaved,
  onCancel,
  className,
}: {
  section: string | null
  title: string
  /** What the customer asked, shown as a reminder above the answer. */
  context?: string
  onSaved: (entry: Entry) => void
  onCancel: () => void
  className?: string
}) {
  const { data: entries } = useKnowledgeBase()
  const create = useCreateEntry()
  const sections = useMemo(
    () => [...new Set([...ALWAYS, ...(entries ?? []).map((entry) => entry.section), ...(section ? [section] : [])])].sort(),
    [entries, section]
  )
  const [form, setForm] = useState({ section: section && section !== "other" ? section : "e-bikes", title, content: "" })
  const valid = form.title.trim() !== "" && form.content.trim() !== ""
  const id = useId()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid || create.isPending) return
    create.mutate(form, {
      onSuccess: (entry) => {
        toast.success("Added to the knowledge base", { description: "The AI uses it from the next email on." })
        onSaved(entry)
      },
      onError: (error) => toast.error("Could not add the entry", { description: error.message }),
    })
  }

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-3 rounded-md border bg-card p-4", className)}>
      {context && (
        <p dir="auto" className="line-clamp-3 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Customer asked: </span>
          {context}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-section`}>Section</Label>
          <select
            id={`${id}-section`}
            value={form.section}
            onChange={(event) => setForm({ ...form, section: event.target.value })}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {sections.map((name) => (
              <option key={name} value={name}>
                {sectionLabel(name)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-title`}>Title</Label>
          <Input
            id={`${id}-title`}
            value={form.title}
            maxLength={200}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            className="h-9"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-content`}>The answer</Label>
        <Textarea
          id={`${id}-content`}
          dir="auto"
          autoFocus
          value={form.content}
          maxLength={20_000}
          onChange={(event) => setForm({ ...form, content: event.target.value })}
          placeholder="Write the facts the way you would brief a new colleague. The AI answers only from what is written here."
          className="min-h-28 text-sm leading-relaxed"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={create.isPending} className="h-9 px-3.5">
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || create.isPending} className="h-9 px-3.5">
          {create.isPending ? "Adding" : "Add to knowledge base"}
        </Button>
      </div>
    </form>
  )
}
