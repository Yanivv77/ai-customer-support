import { Activity, BookOpen, FlaskConical, Inbox, LayoutDashboard, SearchX } from "lucide-react"
import type { ReactNode } from "react"

import { Avatar, Badge, Bar, Check, Collapse, Count, Roll, Row, Spinner, Stage, Stream, Text, Window, type Act, type Layout } from "../kit"
import "./support.css"

// EBikes IL's support panel, Tickets view. The story is what the product does:
// a customer email lands in the inbox while the AI is already working on it;
// the agent opens it and watches the answer arrive, grounded in a knowledge
// base entry; the ticket turns "Answered by AI" and the share of emails
// answered without a person ticks up in the satellite card.
//
// Copied from the Linear gold (a sidebar app, a list as context, one row the
// story is about) and the ai-chat gold (Thinking, the answer streamed in
// place, its source last). Plays once; the poster is the payoff.
//
// Real strings: Tickets, the customer, the subject, the status, the email,
// the answer, its source, the stat. Everything else is placeholder.

const NAME = "Dana Levi"
const SUBJECT = "Which frame size for the C1?"
const EMAIL = "Hi, I'm 183 cm tall. Which frame size of the Carmel C1 fits me?"
const ANSWER = "Hi Dana, at 183 cm the Carmel C1 in size L is the right fit. Size L covers riders from 180 to 195 cm."
const WORDS = ANSWER.split(" ").length

type Phase = "idle" | "reading" | "answer"
type S = { arrived: boolean; open: boolean; phase: Phase; words: number; source: boolean; sent: boolean; counted: boolean }

const initial: S = { arrived: false, open: false, phase: "idle", words: 0, source: false, sent: false, counted: false }
const poster: S = { arrived: true, open: true, phase: "answer", words: WORDS, source: true, sent: true, counted: true }

const REST = { at: "rest", x: 0.55, y: 0.5 }

async function script(a: Act<S>) {
  await a.wait(900)

  // 1. A new email drops into the top of the inbox; the AI is on it already
  a.mark("arrive")
  await a.set({ arrived: true })
  await a.wait(1100)

  // 2. The agent opens it: the email, and the AI reading the knowledge base
  a.mark("open")
  if (a.layout === "wide") {
    await a.move({ at: "story", x: 0.62, y: 0.42 })
    await a.wait(200)
    await a.click()
  }
  await a.set({ open: true })
  await a.wait(250)
  await a.set({ phase: "reading" })
  // Off the row, onto the pane's empty surface, so nothing sits over the change
  await a.move(REST)
  await a.wait(900)

  // 3. The answer streams in place, then the entry it came from
  a.mark("answer")
  await a.set({ phase: "answer" })
  for (let i = 1; i <= WORDS; i++) {
    a.put({ words: i })
    await a.wait(42)
  }
  await a.wait(350)
  a.mark("source")
  await a.set({ source: true })
  await a.wait(700)

  // 4. Sent: the ticket and the stat follow
  a.mark("sent")
  await a.set({ sent: true })
  // The stat follows its cause a beat later
  await a.wait(450)
  a.mark("counted")
  await a.set({ counted: true })
  await a.wait(2400)
}

function NavItem({ icon, label, active, count }: { icon: ReactNode; label?: string; active?: boolean; count?: string }) {
  return (
    <div className="sp-nav" data-active={active || undefined}>
      {icon}
      {label ? <Text className="sp-nav__label">{label}</Text> : <Bar w={58} h={5} tone={3} />}
      {count && (
        <span className="sp-nav__count">
          <Roll>{count}</Roll>
        </span>
      )}
    </div>
  )
}

function Sidebar() {
  const icon = { size: 15, strokeWidth: 1.75, className: "sp-icon" }
  return (
    <div className="sp-side">
      <div className="sp-brand">
        <Text className="sp-brand__name">EBikes IL</Text>
        <Bar w={64} h={5} tone={2} />
      </div>
      <div className="sp-group">
        <div className="sp-section">
          <Bar w={46} h={4} tone={2} />
        </div>
        <NavItem icon={<LayoutDashboard {...icon} />} />
        <NavItem icon={<Inbox {...icon} className="sp-icon sp-icon--on" />} label="Tickets" active count="2" />
        <NavItem icon={<Activity {...icon} />} />
      </div>
      <div className="sp-group">
        <div className="sp-section">
          <Bar w={24} h={4} tone={2} />
        </div>
        <NavItem icon={<BookOpen {...icon} />} />
        <NavItem icon={<SearchX {...icon} />} />
        <NavItem icon={<FlaskConical {...icon} />} />
      </div>
    </div>
  )
}

// The rows around the story row: placeholder people, varied widths
const FILLER = [
  { name: 42, subject: 150, time: 26 },
  { name: 56, subject: 122, time: 30 },
  { name: 48, subject: 168, time: 24 },
  { name: 60, subject: 136, time: 32 },
  { name: 44, subject: 112, time: 28 },
]

function StoryRow({ s }: { s: S }) {
  return (
    <Row
      data-target="story"
      data-cursor="pointer"
      className="sp-row sp-row--story"
      selected={s.open}
      lead={<Avatar name={NAME} size={30} />}
      title={<Text className="sp-row__name">{NAME}</Text>}
      subtitle={<Text className="sp-row__subject">{SUBJECT}</Text>}
    >
      <Badge
        tone={s.sent ? "success" : "accent"}
        icon={<Check on={s.sent} pending={!s.sent} size={12} className="sp-row__check" />}
        className="sp-status"
      >
        <Roll>{s.sent ? "Answered by AI" : "Working"}</Roll>
      </Badge>
    </Row>
  )
}

function FillerRow({ r }: { r: (typeof FILLER)[number] }) {
  return (
    <Row
      className="sp-row"
      lead={<Avatar plain size={30} />}
      title={<Bar w={r.name + 40} h={6} tone={4} />}
      meta={<Bar w={r.time} h={5} tone={2} />}
      subtitle={<Bar w={r.subject} h={5} tone={3} />}
    />
  )
}

function Conversation({ s }: { s: S }) {
  return (
    <div className="sp-pane">
      {/* The ticket that was open before: placeholder, so the frame opens complete */}
      <div className="sp-layer" data-on={!s.open || undefined} aria-hidden={s.open}>
        <div className="sp-head">
          <Bar w={190} h={7} tone={4} />
          <Bar w={120} h={5} tone={2} />
        </div>
        <div className="sp-thread">
          <div className="sp-msg">
            <Bar w="82%" h={6} tone={3} />
            <Bar w="58%" h={6} tone={3} />
          </div>
          <div className="sp-msg sp-msg--ai" data-on>
            <Bar w="88%" h={6} tone={3} />
            <Bar w="74%" h={6} tone={3} />
            <Bar w="40%" h={6} tone={3} />
          </div>
        </div>
      </div>

      <div className="sp-layer" data-on={s.open || undefined} aria-hidden={!s.open}>
        <div className="sp-head">
          <Text className="sp-head__title">{SUBJECT}</Text>
          <Text className="sp-head__meta">dana.levi@example.com</Text>
        </div>
        <div className="sp-thread">
          <div className="sp-msg">
            <Text wrap className="sp-msg__text">
              {EMAIL}
            </Text>
          </div>

          <div className="sp-msg sp-msg--ai" data-on={s.phase !== "idle" || undefined}>
            <div className="sp-ai__head">
              <Text className="sp-ai__label">AI reply</Text>
              <span className="sp-ai__sent" data-on={s.sent || undefined}>
                <Text>Sent in 9s</Text>
              </span>
            </div>
            <Collapse open={s.phase === "reading"}>
              <div className="sp-reading">
                <Spinner size={13} />
                <Text>Checking the knowledge base</Text>
              </div>
            </Collapse>
            <Collapse open={s.phase === "answer"}>
              <div className="sp-answer">
                <Stream className="sp-stream" text={ANSWER} count={s.words} />
                <div className="sp-source" data-on={s.source || undefined}>
                  <BookOpen size={14} strokeWidth={1.75} className="sp-icon" />
                  <Text>Frame size for the C1</Text>
                </div>
              </div>
            </Collapse>
          </div>
        </div>
        <div className="sp-rest" data-target="rest" />
      </div>
    </div>
  )
}

function Scene({ s, layout }: { s: S; layout: Layout }) {
  const compact = layout === "compact"
  const lead = compact ? undefined : (
    <div className="sp-crumbs">
      <Text className="sp-crumbs__title">Tickets</Text>
      {!compact && (
        <div className="sp-tabs">
          <span className="sp-tab" data-active>
            <Text>Waiting</Text>
          </span>
          <span className="sp-tab">
            <Bar w={22} h={5} tone={3} />
          </span>
          <span className="sp-tab">
            <Bar w={52} h={5} tone={3} />
          </span>
        </div>
      )}
    </div>
  )
  const list = (
    <div className="sp-list">
      <Collapse open={s.arrived} reveal="drop">
        <StoryRow s={s} />
      </Collapse>
      {FILLER.map((r, i) => (
        <FillerRow key={i} r={r} />
      ))}
    </div>
  )
  const body = (
    <div className="sp-body">
      {list}
      <Conversation s={s} />
    </div>
  )
  const props = { lead, className: "sp-window", body: { className: "sp-main", "data-crop": true } }

  return (
    <>
      {compact ? (
        <Window {...props}>{body}</Window>
      ) : (
        <Window {...props} sidebar={<Sidebar />} sidebarWidth={196}>
          {body}
        </Window>
      )}
      {!compact && (
        <div className="sp-stat">
          <Text className="sp-stat__label">Answered without a person</Text>
          <span className="sp-stat__value">
            <Count value={s.counted ? 87 : 86} format={(n) => `${Math.round(n)}%`} />
          </span>
          <Bar w={92} h={5} tone={2} />
        </div>
      )}
    </>
  )
}

export default function SupportDemo() {
  return (
    <Stage
      width={1080}
      height={600}
      compact={{ below: 640, width: 358, height: 320 }}
      accent="#1f5fae"
      greys="cool"
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      fill
      cursor={{ at: REST }}
      className="sp-stage"
    >
      {(s, _rect, layout) => <Scene s={s} layout={layout} />}
    </Stage>
  )
}
