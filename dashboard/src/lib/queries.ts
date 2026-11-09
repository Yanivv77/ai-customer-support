import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api } from "@/lib/api"
import type { Entry, KnowledgeGap, Message, Simulation, Stats, SupportEvent, Ticket, TicketPage, TicketStatus } from "@/lib/types"

// The poller works in the background, so keep the lists fresh without a reload.
const LIVE = 15_000

export type TicketFilter = { status: TicketStatus | null; q: string; limit: number }

export const keys = {
  stats: ["stats"] as const,
  events: (limit: number) => ["events", limit] as const,
  tickets: ["tickets"] as const,
  ticketList: (filter: TicketFilter) => ["tickets", "list", filter] as const,
  ticket: (id: number) => ["tickets", "detail", id] as const,
  messages: (id: number) => ["tickets", "detail", id, "messages"] as const,
  knowledgeBase: ["knowledge-base"] as const,
  knowledgeGaps: ["knowledge-gaps"] as const,
}

export function useStats() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return useQuery({
    queryKey: keys.stats,
    queryFn: () => api<Stats>(`/stats?tz=${encodeURIComponent(zone)}`),
    refetchInterval: LIVE,
  })
}

export function useEvents(limit = 100) {
  return useQuery({
    queryKey: keys.events(limit),
    queryFn: () => api<SupportEvent[]>(`/events?limit=${limit}`),
    refetchInterval: LIVE,
    placeholderData: keepPreviousData,
  })
}

export function useTicketList(filter: TicketFilter) {
  const params = new URLSearchParams({ limit: String(filter.limit) })
  if (filter.status) params.set("status", filter.status)
  if (filter.q) params.set("q", filter.q)
  return useQuery({
    queryKey: keys.ticketList(filter),
    queryFn: () => api<TicketPage>(`/tickets?${params}`),
    refetchInterval: LIVE,
    // Keep the old list on screen while a new search or page loads.
    placeholderData: keepPreviousData,
  })
}

export function useTicket(id: number | null) {
  return useQuery({
    queryKey: keys.ticket(id ?? 0),
    queryFn: () => api<Ticket>(`/tickets/${id}`),
    enabled: id !== null,
    refetchInterval: LIVE,
  })
}

export function useMessages(id: number | null) {
  return useQuery({
    queryKey: keys.messages(id ?? 0),
    queryFn: () => api<Message[]>(`/tickets/${id}/messages`),
    enabled: id !== null,
    refetchInterval: LIVE,
  })
}

export function useKnowledgeBase() {
  return useQuery({
    queryKey: keys.knowledgeBase,
    queryFn: () => api<Entry[]>("/knowledge-base"),
    staleTime: 60_000,
  })
}

function useRefreshTickets() {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.tickets }),
      client.invalidateQueries({ queryKey: keys.stats }),
    ])
}

export function useCheckInbox() {
  const client = useQueryClient()
  const refresh = useRefreshTickets()
  return useMutation({
    mutationFn: () => api<{ messages: number | unknown[] }>("/poll", { method: "POST" }),
    onSuccess: async ({ messages }) => {
      const count = Array.isArray(messages) ? messages.length : Number(messages) || 0
      await Promise.all([client.invalidateQueries({ queryKey: ["events"] }), refresh()])
      if (count === 0) toast("Inbox is up to date", { description: "No new emails to handle." })
      else toast.success(count === 1 ? "1 new email handled" : `${count} new emails handled`)
    },
    onError: (error) => toast.error("Could not check the inbox", { description: error.message }),
  })
}

/** Sends a person's reply to the customer by email. This cannot be undone. */
export function useSendReply(ticket: Ticket) {
  const refresh = useRefreshTickets()
  return useMutation({
    mutationFn: (reply: { body: string; resolve: boolean }) =>
      api<Ticket & { warning: string | null }>(`/tickets/${ticket.id}/reply`, {
        method: "POST",
        body: JSON.stringify(reply),
      }),
    onSuccess: async (result) => {
      await refresh()
      if (result.warning) toast.warning("Reply sent, ticket still open", { description: result.warning })
      else toast.success("Reply sent", { description: `Emailed to ${ticket.customer_email}.` })
    },
    onError: (error) => toast.error("The reply was not sent", { description: error.message }),
  })
}

export function useTicketAction(ticket: Ticket) {
  const refresh = useRefreshTickets()
  return useMutation({
    mutationFn: (action: "resolve" | "reopen") => api<Ticket>(`/tickets/${ticket.id}/${action}`, { method: "POST" }),
    onSuccess: async (_result, action) => {
      await refresh()
      if (action === "resolve") toast.success("Ticket resolved", { description: "The AI answers this customer's next email." })
      else toast.success("Ticket reopened", { description: "The AI stays out of this thread until it is resolved." })
    },
    onError: (error) => toast.error("Could not update the ticket", { description: error.message }),
  })
}

export function useSaveEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (entry: Pick<Entry, "id" | "title" | "content">) =>
      api<Entry>(`/knowledge-base/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: entry.title, content: entry.content }),
      }),
    onSuccess: (updated) => {
      client.setQueryData<Entry[]>(keys.knowledgeBase, (entries) =>
        entries?.map((entry) => (entry.id === updated.id ? updated : entry))
      )
      toast.success("Saved", { description: "The AI uses this from the next email on." })
    },
    onError: (error) => toast.error("Could not save", { description: error.message }),
  })
}

export function useKnowledgeGaps() {
  return useQuery({
    queryKey: keys.knowledgeGaps,
    queryFn: () => api<KnowledgeGap[]>("/knowledge-gaps"),
    refetchInterval: 60_000,
  })
}

export type NewEntry = Pick<Entry, "section" | "title" | "content">

export function useCreateEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (entry: NewEntry) => api<Entry>("/knowledge-base", { method: "POST", body: JSON.stringify(entry) }),
    onSuccess: (created) => {
      client.setQueryData<Entry[]>(keys.knowledgeBase, (entries) => entries && [...entries, created])
    },
  })
}

export type TrialEmail = { subject: string; body: string; has_attachments: boolean }

/** Runs the AI on a made-up email. Nothing is sent and nothing is saved. */
export function useSimulate() {
  return useMutation({
    mutationFn: (email: TrialEmail) => api<Simulation>("/simulate", { method: "POST", body: JSON.stringify(email) }),
  })
}
