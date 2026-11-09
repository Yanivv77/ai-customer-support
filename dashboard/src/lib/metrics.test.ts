import { describe, expect, it } from "vitest"

import { initials, sectionLabel } from "@/lib/format"
import { computeStats, dayKey, fillDays, summarise } from "@/lib/metrics"
import { outcomeOf, type SupportEvent, type Ticket } from "@/lib/types"

const NOW = new Date(2026, 10, 9, 12).getTime()
const HOUR = 60 * 60 * 1000

function event(hoursAgo: number, action: "reply" | "escalate" | null, seconds = 10): SupportEvent {
  const created = NOW - hoursAgo * HOUR
  return {
    id: hoursAgo,
    gmail_message_id: `m${hoursAgo}`,
    status: action ? "processed" : "skipped",
    attempts: 1,
    error: null,
    result: action ? { action } : { reason: "bulk or list mail" },
    created_at: new Date(created).toISOString(),
    processed_at: new Date(created + seconds * 1000).toISOString(),
  }
}

const ticket = (status: Ticket["status"], category: string | null): Ticket => ({
  id: 1,
  subject: "",
  customer_email: "a@example.com",
  category,
  status,
  proposed_action: null,
  created_at: new Date(NOW - HOUR).toISOString(),
  updated_at: new Date(NOW).toISOString(),
})

describe("outcomeOf", () => {
  it("reads the outcome from the status and the decision", () => {
    expect(outcomeOf(event(1, "reply"))).toBe("answered")
    expect(outcomeOf(event(1, "escalate"))).toBe("escalated")
    expect(outcomeOf(event(1, null))).toBe("skipped")
  })
})

describe("computeStats", () => {
  const events = [event(1, "reply", 10), event(2, "reply", 20), event(3, "escalate", 30), event(4, null), event(24 * 8, "reply")]
  const stats = computeStats(events, [ticket("answered", "shipping"), ticket("escalated", "shipping"), ticket("escalated", null)], NOW)

  it("splits this week from the week before and ignores skipped mail", () => {
    expect(stats.current).toEqual({ answered: 2, escalated: 1, median_seconds: 20 })
    expect(stats.previous).toMatchObject({ answered: 1, escalated: 0 })
  })

  it("counts waiting tickets and groups topics", () => {
    expect(stats.waiting).toBe(2)
    expect(stats.topics[0]).toEqual({ section: "shipping", total: 2, answered: 1 })
  })

  it("summarises a window into a rate", () => {
    expect(summarise(stats.current)).toMatchObject({ handled: 3, automationRate: 2 / 3 })
    expect(summarise({ answered: 0, escalated: 0, median_seconds: null }).automationRate).toBeNull()
  })
})

describe("fillDays", () => {
  it("returns every day, oldest first, with zeros where there was no email", () => {
    const days = fillDays([{ day: dayKey(new Date(NOW)), answered: 3, escalated: 1 }], 14, NOW)
    expect(days).toHaveLength(14)
    expect(days[13]).toMatchObject({ answered: 3, escalated: 1 })
    expect(days[0]).toMatchObject({ answered: 0, escalated: 0 })
    expect(days[0].date.getTime()).toBeLessThan(days[13].date.getTime())
  })
})

describe("format", () => {
  it("labels sections and builds initials", () => {
    expect(sectionLabel("returns-and-warranty")).toBe("Returns and warranty")
    expect(sectionLabel("e-bikes")).toBe("E-bikes")
    expect(sectionLabel(null)).toBe("Uncategorised")
    expect(initials("dana.levi@example.com")).toBe("DL")
  })
})

describe("knowledge gaps", async () => {
  const { groupGaps, suggestTitle } = await import("@/lib/gaps")
  const gap = (id: number, missing: string, created_at: string) => ({
    event_id: id, created_at, missing, section: "e-bikes", question: null,
    ticket_id: null, subject: null, customer_email: null, status: null,
  })

  it("groups the same missing information, most asked first", () => {
    const groups = groupGaps([
      gap(1, "Maximum rider weight", "2026-11-01T10:00:00Z"),
      gap(2, "Riding in the rain.", "2026-11-02T10:00:00Z"),
      gap(3, "riding in the rain", "2026-11-03T10:00:00Z"),
    ])
    expect(groups.map((group) => group.asks.length)).toEqual([2, 1])
    expect(groups[0].lastAsked).toBe("2026-11-03T10:00:00Z")
  })

  it("turns the gap sentence into a short title", () => {
    expect(suggestTitle("Whether the F1 can be ridden in heavy rain, and its rating")).toBe("The F1 can be ridden in heavy rain")
    expect(suggestTitle("How to store the battery when the bike is not used")).toBe("Store the battery when the bike is not used")
  })
})

describe("sample-mode simulation", async () => {
  const { simulate } = await import("@/lib/demo-simulate")
  const entries = [
    { id: 1, section: "e-bikes", title: "Frame size for the C1", content: "Pick the size by rider height.\n- S: 150 to 164 cm.\n- M: 165 to 179 cm.\n- L: 180 to 195 cm." },
  ]
  const email = (body: string) => ({ subject: "", body, has_attachments: false })

  it("answers from the knowledge base", () => {
    const result = simulate(email("I'm 183 cm tall, which frame size fits me?"), entries)
    expect(result.decision.action).toBe("reply")
    expect(result.decision.reply).toContain("size L")
  })

  it("hands over safety problems and refunds", () => {
    expect(simulate(email("My battery is swollen"), entries).rule).toBe("battery-safety")
    expect(simulate(email("I want a refund"), entries).rule).toBe("needs-human")
  })

  it("reports a gap, and answers once an entry covers it", () => {
    const question = email("Can I ride the F1 in heavy rain?")
    expect(simulate(question, entries).decision.knowledge_gap).toMatch(/rain/)
    const covered = [...entries, { id: 2, section: "e-bikes", title: "Riding in the rain", content: "Both bikes are IPX4: fine in rain." }]
    expect(simulate(question, covered).decision).toMatchObject({ action: "reply", knowledge_gap: null })
  })
})
