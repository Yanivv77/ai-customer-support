import type { KnowledgeGap } from "@/lib/types"

export type GapGroup = {
  /** Stable key: the missing information, lower-cased. */
  key: string
  missing: string
  section: string | null
  /** Every email that hit this gap, newest first. */
  asks: KnowledgeGap[]
  lastAsked: string
}

/** One row per missing piece of information, so a question asked five times shows once. */
export function groupGaps(gaps: KnowledgeGap[]): GapGroup[] {
  const groups = new Map<string, GapGroup>()
  for (const gap of gaps) {
    const key = gap.missing.trim().toLowerCase().replace(/[.\s]+$/, "")
    const group = groups.get(key)
    if (group) {
      group.asks.push(gap)
      if (gap.created_at > group.lastAsked) group.lastAsked = gap.created_at
    } else {
      groups.set(key, { key, missing: gap.missing.trim(), section: gap.section, asks: [gap], lastAsked: gap.created_at })
    }
  }
  return [...groups.values()].sort((a, b) => b.asks.length - a.asks.length || b.lastAsked.localeCompare(a.lastAsked))
}

/** A starting title for a new entry, from the gap's sentence. */
export function suggestTitle(missing: string) {
  const text = missing
    .replace(/^how to\s+/i, "")
    .replace(/^(whether|how|what|which|where|when|if)\s+/i, "")
    .replace(/^the customer asks (about |whether )?/i, "")
    .split(/[,.;]/)[0]
    .trim()
  const title = text.charAt(0).toUpperCase() + text.slice(1)
  return title.length > 60 ? `${title.slice(0, 57).trimEnd()}…` : title
}
