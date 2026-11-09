import { Activity, BookOpen, FlaskConical, Inbox, LayoutDashboard, LogOut, Moon, SearchX, Sun, Zap, type LucideIcon } from "lucide-react"
import { NavLink, Outlet, useLocation } from "react-router"

import { ErrorBoundary } from "@/components/error-boundary"

import { useTheme } from "@/components/theme-provider"
import { logout, useSession } from "@/lib/api"
import { timeAgo } from "@/lib/format"
import { groupGaps } from "@/lib/gaps"
import { useEvents, useKnowledgeGaps, useStats } from "@/lib/queries"
import { cn } from "@/lib/utils"

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; group: "Support" | "AI" }

const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true, group: "Support" },
  { to: "/tickets", label: "Tickets", icon: Inbox, group: "Support" },
  { to: "/activity", label: "Activity", icon: Activity, group: "Support" },
  { to: "/knowledge-base", label: "Knowledge base", icon: BookOpen, group: "AI" },
  { to: "/knowledge-gaps", label: "Knowledge gaps", icon: SearchX, group: "AI" },
  { to: "/try", label: "Try an email", icon: FlaskConical, group: "AI" },
]

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Zap className="size-4 fill-current" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold">EBikes IL</p>
        <p className="text-xs text-muted-foreground">Support autopilot</p>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { setTheme } = useTheme()
  const toggle = () => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </button>
  )
}

/** When the poller last wrote an event. */
function Heartbeat() {
  const { data: events } = useEvents(5)
  const latest = events?.[0]
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
      <span className={cn("size-2 shrink-0 rounded-full", latest ? "bg-success" : "bg-muted-foreground/40")} aria-hidden />
      <div className="min-w-0 leading-tight">
        <p className="text-xs font-medium">Last email handled</p>
        <p className="truncate text-xs text-muted-foreground">
          {latest ? timeAgo(latest.created_at) : "Nothing yet"}
        </p>
      </div>
    </div>
  )
}

export function AppShell() {
  const { demo } = useSession()
  const { pathname } = useLocation()
  const waiting = useStats().data?.waiting ?? 0
  const { data: gaps } = useKnowledgeGaps()
  const missing = gaps ? groupGaps(gaps).length : 0
  const badges: Record<string, { count: number; label: string }> = {
    "/tickets": { count: waiting, label: "waiting for a person" },
    "/knowledge-gaps": { count: missing, label: "missing answers" },
  }

  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
      isActive && "bg-sidebar-accent text-foreground"
    )

  const nav = NAV.map((item) => (
    <NavLink key={item.to} to={item.to} end={item.end} className={link}>
      <item.icon className="size-4" aria-hidden />
      {item.label}
      {(badges[item.to]?.count ?? 0) > 0 && (
        <span
          className="ml-auto rounded-full bg-warning/15 px-1.5 text-xs font-semibold text-warning tabular-nums"
          aria-label={`${badges[item.to].count} ${badges[item.to].label}`}
        >
          {badges[item.to].count}
        </span>
      )}
    </NavLink>
  ))

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop: a fixed sidebar. */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <Brand />
        <nav aria-label="Main" className="mt-7 flex flex-col gap-1">
          {(["Support", "AI"] as const).map((group) => (
            <div key={group} className="mb-3 flex flex-col gap-1">
              <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{group}</p>
              {nav.filter((_, index) => NAV[index].group === group)}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          {demo && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
              <span className="font-semibold">Sample data.</span> Nothing here is a real customer.
            </p>
          )}
          <Heartbeat />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={logout}
              className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" aria-hidden />
              {demo ? "Exit sample data" : "Log out"}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Smaller screens: brand and a scrolling nav row on top. */}
      <header className="sticky top-0 z-30 border-b bg-sidebar/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <Brand />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              aria-label={demo ? "Exit sample data" : "Log out"}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav}
        </nav>
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:py-6">
        {/* Keyed by page, so moving to another page clears a crash. */}
        <ErrorBoundary key={pathname.split("/")[1]}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
