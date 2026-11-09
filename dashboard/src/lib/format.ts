const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" })
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" })
const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function timeAgo(value: string, now = Date.now()) {
  const diff = new Date(value).getTime() - now
  const abs = Math.abs(diff)
  if (abs < MINUTE) return "just now"
  if (abs < HOUR) return relative.format(Math.round(diff / MINUTE), "minute")
  if (abs < DAY) return relative.format(Math.round(diff / HOUR), "hour")
  if (abs < 7 * DAY) return relative.format(Math.round(diff / DAY), "day")
  return day.format(new Date(value))
}

export const formatDateTime = (value: string) => dateTime.format(new Date(value))
export const formatTime = (value: string) => time.format(new Date(value))
export const formatDay = (value: Date) => day.format(value)
export const formatWeekday = (value: Date) => weekday.format(value)

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** "returns-and-warranty" -> "Returns and warranty" */
export function sectionLabel(section: string | null | undefined) {
  if (!section) return "Uncategorised"
  if (section === "e-bikes") return "E-bikes"
  const text = section.replaceAll("-", " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "dana.levi@example.com" -> "DL" */
export function initials(email: string) {
  const parts = email.split("@")[0].split(/[._\-+]/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : email.slice(0, 2)
  return letters.toUpperCase()
}
