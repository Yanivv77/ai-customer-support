import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { HashRouter, Navigate, Route, Routes } from "react-router"

import { AppShell } from "@/components/app-shell"
import { useSession } from "@/lib/api"
import { ActivityPage } from "@/pages/activity"
import { KnowledgeBasePage } from "@/pages/knowledge-base"
import { KnowledgeGapsPage } from "@/pages/knowledge-gaps"
import { LoginPage } from "@/pages/login"
import { OverviewPage } from "@/pages/overview"
import { TicketsPage } from "@/pages/tickets"
import { TryEmailPage } from "@/pages/try-email"

export default function App() {
  const { loggedIn } = useSession()
  const client = useQueryClient()

  // Never show one session's data to the next.
  useEffect(() => {
    if (!loggedIn) client.clear()
  }, [loggedIn, client])

  if (!loggedIn) return <LoginPage />

  // Hash routes work with the plain static file mount in FastAPI: no server fallback needed.
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="tickets/:ticketId?" element={<TicketsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="knowledge-base/:entryId?" element={<KnowledgeBasePage />} />
          <Route path="knowledge-gaps" element={<KnowledgeGapsPage />} />
          <Route path="try" element={<TryEmailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
