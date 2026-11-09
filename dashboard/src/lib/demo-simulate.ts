// A rule-based stand-in for POST /api/simulate in sample-data mode. It never calls a model:
// it matches keywords against the sample knowledge base, so adding an entry on the
// Knowledge gaps page really does change the next answer.
import type { Entry, Simulation } from "@/lib/types"

const SIGN_OFF = "\n\nBest regards,\nEBikes IL Support"
const SIGN_OFF_HE = "\n\nבברכה,\nצוות EBikes IL"
const HEBREW = /[֐-׿]/

type Email = { subject: string; body: string; has_attachments: boolean }

// Topics the sample knowledge base does not cover yet, by the word that gives them away.
const GAP_TOPICS: { words: RegExp; key: RegExp; missing: string; section: string }[] = [
  { words: /rain|waterproof|wet|גשם/i, key: /rain|water/i, missing: "Whether the bikes can be ridden in heavy rain, and their water resistance rating", section: "e-bikes" },
  { words: /weight|kg|heavy rider|משקל/i, key: /weight/i, missing: "The maximum rider weight for the C1 and F1", section: "e-bikes" },
  { words: /showroom|test ride|store in|visit/i, key: /showroom|test ride/i, missing: "Whether there is a showroom or test ride option, and where", section: "other" },
  { words: /child seat|kid seat|baby seat/i, key: /child seat/i, missing: "Whether a child seat fits the C1, and which models are compatible", section: "e-bikes" },
  { words: /winter|storage|store the battery/i, key: /stor(e|age)|winter/i, missing: "How to store the battery when the bike is not used for months", section: "batteries" },
]

const STOP = new Set(
  "about after again also and any are bike bikes can could does for from have hello help how into its just like many much need please should that the thanks thank there this what when where which will with would your you carmel ebike e-bike".split(" ")
)

const words = (text: string) =>
  new Set(text.toLowerCase().match(/[a-z0-9֐-׿]{3,}/g)?.filter((word) => !STOP.has(word)) ?? [])

function score(entry: Entry, asked: Set<string>) {
  const title = words(entry.title)
  const content = words(entry.content)
  let total = 0
  for (const word of asked) total += (title.has(word) ? 3 : 0) + (content.has(word) ? 1 : 0)
  return total
}

function frameSize(text: string) {
  const height = Number(text.match(/(1[4-9]\d)\s*(cm|ס)/i)?.[1])
  if (!height) return null
  if (height < 150 || height > 195) return null
  return height < 165 ? "S" : height < 180 ? "M" : "L"
}

export function simulate(email: Email, entries: Entry[]): Simulation {
  const text = `${email.subject}\n${email.body}`
  const hebrew = HEBREW.test(email.body)
  const language = hebrew ? "Hebrew" : "English"
  const signOff = hebrew ? SIGN_OFF_HE : SIGN_OFF
  const greeting = hebrew ? "שלום,\n\n" : "Hello,\n\n"
  const acknowledgement = hebrew
    ? `${greeting}תודה על פנייתך. נציג שלנו יחזור אליך תוך יום עסקים אחד.${signOff}`
    : `${greeting}Thank you for your message. A colleague will reply to you within one business day.${signOff}`

  const timings = { classify: 1.3 + Math.random() * 0.8, agent: null as number | null, total: 0 }
  const classification = {
    section: "other",
    language,
    needs_human: false,
    battery_safety: false,
    uncovered_topic: false,
    reason: "",
  }

  function finish(result: Omit<Simulation, "classification" | "timings">): Simulation {
    timings.total = timings.classify + (timings.agent ?? 0) + 0.1
    return { ...result, classification, timings }
  }

  function escalate(rule: string, reason: string, gap: string | null = null, reply = acknowledgement, proposed: string | null = null) {
    return finish({
      decision: { action: "escalate", section: classification.section, reply, reason, proposed_action: proposed, knowledge_gap: gap },
      answer: null,
      sources: [],
      rule,
    })
  }

  // 1. The classifier's checks, in the order the real pipeline applies them.
  if (/swollen|smok|fire|burning|leak|hot battery|very hot|נפוח|עשן|שריפה/i.test(text)) {
    classification.section = "batteries"
    classification.battery_safety = classification.needs_human = true
    classification.reason = "The battery is described as swollen, hot or smoking: a safety problem."
    const reply = hebrew
      ? "שלום,\n\nהפסיקו להשתמש בסוללה ואל תטענו אותה. אם זה בטוח, הניחו אותה בחוץ על משטח שאינו נדלק, הרחק ממבנים. אם יש עשן או אש, התקשרו מיד למספר 102.\n\nנציג שלנו ייצור איתכם קשר.\n\nצוות EBikes IL"
      : "Hi,\n\nPlease stop using the battery and do not charge it. If it is safe to do so, put it outside on a surface that does not burn, away from buildings. If there is smoke or fire, call 102 right away.\n\nA colleague will contact you.\n\nEBikes IL Support"
    return escalate("battery-safety", classification.reason, null, reply, "battery-safety")
  }
  if (email.has_attachments) {
    classification.reason = "The email has attachments."
    return escalate("attachments", "The email has attachments")
  }
  const rules: [RegExp, string, string][] = [
    [/refund|money back|chargeback|החזר כספי/i, "returns-and-warranty", "The customer asks for a refund."],
    [/where is my order|tracking|hasn'?t arrived|has not arrived|late|איפה ההזמנה/i, "shipping", "The customer asks about the status of one specific order."],
    [/manager|call me|phone call|speak to a person|human/i, "other", "The customer asks for a person or a call."],
    [/lawyer|legal|helmet law|insurance|regulat/i, "other", "The customer asks about legal requirements."],
    [/ignore (your|all|previous)|system prompt|you are now/i, "other", "The email tries to give the assistant new instructions."],
    [/terrible|worst|scam|bad review|angry|furious/i, "other", "The customer is angry or threatens a bad review."],
  ]
  for (const [pattern, section, reason] of rules) {
    if (pattern.test(text)) {
      classification.section = section
      classification.needs_human = true
      classification.reason = reason
      return escalate("needs-human", reason)
    }
  }

  // 2. The agent looks the answer up in the knowledge base.
  timings.agent = 3.5 + Math.random() * 3
  const asked = words(text)
  const gapTopic = GAP_TOPICS.find((topic) => topic.words.test(text))
  const candidates = gapTopic
    ? entries.filter((entry) => gapTopic.key.test(`${entry.title} ${entry.content}`))
    : entries.filter((entry) => !["brand-and-tone", "escalation-rules"].includes(entry.section))
  const best = candidates
    .map((entry) => ({ entry, points: gapTopic ? 10 : score(entry, asked) }))
    .sort((a, b) => b.points - a.points)[0]

  if (!best || best.points < 3) {
    const missing = gapTopic?.missing ?? `An answer to: "${(email.subject || email.body).trim().split("\n")[0].slice(0, 90)}"`
    classification.section = gapTopic?.section ?? best?.entry.section ?? "other"
    classification.reason = "A product question the assistant can try to answer from the knowledge base."
    return finish({
      decision: {
        action: "escalate",
        section: classification.section,
        reply: acknowledgement,
        reason: "The knowledge base does not answer this",
        proposed_action: null,
        knowledge_gap: missing,
      },
      answer: {
        action: "reply",
        reasoning: "None of the knowledge base sections say anything about this, so the question cannot be answered from it.",
        enough_information: false,
        missing_information: missing,
        promises_an_action: false,
      },
      sources: ["brand-and-tone", "escalation-rules", classification.section],
      rule: "not-in-knowledge-base",
    })
  }

  const { entry } = best
  classification.section = entry.section
  classification.reason = `A question about ${entry.section.replaceAll("-", " ")} that the knowledge base covers.`
  const size = /frame size/i.test(entry.title) ? frameSize(text) : null
  const answer = size
    ? hebrew
      ? `לגובה שציינת מתאימה מידה ${size} ב-Carmel C1.`
      : `For your height, the Carmel C1 in size ${size} is the right fit.`
    : entry.content.split("\n").slice(0, 4).join("\n")
  return finish({
    decision: {
      action: "reply",
      section: entry.section,
      reply: `${greeting}${answer}${signOff}`,
      reason: `Answered from '${entry.title}'.`,
      proposed_action: null,
      knowledge_gap: null,
    },
    answer: {
      action: "reply",
      reasoning: `Used the entry '${entry.title}' in ${entry.section}.`,
      enough_information: true,
      missing_information: null,
      promises_an_action: false,
    },
    sources: ["brand-and-tone", "escalation-rules", entry.section],
    rule: "agent-reply",
  })
}
