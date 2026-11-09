import { useSyncExternalStore } from "react"

const KEY = "dashboard-login"
const DEMO = "demo"

// A tiny external store over sessionStorage, so a 401 anywhere logs the whole app out.
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function read() {
  return sessionStorage.getItem(KEY)
}

export function saveLogin(username: string, password: string) {
  sessionStorage.setItem(KEY, btoa(`${username}:${password}`))
}

/** Call after the credentials were checked against the API. */
export function confirmLogin() {
  emit()
}

export function startDemo() {
  sessionStorage.setItem(KEY, DEMO)
  emit()
}

export function logout() {
  sessionStorage.removeItem(KEY)
  emit()
}

export function isDemo() {
  return read() === DEMO
}

export function useSession() {
  const token = useSyncExternalStore(subscribe, read)
  return { loggedIn: token !== null, demo: token === DEMO }
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isDemo()) {
    // Loaded on demand, so the sample data never ships in the main bundle.
    const { demoApi } = await import("./demo")
    return demoApi<T>(path, init)
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${read() ?? ""}`,
      ...init.headers,
    },
  })
  if (response.status === 401) {
    logout()
    throw new ApiError(401, "Wrong username or password")
  }
  if (!response.ok) {
    // FastAPI puts the readable reason in {"detail": "..."}.
    const text = await response.text()
    let message = text || response.statusText
    try {
      const detail = (JSON.parse(text) as { detail?: unknown }).detail
      if (typeof detail === "string") message = detail
    } catch {
      // Not JSON: show the text as it is.
    }
    throw new ApiError(response.status, message)
  }
  return response.json() as Promise<T>
}
