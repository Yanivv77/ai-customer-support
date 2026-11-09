import {
  BookOpen,
  Bot,
  CircleAlert,
  CircleCheck,
  FlaskConical,
  Mail,
  Play,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  SearchX,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation } from "react-router"

import { AddEntryForm } from "@/components/add-entry-form"
import { EmptyState, Page, PageHeader, Panel } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/lib/api"
import { sectionLabel } from "@/lib/format"
import { suggestTitle } from "@/lib/gaps"
import { useSimulate, type TrialEmail } from "@/lib/queries"
import type { Simulation } from "@/lib/types"
import { cn } from "@/lib/utils"

const EXAMPLES: { label: string; email: TrialEmail }[] = [
  {
    label: "Frame size",
    email: { subject: "Which size should I order?", body: "Hi,\n\nI'm 183 cm tall. Which frame size of the Carmel C1 fits me?\n\nThanks, Noa", has_attachments: false },
  },
  {
    label: "Cheapest bike",
    email: { subject: "Budget e-bike", body: "Hello, what is your cheapest e-bike and how much does it cost?", has_attachments: false },
  },
  {
    label: "Swollen battery",
    email: { subject: "Battery problem", body: "My battery got very hot while charging and now it looks swollen. What should I do?", has_attachments: false },
  },
  {
    label: "Refund",
    email: { subject: "Refund", body: "The bike is not what I expected. I want my money back.", has_attachments: false },
  },
  {
    label: "Not in the knowledge base",
    email: { subject: "Riding in the rain", body: "Hi, can I ride the F1 in heavy rain? Is it waterproof?", has_attachments: false },
  },
  {
    label: "Hebrew",
    email: { subject: "מידת שלדה", body: "שלום, אני בגובה 170 ס״מ. איזו מידה של Carmel C1 מתאימה לי?", has_attachments: false },
  },
]

const RULES: Record<string, string> = {
  "battery-safety": "Battery safety rule: a fixed safety message goes out, then a person takes over.",
  attachments: "Emails with attachments always go to a person.",
  "needs-human": "An always-escalate rule applies, so a person answers.",
  "agent-escalated": "The AI decided a person should answer.",
  "not-in-knowledge-base": "The knowledge base does not have the answer, so the AI does not guess.",
  "issue-rule": "A product problem that needs a person to arrange something.",
  "promises-action": "The draft promised something only a person can arrange.",
  "agent-reply": "The answer is in the knowledge base and safe to send.",
}

// Kept for as long as the app is open, so leaving the page does not lose the email.
let lastEmail: TrialEmail = EXAMPLES[0].email
let lastResult: Simulation | null = null

const seconds = (value: number | null | undefined) => (value == null ? "" : `${value.toFixed(1)}s`)

function Elapsed() {
  const [start] = useState(() => performance.now())
  const [now, setNow] = useState(start)
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(timer)
  }, [])
  return <span className="tabular-nums">{((now - start) / 1000).toFixed(1)}s</span>
}

function Step({
  icon: Icon,
  title,
  time,
  tone = "default",
  children,
}: {
  icon: LucideIcon
  title: string
  time?: string
  tone?: "default" | "good" | "warn" | "muted"
  children: React.ReactNode
}) {
  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      <span className="absolute top-8 bottom-0 left-[13px] w-px bg-border group-last:hidden" aria-hidden />
      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-full border bg-card",
          tone === "good" && "border-success/30 bg-success/10 text-success",
          tone === "warn" && "border-warning/30 bg-warning/10 text-warning",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="flex items-baseline justify-between gap-3 text-sm font-medium">
          {title}
          {time && <span className="text-xs font-normal text-muted-foreground tabular-nums">{time}</span>}
        </p>
        <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  )
}

function Check({ label, hit }: { label: string; hit: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded px-1.5 text-xs font-medium",
        hit ? "bg-warning/12 text-warning" : "bg-muted text-muted-foreground"
      )}
    >
      {hit ? <CircleAlert className="size-3.5" aria-hidden /> : <CircleCheck className="size-3.5" aria-hidden />}
      {label}
      <span className="sr-only">{hit ? ": yes" : ": no"}</span>
    </span>
  )
}

function Result({
  result,
  email,
  onRunAgain,
  running,
}: {
  result: Simulation
  email: TrialEmail
  onRunAgain: () => void
  running: boolean
}) {
  const { decision, classification, answer, sources, timings } = result
  const replies = decision.action === "reply"
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-3 rounded-md border px-4 py-3.5",
          replies ? "border-success/30 bg-success/8" : "border-warning/30 bg-warning/8"
        )}
      >
        <div className="flex gap-3">
          {replies ? (
            <Bot className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          ) : (
            <UserRound className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          )}
          <div>
            <p className="font-semibold">{replies ? "The AI would reply on its own" : "The AI would hand this to a person"}</p>
            <p className="mt-0.5 text-sm text-foreground/80">{RULES[result.rule] ?? decision.reason}</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">Decided in {seconds(timings.total)}</span>
      </div>

      {decision.knowledge_gap && (
        <div className="rounded-md border border-dashed border-warning/50 px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <SearchX className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <div className="text-sm">
                <p className="font-medium">Missing from the knowledge base</p>
                <p className="mt-0.5 text-foreground/80">{decision.knowledge_gap}</p>
              </div>
            </div>
            {added ? (
              <Button size="sm" onClick={onRunAgain} disabled={running} className="h-8 px-3">
                <RotateCcw aria-hidden />
                Run again
              </Button>
            ) : (
              !adding && (
                <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="h-8 px-3">
                  <BookOpen aria-hidden />
                  Add the answer
                </Button>
              )
            )}
          </div>
          {added && <p className="mt-2 pl-7 text-sm text-success">Added. Run the email again to see the AI use it.</p>}
          {adding && (
            <AddEntryForm
              className="mt-3"
              section={decision.section}
              title={suggestTitle(decision.knowledge_gap)}
              onCancel={() => setAdding(false)}
              onSaved={() => {
                setAdding(false)
                setAdded(true)
              }}
            />
          )}
        </div>
      )}

      <section aria-labelledby="email-preview" className="overflow-hidden rounded-md border bg-card">
        <header className="border-b bg-muted/40 px-4 py-2.5 text-sm">
          <h3 id="email-preview" className="flex items-center gap-2 font-medium">
            <Mail className="size-4 text-muted-foreground" aria-hidden />
            {replies ? "The reply the customer would get" : "The holding reply the customer would get"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            To customer@example.com · Subject: Re: {email.subject.trim() || "(no subject)"}
          </p>
        </header>
        <p dir="auto" className="px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap">
          {decision.reply}
        </p>
      </section>

      <section aria-labelledby="how-it-decided">
        <h3 id="how-it-decided" className="mb-3 text-sm font-semibold">
          How it decided
        </h3>
        <ol>
          <Step icon={ScanSearch} title="Read the email" time={seconds(timings.classify)}>
            {classification ? (
              <>
                Topic <span className="font-medium text-foreground">{sectionLabel(classification.section)}</span>, written in{" "}
                <span className="font-medium text-foreground">{classification.language}</span>.
                {classification.reason && <span className="mt-1 block">{classification.reason}</span>}
              </>
            ) : (
              "Classified the email."
            )}
          </Step>

          <Step icon={ShieldCheck} title="Checked the safety and escalation rules" tone={answer ? "default" : "warn"}>
            <span className="flex flex-wrap gap-1.5">
              <Check label="Battery safety" hit={!!classification?.battery_safety} />
              <Check label="Attachments" hit={result.rule === "attachments"} />
              <Check label="Needs a person" hit={!!classification?.needs_human && !classification.battery_safety} />
            </span>
            {!answer && <span className="mt-1.5 block">A rule decided, so the AI did not write an answer.</span>}
          </Step>

          <Step
            icon={BookOpen}
            title="Looked up the knowledge base"
            time={seconds(timings.agent)}
            tone={!answer ? "muted" : answer.enough_information ? "good" : "warn"}
          >
            {!answer ? (
              "Skipped."
            ) : (
              <>
                {sources.length > 0 && (
                  <span className="mb-1.5 flex flex-wrap gap-1.5">
                    {sources.map((source) => (
                      <span key={source} className="inline-flex h-6 items-center rounded border bg-card px-1.5 text-xs text-foreground">
                        {sectionLabel(source)}
                      </span>
                    ))}
                  </span>
                )}
                {answer.enough_information ? "Found the answer. " : "Did not find the answer. "}
                {answer.reasoning}
              </>
            )}
          </Step>

          <Step icon={replies ? CircleCheck : UserRound} title="Final decision" tone={replies ? "good" : "warn"}>
            {replies ? "Send the reply." : "Send a holding reply, then a person takes over."}{" "}
            {decision.proposed_action && decision.proposed_action !== "battery-safety" && (
              <span className="mt-1 block">
                <span className="font-medium text-warning">Suggested next step: </span>
                {decision.proposed_action}
              </span>
            )}
          </Step>
        </ol>
      </section>
    </div>
  )
}

export function TryEmailPage() {
  const location = useLocation()
  const { demo } = useSession()
  const fromLink = (location.state as { email?: TrialEmail } | null)?.email
  const [email, setEmail] = useState<TrialEmail>(fromLink ?? lastEmail)
  const [result, setResult] = useState<Simulation | null>(fromLink ? null : lastResult)
  const [ranEmail, setRanEmail] = useState<TrialEmail>(email)
  const simulate = useSimulate()

  useEffect(() => {
    lastEmail = email
  }, [email])

  function run(next: TrialEmail = email) {
    if (!next.body.trim() || simulate.isPending) return
    setRanEmail(next)
    simulate.mutate(next, {
      onSuccess: (data) => {
        lastResult = data
        setResult(data)
      },
    })
  }

  function pickExample(example: TrialEmail) {
    setEmail(example)
    setResult(null)
    simulate.reset()
  }

  return (
    <Page className="lg:h-[calc(100dvh-3rem)]">
      <PageHeader
        title="Try an email"
        description={
          demo
            ? "Write an email as a customer and see what the AI would do. In sample mode a simple stand-in answers, not the real AI."
            : "Write an email as a customer and see exactly what the AI would do. Nothing is sent and nothing is saved."
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Panel className="flex min-h-0 flex-col">
          <form
            className="flex min-h-0 flex-1 flex-col gap-4 p-5"
            onSubmit={(event) => {
              event.preventDefault()
              run()
            }}
          >
            <div>
              <p className="text-xs font-medium text-muted-foreground">Start from an example</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => pickExample(example.email)}
                    className={cn(
                      "h-7 rounded-md border px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      email.body === example.email.body && "border-primary/40 bg-primary/8 text-foreground"
                    )}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trial-from">From</Label>
              <Input id="trial-from" value="customer@example.com" readOnly className="h-9 bg-muted/50 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trial-subject">Subject</Label>
              <Input
                id="trial-subject"
                dir="auto"
                value={email.subject}
                maxLength={200}
                onChange={(event) => setEmail({ ...email, subject: event.target.value })}
                className="h-9"
              />
            </div>
            <div className="flex min-h-40 flex-1 flex-col gap-1.5">
              <Label htmlFor="trial-body">Email</Label>
              <Textarea
                id="trial-body"
                dir="auto"
                value={email.body}
                maxLength={10_000}
                onChange={(event) => setEmail({ ...email, body: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    run()
                  }
                }}
                className="min-h-40 flex-1 resize-none text-sm leading-relaxed"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={email.has_attachments}
                onChange={(event) => setEmail({ ...email, has_attachments: event.target.checked })}
                className="size-4 accent-primary"
              />
              The email has attachments
            </label>
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">Ctrl+Enter to run</p>
              <Button type="submit" disabled={!email.body.trim() || simulate.isPending} className="h-9 px-4">
                <Play aria-hidden />
                {simulate.isPending ? "Running" : "Run the AI"}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel className="min-h-80 overflow-y-auto">
          <div className="p-5">
            {simulate.isPending ? (
              <div role="status" className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FlaskConical className="size-5 animate-pulse" aria-hidden />
                </span>
                <p className="text-sm font-medium">
                  The AI is reading the email · <Elapsed />
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  It classifies the email, checks the safety and escalation rules, then looks up the knowledge base. This usually
                  takes 10 to 20 seconds.
                </p>
              </div>
            ) : simulate.error ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <CircleAlert className="size-5" aria-hidden />
                </span>
                <p className="text-sm font-medium">The AI could not answer</p>
                <p className="max-w-sm text-sm text-muted-foreground">{simulate.error.message}</p>
                <Button variant="outline" size="sm" onClick={() => run(ranEmail)} className="h-8 px-3">
                  Try again
                </Button>
              </div>
            ) : result ? (
              <Result result={result} email={ranEmail} running={simulate.isPending} onRunAgain={() => run(ranEmail)} />
            ) : (
              <EmptyState icon={FlaskConical} title="See what the AI would do">
                Pick an example or write your own email, then press "Run the AI". You get the reply, and every step of how it
                decided.
              </EmptyState>
            )}
          </div>
        </Panel>
      </div>
    </Page>
  )
}
