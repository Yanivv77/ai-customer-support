// An in-memory stand-in for the API, filled with invented customers and emails.
// It answers the same routes with the same shapes, so every page works unchanged.
import { computeStats } from "@/lib/metrics"
import type { Entry, EventResult, Message, SupportEvent, Ticket } from "@/lib/types"

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const SUPPORT = "support@ebikes-il.example"
const SIGN_OFF = "\n\nBest regards,\nEBikes IL Support"

type Scenario = {
  section: string
  subject: string
  body: string
  action: "reply" | "escalate"
  reply: string
  reason: string
  proposed?: string
  /** What the knowledge base lacks, when that is why the email was handed over. */
  gap?: string
  weight: number
  followUp?: { body: string; reply: string; reason: string }
}

const HANDOVER = "Thank you for your message. I have passed it to a colleague, who will reply to you personally."

const ACKNOWLEDGE = "Thank you for your message. A colleague will reply to you within one business day."

// Questions the knowledge base cannot answer yet: these fill the Knowledge gaps page.
const GAPS: [section: string, subject: string, body: string, gap: string][] = [
  ["e-bikes", "Can I ride the F1 in the rain?", "Hello, I commute all year. Can I ride the Carmel F1 in heavy rain? Is it waterproof?", "Whether the F1 can be ridden in heavy rain, and its water resistance rating"],
  ["e-bikes", "Maximum rider weight", "Hi, what is the maximum rider weight for the Carmel C1? I weigh about 115 kg.", "The maximum rider weight for the C1 and F1"],
  ["other", "Test ride in Haifa?", "Do you have a showroom in Haifa where I can test ride the bikes before buying?", "Whether there is a showroom or test ride option, and where"],
  ["e-bikes", "Child seat for the C1", "Can I mount a rear child seat on the Carmel C1? Which ones fit?", "Whether a child seat fits the C1, and which models are compatible"],
  ["batteries", "Battery in winter storage", "How should I store the battery over the winter when I'm not riding?", "How to store the battery when the bike is not used for months"],
  ["e-bikes", "Can I ride the F1 in the rain?", "Is the F1 OK to ride when it's raining? I don't want to damage the motor.", "Whether the F1 can be ridden in heavy rain, and its water resistance rating"],
]

const SCENARIOS: Scenario[] = [
  {
    section: "e-bikes",
    subject: "Which frame size for the Carmel C1?",
    body: "Hi,\n\nI'm 172 cm tall and want to order the Carmel C1. Which frame size should I pick?\n\nThanks!",
    action: "reply",
    reply:
      "Hi,\n\nThanks for reaching out. For a rider of 172 cm, the Carmel C1 in size M is the right fit. Size M suits riders from 165 to 179 cm." +
      SIGN_OFF,
    reason: "Answered from 'Frame size for the C1': 172 cm falls in size M (165 to 179 cm).",
    weight: 9,
    followUp: {
      body: "Great, thank you. And my partner is 163 cm, would she need a different size?",
      reply:
        "Hi,\n\nYes. At 163 cm, size S is the right fit. Size S suits riders from 150 to 164 cm." + SIGN_OFF,
      reason: "Follow-up answered from 'Frame size for the C1': 163 cm falls in size S.",
    },
  },
  {
    section: "e-bikes",
    subject: "C1 or F1 for commuting by train?",
    body: "Hello,\n\nI ride to the station and take the train every day. Which of your bikes would you recommend, and what do they cost?",
    action: "reply",
    reply:
      "Hello,\n\nFor rides combined with the train, we recommend the Carmel F1. It folds, so it is easy to take on board and to store. The F1 costs 3,990 NIS including VAT.\n\nIf you mostly ride in the city and want the longer range of up to about 50 km, the Carmel C1 at 4,990 NIS is the better choice." +
      SIGN_OFF,
    reason: "Answered from 'Prices and which bike to choose': public transport points to the F1.",
    weight: 8,
  },
  {
    section: "e-bikes",
    subject: "What is your cheapest e-bike?",
    body: "Hi, I have a budget of about 4,000 NIS. What do you have in that range?",
    action: "reply",
    reply:
      "Hi,\n\nThe Carmel F1 fits your budget. It is our foldable e-bike and costs 3,990 NIS including VAT. It has a 250 W rear hub motor and a removable 36 V battery." +
      SIGN_OFF,
    reason: "Answered from 'Prices and which bike to choose': budget up to 4,000 NIS points to the F1.",
    weight: 6,
  },
  {
    section: "batteries",
    subject: "How far can I ride on one charge?",
    body: "Hello, how many kilometres does the C1 battery last? I ride about 18 km each way to work.",
    action: "reply",
    reply:
      "Hello,\n\nThe Carmel C1 has a range of up to about 50 km per charge. The exact range depends on rider weight, hills, and the assist level you use. A return trip of 36 km is within that range for most riders." +
      SIGN_OFF,
    reason: "Answered from 'Models': C1 range is up to about 50 km, with the stated conditions.",
    weight: 7,
  },
  {
    section: "returns-and-warranty",
    subject: "Is the display covered by warranty?",
    body: "Hi,\n\nI bought my Carmel C1 eight months ago and the display has started flickering. Is that covered?",
    action: "reply",
    reply:
      "Hi,\n\nYes. The display is covered for 1 year against manufacturing faults, so at eight months you are within the warranty.\n\nCould you reply with your order number and the model code from the sticker under the frame? Then we can take it from there." +
      SIGN_OFF,
    reason: "Answered from 'Warranty': display has 1 year of cover; asked for order number and model code.",
    weight: 6,
  },
  {
    section: "shipping",
    subject: "How long does a replacement charger take?",
    body: "Hello, you approved a replacement charger for me last week. How long does delivery take?",
    action: "reply",
    reply:
      "Hello,\n\nReplacement parts ship from our warehouse free of charge. They leave within 2 business days and arrive in 3 to 7 business days. Business days are Sunday to Thursday. You receive a tracking link by email when the parcel leaves." +
      SIGN_OFF,
    reason: "Answered from 'Replacement parts': shipping times and tracking link.",
    weight: 6,
  },
  {
    section: "returns-and-warranty",
    subject: "How do I return my bike?",
    body: "Hi, the F1 arrived yesterday but it is not what I expected. How does a return work?",
    action: "reply",
    reply:
      "Hi,\n\nReturns go through Amazon. You can start a return in Your Orders on Amazon within 30 days of delivery. Amazon sends the return label and handles the rest." +
      SIGN_OFF,
    reason: "Answered from 'Returns': the customer asked how returns work, not for a refund decision.",
    weight: 5,
  },
  {
    section: "e-bikes",
    subject: "שאלה על מידת שלדה",
    body: "שלום,\n\nאני בגובה 168 ס״מ. איזו מידת שלדה מתאימה לי ב-Carmel C1?\n\nתודה",
    action: "reply",
    reply:
      "שלום,\n\nתודה שפנית אלינו. לגובה 168 ס״מ מתאימה מידה M ב-Carmel C1. מידה M מיועדת לרוכבים בגובה 165 עד 179 ס״מ.\n\nבברכה,\nצוות התמיכה של EBikes IL",
    reason: "Customer wrote in Hebrew. Answered in Hebrew from 'Frame size for the C1'.",
    weight: 4,
  },
  {
    section: "batteries",
    subject: "Battery is swollen and very hot",
    body: "My battery got really hot while charging last night and the case looks swollen on one side. Is it safe to keep using it?",
    action: "escalate",
    reply:
      "Hello,\n\nPlease stop using and charging the battery right away. Unplug the charger, and if it is safe to do so, move the battery outdoors, away from anything that can burn. Do not open or puncture it.\n\nA colleague will contact you personally as soon as possible." +
      SIGN_OFF,
    reason: "Battery safety rule: a swollen, hot battery is always handed to a person, with safety steps first.",
    proposed: "Call the customer today and arrange collection and a replacement battery.",
    weight: 1,
  },
  {
    section: "returns-and-warranty",
    subject: "I want my money back",
    body: "The bike has been nothing but trouble since day one. I want a full refund. Order {order}.",
    action: "escalate",
    reply: `Hello,\n\n${HANDOVER}${SIGN_OFF}`,
    reason: "Always-escalate rule: the customer asks for a refund.",
    proposed: "Check the delivery date for order {order} and explain the Amazon return window.",
    weight: 2,
  },
  {
    section: "shipping",
    subject: "Where is my order?",
    body: "Hi, I ordered a Carmel C1 nine days ago and tracking has not moved since Sunday. Can you check?",
    action: "escalate",
    reply: `Hi,\n\n${HANDOVER}${SIGN_OFF}`,
    reason: "Always-escalate rule: the customer asks about the status of one specific order.",
    proposed: "Look up the Amazon order and reply with the current delivery status.",
    weight: 2,
  },
  {
    section: "e-bikes",
    subject: "Front light missing from the box",
    body: "Hello, my Carmel F1 arrived today (order {order}) but there was no front light in the box.",
    action: "escalate",
    reply:
      "Hello,\n\nSorry about the missing light. I have passed this to a colleague, who will confirm the replacement with you personally." +
      SIGN_OFF,
    reason: "Missing accessory with an order number: sending a part is a promise, so a person confirms it.",
    proposed: "Ship a front light to the address on order {order}.",
    weight: 2,
  },
  {
    section: "batteries",
    subject: "Battery drains after 10 km",
    body: "Hi, my battery (BAT-36-10) is five months old and now only lasts about 10 km. I already did a full charge cycle twice like the manual says.",
    action: "escalate",
    reply:
      "Hi,\n\nThank you for the details, and for doing the full charge cycles already. Your battery is within its 1-year warranty. I have passed this to a colleague, who will reply to you personally about the next step." +
      SIGN_OFF,
    reason: "Battery not holding charge, checks already done: a replacement battery is always arranged by a person.",
    proposed: "Send a replacement BAT-36-10 under warranty.",
    weight: 2,
  },
  ...GAPS.map(
    ([section, subject, body, gap]): Scenario => ({
      section,
      subject,
      body,
      action: "escalate",
      reply: `Hello,\n\n${ACKNOWLEDGE}${SIGN_OFF}`,
      reason: "The knowledge base does not answer this",
      gap,
      weight: 1,
    })
  ),
]

const CUSTOMERS = [
  "dana.levi", "yoav.mizrahi", "noa.friedman", "amit.shapiro", "tamar.cohen", "eitan.peretz",
  "maya.goldberg", "omer.katz", "shira.ben-david", "lior.avraham", "michal.rosen", "daniel.segal",
  "yael.biton", "ron.hadad", "gal.weiss", "neta.oren", "ido.sasson", "hila.navon",
].map((name) => `${name}@example.com`)

/** Deterministic, so the dashboard looks the same on every take. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (time: number) => new Date(time).toISOString()

type State = {
  events: SupportEvent[]
  tickets: Ticket[]
  messages: Map<number, Message[]>
  entries: Entry[]
  nextMessageId: number
  incoming: number
}

function decisionOf(scenario: Scenario): EventResult {
  return {
    action: scenario.action,
    section: scenario.section,
    reply: scenario.reply,
    reason: scenario.reason,
    proposed_action: scenario.proposed ?? null,
    knowledge_gap: scenario.gap ?? null,
  }
}

function addExchange(
  state: State,
  ticket: Ticket,
  receivedAt: number,
  seconds: number,
  body: string,
  result: EventResult
) {
  const repliedAt = receivedAt + seconds * 1000
  const thread = state.messages.get(ticket.id) ?? []
  thread.push(
    { id: state.nextMessageId++, direction: "in", from_address: ticket.customer_email, body, created_at: iso(receivedAt) },
    { id: state.nextMessageId++, direction: "out", from_address: SUPPORT, body: result.reply ?? "", created_at: iso(repliedAt) }
  )
  state.messages.set(ticket.id, thread)
  ticket.updated_at = iso(repliedAt)
  state.events.push({
    id: state.events.length + 1,
    gmail_message_id: `19a${(0x4f3c00 + state.events.length * 7919).toString(16)}`,
    status: "processed",
    attempts: 1,
    error: null,
    result,
    created_at: iso(receivedAt),
    processed_at: iso(repliedAt),
  })
}

/** Gives each ticket its own order number, so no two look copied. */
function withOrder(scenario: Scenario, serial: number): Scenario {
  const order = `114-${String(2400000 + ((serial * 618033) % 7000000)).padStart(7, "0")}`
  const fill = (text: string) => text.replaceAll("{order}", order)
  return {
    ...scenario,
    body: fill(scenario.body),
    reply: fill(scenario.reply),
    proposed: scenario.proposed && fill(scenario.proposed),
  }
}

function addTicket(state: State, template: Scenario, customer: string, receivedAt: number, seconds: number) {
  const scenario = withOrder(template, state.tickets.length + 1)
  const ticket: Ticket = {
    id: state.tickets.length + 1,
    subject: scenario.subject,
    customer_email: customer,
    category: scenario.section,
    status: scenario.action === "escalate" ? "escalated" : "answered",
    proposed_action: scenario.proposed ?? null,
    created_at: iso(receivedAt),
    updated_at: iso(receivedAt),
  }
  state.tickets.push(ticket)
  addExchange(state, ticket, receivedAt, seconds, scenario.body, decisionOf(scenario))
  return ticket
}

function build(): State {
  const random = mulberry32(11)
  const now = Date.now()
  const state: State = { events: [], tickets: [], messages: new Map(), entries: ENTRIES.map((e) => ({ ...e })), nextMessageId: 1, incoming: 0 }
  const totalWeight = SCENARIOS.reduce((sum, scenario) => sum + scenario.weight, 0)

  const pick = () => {
    let roll = random() * totalWeight
    return SCENARIOS.find((scenario) => (roll -= scenario.weight) < 0) ?? SCENARIOS[0]
  }

  // Oldest day first, so ids rise with time like the real tables.
  const arrivals: number[] = []
  for (let day = 13; day >= 0; day--) {
    const count = day < 7 ? 5 + Math.floor(random() * 4) : 3 + Math.floor(random() * 4)
    for (let i = 0; i < count; i++) arrivals.push(now - day * DAY - (0.02 + random() * 0.9) * DAY)
  }
  arrivals.push(now - 4 * MINUTE)
  arrivals.sort((a, b) => a - b)

  let lastEscalation: Scenario | null = null
  arrivals.forEach((receivedAt, index) => {
    const seconds = 7 + random() * 14
    const roll = random()
    if (roll < 0.07) {
      state.events.push({
        id: state.events.length + 1,
        gmail_message_id: `19a${(0x4f3c00 + state.events.length * 7919).toString(16)}`,
        status: "skipped",
        attempts: 1,
        error: null,
        result: { reason: "bulk or list mail" },
        created_at: iso(receivedAt),
        processed_at: iso(receivedAt + 1500),
      })
      return
    }
    // Avoid the same hand-over twice in a row, so the waiting list shows variety.
    let scenario = pick()
    while (scenario.action === "escalate" && scenario === lastEscalation) scenario = pick()
    if (scenario.action === "escalate") lastEscalation = scenario
    const customer = CUSTOMERS[Math.floor(random() * CUSTOMERS.length)]
    const ticket = addTicket(state, scenario, customer, receivedAt, seconds)
    const followUpAt = receivedAt + (20 + random() * 90) * MINUTE
    if (scenario.followUp && random() < 0.35 && followUpAt < now - 10 * MINUTE && index < arrivals.length - 1) {
      addExchange(state, ticket, followUpAt, 6 + random() * 10, scenario.followUp.body, {
        action: "reply",
        section: scenario.section,
        reply: scenario.followUp.reply,
        reason: scenario.followUp.reason,
        proposed_action: null,
      })
    }
  })

  // The team has already closed the older hand-overs, as it would in real use.
  for (const ticket of state.tickets) {
    const age = now - new Date(ticket.updated_at).getTime()
    if (ticket.status === "escalated" && age > 5 * DAY) {
      addAgentReply(state, ticket, TEAM_REPLY, new Date(ticket.updated_at).getTime() + (1 + random() * 5) * 60 * MINUTE)
      ticket.status = "resolved"
    }
  }

  // Follow-ups were appended out of order: restore time order and renumber.
  state.events.sort((a, b) => a.created_at.localeCompare(b.created_at))
  state.events.forEach((event, index) => (event.id = index + 1))
  return state
}

export const DEMO_GAPS = GAPS

const INCOMING: { scenario: Scenario; customer: string }[] = [
  { scenario: SCENARIOS[1], customer: "roni.alon@example.com" },
  { scenario: SCENARIOS[11], customer: "adi.shalev@example.com" },
  { scenario: SCENARIOS[3], customer: "tom.barak@example.com" },
]

let state: State | null = null

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const TEAM_REPLY =
  "Hello,\n\nThank you for your patience. I looked into this personally and it is now taken care of. You will get a separate confirmation by email." +
  SIGN_OFF

function addAgentReply(state: State, ticket: Ticket, body: string, sentAt: number) {
  const thread = state.messages.get(ticket.id) ?? []
  thread.push({ id: state.nextMessageId++, direction: "out", from_address: SUPPORT, body, sent_by: "agent", created_at: iso(sentAt) })
  state.messages.set(ticket.id, thread)
  ticket.updated_at = iso(sentAt)
}

function findTicket(state: State, id: string) {
  const ticket = state.tickets.find((item) => item.id === Number(id))
  if (!ticket) throw new Error("Ticket not found")
  return ticket
}

function knowledgeGaps(state: State) {
  const firstMessage = new Map<string, { ticket: Ticket; body: string }>()
  for (const ticket of state.tickets) {
    const thread = state.messages.get(ticket.id) ?? []
    for (const message of thread) {
      if (message.direction === "in") firstMessage.set(message.created_at, { ticket, body: message.body })
    }
  }
  return [...state.events]
    .reverse()
    .filter((event) => event.result?.knowledge_gap)
    .map((event) => {
      const match = firstMessage.get(event.created_at)
      return {
        event_id: event.id,
        created_at: event.created_at,
        missing: event.result!.knowledge_gap!,
        section: event.result!.section ?? null,
        question: match?.body ?? null,
        ticket_id: match?.ticket.id ?? null,
        subject: match?.ticket.subject ?? null,
        customer_email: match?.ticket.customer_email ?? null,
        status: match?.ticket.status ?? null,
      }
    })
}

export async function demoApi<T>(request: string, init: RequestInit = {}): Promise<T> {
  state ??= build()
  const method = init.method ?? "GET"
  const url = new URL(request, "http://sample")
  const path = url.pathname
  const send = (value: unknown) => structuredClone(value) as T

  if (method === "POST" && path === "/poll") {
    // A new email arrives and is handled, so there is something to watch.
    await wait(1600)
    const next = INCOMING[state.incoming++ % INCOMING.length]
    addTicket(state, next.scenario, next.customer, Date.now() - 9000, 9)
    return send({ messages: 1 })
  }

  const action = path.match(/^\/tickets\/(\d+)\/(reply|resolve|reopen)$/)
  if (action && method === "POST") {
    await wait(700)
    const ticket = findTicket(state, action[1])
    if (action[2] === "reply") {
      const reply = JSON.parse(String(init.body)) as { body: string; resolve: boolean }
      addAgentReply(state, ticket, reply.body.trim(), Date.now())
      if (reply.resolve) ticket.status = "resolved"
      return send({ ...ticket, warning: null })
    }
    ticket.status = action[2] === "resolve" ? "resolved" : "escalated"
    ticket.updated_at = iso(Date.now())
    return send(ticket)
  }

  await wait(220)
  if (path === "/login") return send({ ok: true })
  if (path === "/stats") return send(computeStats(state.events, state.tickets))
  if (path === "/events") {
    return send([...state.events].reverse().slice(0, Number(url.searchParams.get("limit") ?? 100)))
  }
  if (path === "/tickets") {
    const needle = (url.searchParams.get("q") ?? "").toLowerCase()
    const status = url.searchParams.get("status")
    const found = state.tickets
      .filter((item) => !needle || item.subject.toLowerCase().includes(needle) || item.customer_email.includes(needle))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    const counts: Record<string, number> = {}
    for (const item of found) counts[item.status] = (counts[item.status] ?? 0) + 1
    const items = found.filter((item) => !status || item.status === status).slice(0, Number(url.searchParams.get("limit") ?? 50))
    return send({ items, counts })
  }
  if (path === "/knowledge-base" && method === "POST") {
    const created = JSON.parse(String(init.body)) as Pick<Entry, "section" | "title" | "content">
    if (state.entries.some((item) => item.section === created.section && item.title === created.title.trim())) {
      throw new Error("This section already has an entry with that title")
    }
    const entry = { ...created, id: Math.max(...state.entries.map((item) => item.id)) + 1, updated_at: iso(Date.now()) }
    state.entries.push(entry)
    return send(entry)
  }
  if (path === "/knowledge-base") return send(state.entries)
  if (path === "/knowledge-gaps") return send(knowledgeGaps(state))
  if (path === "/simulate" && method === "POST") {
    const { simulate } = await import("./demo-simulate")
    await wait(2400)
    return send(simulate(JSON.parse(String(init.body)), state.entries))
  }

  const messages = path.match(/^\/tickets\/(\d+)\/messages$/)
  if (messages) return send(state.messages.get(Number(messages[1])) ?? [])

  const ticket = path.match(/^\/tickets\/(\d+)$/)
  if (ticket) return send(findTicket(state, ticket[1]))

  const entry = path.match(/^\/knowledge-base\/(\d+)$/)
  if (entry && method === "PUT") {
    const update = JSON.parse(String(init.body)) as Pick<Entry, "title" | "content">
    const target = state.entries.find((item) => item.id === Number(entry[1]))
    if (!target) throw new Error("Entry not found")
    Object.assign(target, update, { updated_at: iso(Date.now()) })
    return send(target)
  }
  throw new Error(`No sample data for ${method} ${path}`)
}

const ENTRIES: Entry[] = [
  ["batteries", "Battery safety comes first", "If a battery is swollen, hot, leaking, smoking, or smells of burning: tell the customer to stop using and charging it, unplug the charger, and move it outdoors away from anything that can burn if that is safe. Then hand the email to a colleague."],
  ["batteries", "Battery not holding charge", "Ask the customer to do two full charge cycles: ride until the battery is empty, then charge to full without interruption.\nIf the range is still short after that, a colleague arranges a replacement under warranty."],
  ["brand-and-tone", "How we write", "Short, friendly, and plain. Answer the question in the first sentence. Reply in the language the customer wrote in. Sign off as EBikes IL Support."],
  ["e-bikes", "Models", "We sell two e-bikes. Both have a 250 W rear hub motor and a removable 36 V battery.\n- Carmel C1 (model EB-C1): city bike, three frame sizes. Range up to about 50 km per charge, depending on rider weight, hills, and assist level.\n- Carmel F1 (model EB-F1): foldable bike, one frame size, for mixed rides with public transport."],
  ["e-bikes", "Prices and which bike to choose", "Prices in NIS, including VAT, for new bikes:\n- Carmel F1 (EB-F1), foldable: 3,990 NIS. This is our lowest-priced e-bike.\n- Carmel C1 (EB-C1), city bike: 4,990 NIS.\n\nNever promise a discount, a sale, a coupon, or a price match."],
  ["e-bikes", "Frame size for the C1", "Pick the size by rider height.\n- S: 150 to 164 cm.\n- M: 165 to 179 cm.\n- L: 180 to 195 cm.\nA rider on the border between two sizes should take the smaller frame for city riding. The F1 has one size and fits riders from 150 to 190 cm."],
  ["escalation-rules", "Always escalate", "Hand the email to a colleague when the customer:\n- mentions an injury, a crash, a brake failure, or any safety problem\n- asks for a refund, money back, or a chargeback\n- asks for a person, a manager, or a phone call\n- asks about the status of one specific order\n- sends attachments\n- asks about something this knowledge base does not cover"],
  ["returns-and-warranty", "Returns", "All orders go through Amazon, so returns do too. The customer starts a return in Your Orders on Amazon within 30 days of delivery. Amazon sends the return label and handles the refund."],
  ["returns-and-warranty", "Warranty", "- E-bikes: 2 years on the frame, the motor, and the controller. 1 year on the display, lights, charger, and other parts.\n- Batteries: 1 year.\nThe warranty covers manufacturing faults."],
  ["shipping", "Replacement parts", "Replacement parts ship from our own warehouse, free of charge. They leave within 2 business days and arrive in 3 to 7 business days. Business days are Sunday to Thursday. The customer receives a tracking link by email when the parcel leaves."],
].map(([section, title, content], index) => ({ id: index + 1, section, title, content }))
