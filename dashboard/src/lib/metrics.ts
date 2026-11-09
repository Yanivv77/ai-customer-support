import { outcomeOf, type Stats, type StatsWindow, type SupportEvent, type Ticket } from "@/lib/types"

const DAY = 24 * 60 * 60 * 1000

export type DayBucket = { date: Date; answered: number; escalated: number }

/** Local calendar day as YYYY-MM-DD, the same form the API uses. */
export function dayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The API only returns days that had email. The chart needs every day, oldest first, ending today. */
export function fillDays(days: Stats["days"], count: number, now = Date.now()): DayBucket[] {
  const byDay = new Map(days.map((row) => [row.day, row]))
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (count - 1 - index))
    const row = byDay.get(dayKey(date))
    return { date, answered: row?.answered ?? 0, escalated: row?.escalated ?? 0 }
  })
}

export function summarise(window: StatsWindow) {
  const handled = window.answered + window.escalated
  return {
    handled,
    answered: window.answered,
    automationRate: handled ? window.answered / handled : null,
    medianSeconds: window.median_seconds,
  }
}

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * The same numbers GET /api/stats computes in SQL, from rows already in memory.
 * Only the sample-data mode uses this; the real dashboard asks the database.
 */
export function computeStats(events: SupportEvent[], tickets: Ticket[], now = Date.now()): Stats {
  const handled = events.filter((event) => ["answered", "escalated"].includes(outcomeOf(event)))
  const time = (event: SupportEvent) => new Date(event.created_at).getTime()

  const window = (from: number, to: number): StatsWindow => {
    const rows = handled.filter((event) => time(event) >= from && time(event) < to)
    return {
      answered: rows.filter((event) => outcomeOf(event) === "answered").length,
      escalated: rows.filter((event) => outcomeOf(event) === "escalated").length,
      median_seconds: median(
        rows.filter((event) => event.processed_at).map((event) => (new Date(event.processed_at!).getTime() - time(event)) / 1000)
      ),
    }
  }

  const days = new Map<string, Stats["days"][number]>()
  for (const event of handled) {
    if (time(event) < now - 15 * DAY) continue
    const day = dayKey(new Date(event.created_at))
    const row = days.get(day) ?? { day, answered: 0, escalated: 0 }
    row[outcomeOf(event) as "answered" | "escalated"] += 1
    days.set(day, row)
  }

  const topics = new Map<string, Stats["topics"][number]>()
  for (const ticket of tickets) {
    if (new Date(ticket.created_at).getTime() < now - 14 * DAY) continue
    const section = ticket.category ?? "other"
    const row = topics.get(section) ?? { section, total: 0, answered: 0 }
    row.total += 1
    if (ticket.status === "answered") row.answered += 1
    topics.set(section, row)
  }

  return {
    days: [...days.values()],
    current: window(now - 7 * DAY, Infinity),
    previous: window(now - 14 * DAY, now - 7 * DAY),
    topics: [...topics.values()].sort((a, b) => b.total - a.total),
    waiting: tickets.filter((ticket) => ticket.status === "escalated").length,
  }
}
