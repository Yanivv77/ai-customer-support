export type EventStatus = "processing" | "processed" | "skipped" | "failed"
export type TicketStatus = "open" | "answered" | "escalated" | "resolved"

/** What the pipeline stores in events.result: a Decision, or a skip reason. */
export type EventResult = {
  action?: "reply" | "escalate"
  section?: string
  reply?: string
  reason?: string
  proposed_action?: string | null
  /** What the knowledge base was missing, when that is why the email was handed over. */
  knowledge_gap?: string | null
}

export type SupportEvent = {
  id: number
  gmail_message_id: string
  status: EventStatus
  attempts: number
  error: string | null
  result: EventResult | null
  created_at: string
  processed_at: string | null
}

export type Ticket = {
  id: number
  subject: string
  customer_email: string
  category: string | null
  status: TicketStatus
  proposed_action: string | null
  created_at: string
  updated_at: string
}

export type Message = {
  id: number
  direction: "in" | "out"
  from_address: string
  body: string
  /** Who wrote an outgoing message. Null on rows from before this column existed: the AI. */
  sent_by?: "ai" | "agent" | null
  created_at: string
}

export type TicketPage = {
  items: Ticket[]
  /** Tickets per status for the current search, across all pages. */
  counts: Partial<Record<TicketStatus, number>>
}

export type StatsWindow = { answered: number; escalated: number; median_seconds: number | null }
export type TopicCount = { section: string; total: number; answered: number }

export type Stats = {
  /** One row per calendar day that had email, as YYYY-MM-DD in the viewer's time zone. */
  days: { day: string; answered: number; escalated: number }[]
  current: StatsWindow
  previous: StatsWindow
  topics: TopicCount[]
  waiting: number
}

export type Entry = {
  id: number
  section: string
  title: string
  content: string
  updated_at?: string
}

/** One word for how an email ended up, derived from the event row. */
export type Outcome = "answered" | "escalated" | "skipped" | "failed" | "processing"

export function outcomeOf(event: SupportEvent): Outcome {
  if (event.status !== "processed") return event.status
  return event.result?.action === "escalate" ? "escalated" : "answered"
}

export type Decision = Required<Omit<EventResult, "proposed_action" | "knowledge_gap">> & {
  proposed_action: string | null
  knowledge_gap: string | null
}

/** The answer of POST /api/simulate: the decision, and every step that led to it. */
export type Simulation = {
  decision: Decision
  classification: {
    section: string
    language: string
    needs_human: boolean
    battery_safety: boolean
    uncovered_topic: boolean
    reason: string
  } | null
  answer: {
    action: "reply" | "escalate"
    reasoning: string
    enough_information: boolean
    missing_information: string | null
    promises_an_action: boolean
  } | null
  /** Knowledge base sections the AI read. */
  sources: string[]
  /** Which check made the final call. */
  rule: string
  timings: { classify: number; agent: number | null; total: number }
}

export type KnowledgeGap = {
  event_id: number
  created_at: string
  missing: string
  section: string | null
  question: string | null
  ticket_id: number | null
  subject: string | null
  customer_email: string | null
  status: TicketStatus | null
}
